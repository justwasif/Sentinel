'use strict';

/**
 * agents/coordinator/index.js
 * ───────────────────────────
 * Swarm Coordinator — receives RISK + YIELD proposals, validates
 * 0G DA proofs, and routes approved actions to KeeperHub.
 *
 * Fixes applied vs original:
 *  - Risk agent now required from agents/riskAgent/index.js (plain JS)
 *  - processedExecutionIds.add() called BEFORE executeProposal to stop double-exec
 *  - pop() happens only once per proposal, not in both success + catch paths
 */

require('dotenv').config();

const { ethers }      = require('ethers');
const fs              = require('fs');
const path            = require('path');

const logger          = require('../../utils/logger');
const rpcEndpoints    = require('../../config/rpcEndpoints');
const RpcFailover     = require('../../keeperhub/rpcFallover.js');
const { withRetry }   = require('../../keeperhub/retryHandler');
const X402Payment     = require('../../keeperhub/x402Payment');
const KeeperHubClient = require('../../keeperhub/client');
const ProposalQueue   = require('./proposalQueue');
const { classifyProposal, enrichProposal, shouldExecute } = require('./priorityEngine');
const { RISK, YIELD, HOLD } = require('./proposalQueue');

// ── ABIs ─────────────────────────────────────────────────────────────────────

const INFERENCE_GUARD_ABI = [
  'function isProofValid(bytes32 executionId) view returns (bool)',
  'function consumeProof(bytes32 executionId) external',
  'function submitProof(bytes32 executionId, bytes32 rootHash) external',
];

const SENTINEL_INFT_ABI = [
  'function incrementExperience(uint256 tokenId) external',
  'function getExperienceCycles(uint256 tokenId) view returns (uint256)',
];

// ── Config ───────────────────────────────────────────────────────────────────

const PRIVATE_KEY          = process.env.PRIVATE_KEY;
const COORDINATOR_POLL_MS  = parseInt(process.env.COORDINATOR_POLL_MS  || '5000',  10);
const INFT_TOKEN_ID        = parseInt(process.env.INFT_TOKEN_ID        || '0',     10);
const USDC_CONTRACT        = process.env.USDC_CONTRACT                 || '';
const X402_ENABLED         = process.env.X402_ENABLED                  === 'true';
const KEEPERHUB_API_KEY    = process.env.KEEPERHUB_API_KEY             || '';
const KEEPERHUB_BASE_URL   = process.env.KEEPERHUB_BASE_URL            || 'https://api.keeperhub.io';
const MCP_ENABLED          = process.env.KEEPERHUB_MCP_ENABLED         === 'true';
const MCP_PORT             = parseInt(process.env.KEEPERHUB_MCP_PORT   || '3001',  10);
const PROOF_RETRY_DELAY_MS = parseInt(process.env.PROOF_RETRY_DELAY_MS || '750',   10);
const PROOF_RETRY_ATTEMPTS = parseInt(process.env.PROOF_RETRY_ATTEMPTS || '2',     10);
const GAS_BUMP_GWEI        = parseInt(process.env.GAS_BUMP_GWEI        || '2',     10);

// ── Load deployed addresses ──────────────────────────────────────────────────

let addresses;
try {
  addresses = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../deployed-addresses.json'), 'utf8')
  );
} catch (err) {
  logger.error(`Coordinator: deployed-addresses.json missing: ${err.message}`);
  process.exit(1);
}

// ── Singletons ───────────────────────────────────────────────────────────────

const rpcFailover           = new RpcFailover(rpcEndpoints);
const queue                 = new ProposalQueue();
const processedExecutionIds = new Set();

let wallet, inferenceGuard, sentinelINFT, keeperHubClient, x402Payment;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getGasOverrides() {
  const feeData = await wallet.provider.getFeeData();
  const bump    = ethers.parseUnits(String(GAS_BUMP_GWEI), 'gwei');
  return {
    maxFeePerGas:         (feeData.maxFeePerGas  || feeData.gasPrice || ethers.parseUnits('20', 'gwei')) + bump,
    maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei')) + bump,
  };
}

function buildProofRootHash(proposal) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({
      executionId:  proposal.executionId,
      agentType:    proposal.agentType,
      positionId:   proposal.positionId,
      action:       proposal.action,
      reasoning:    proposal.reasoning,
      timestamp:    proposal.timestamp,
    }))
  );
}

// ── Proof handling ───────────────────────────────────────────────────────────

async function ensureProofReady(proposal) {
  for (let attempt = 0; attempt <= PROOF_RETRY_ATTEMPTS; attempt++) {
    let proofValid = false;

    try {
      proofValid = await inferenceGuard.isProofValid(proposal.executionId);
    } catch (err) {
      logger.error(`Coordinator: isProofValid failed: ${err.message}`);
      if (/network|connect|timeout/i.test(err.message)) {
        rpcFailover.failover(); initContracts();
      }
    }

    if (proofValid) return true;

    // Try to submit the proof
    try {
      const rootHash = proposal.rootHash || buildProofRootHash(proposal);
      const tx       = await inferenceGuard.submitProof(
        proposal.executionId, rootHash, await getGasOverrides()
      );
      logger.info(`Coordinator: proof submitted — ${proposal.executionId.slice(0, 16)}... tx: ${tx.hash}`);
      await tx.wait();
    } catch (err) {
      if (!err.message.includes('executionId already exists')) {
        logger.error(`Coordinator: submitProof failed: ${err.message}`);
        if (/network|connect|timeout/i.test(err.message)) {
          rpcFailover.failover(); initContracts();
        }
      }
    }

    if (attempt < PROOF_RETRY_ATTEMPTS) await sleep(PROOF_RETRY_DELAY_MS);
  }

  try { return await inferenceGuard.isProofValid(proposal.executionId); }
  catch { return false; }
}

// ── Contract + client init ────────────────────────────────────────────────────

function initContracts() {
  wallet = rpcFailover.getWallet(PRIVATE_KEY);

  inferenceGuard = new ethers.Contract(
    addresses.InferenceGuard, INFERENCE_GUARD_ABI, wallet
  );
  sentinelINFT = new ethers.Contract(
    addresses.SentinelINFT, SENTINEL_INFT_ABI, wallet
  );
  keeperHubClient = new KeeperHubClient({
    apiKey:     KEEPERHUB_API_KEY,
    baseUrl:    KEEPERHUB_BASE_URL,
    mcpEnabled: MCP_ENABLED,
    mcpPort:    MCP_PORT,
  });
  x402Payment = new X402Payment({
    wallet,
    usdcContractAddress: USDC_CONTRACT || (addresses.MockUSDC || ethers.ZeroAddress),
    enabled:             X402_ENABLED,
  });
}

// ── Agent attachment ──────────────────────────────────────────────────────────

function attachAgent(modulePath, agentLabel) {
  try {
    const { [`${agentLabel}Emitter`]: emitter } = require(modulePath);
    emitter.on('proposal', (raw) => {
      try {
        const priority = classifyProposal(raw);
        const enriched = enrichProposal(raw, priority);
        queue.push(enriched);
        logger.info(
          `Coordinator: ${agentLabel.toUpperCase()} proposal — ` +
          `executionId: ${enriched.executionId.slice(0, 16)}... ` +
          `priority: ${priority} queue: ${queue.size()}`
        );
      } catch (err) {
        logger.error(`Coordinator: error processing ${agentLabel} proposal: ${err.message}`);
      }
    });
    logger.info(`Coordinator: ${agentLabel}Emitter attached`);
  } catch (err) {
    logger.warn(`Coordinator: could not attach ${agentLabel}: ${err.message}`);
  }
}

// ── Execute via KeeperHub ─────────────────────────────────────────────────────

async function executeProposal(proposal) {
  logger.info(`Coordinator: executing ${proposal.agentType} — ${proposal.executionId.slice(0, 16)}...`);

  // Optional x402 payment before execution
  if (X402_ENABLED && USDC_CONTRACT) {
    try {
      const paymentAmount = ethers.parseUnits('0.50', 6); // 0.50 USDC per execution
      await x402Payment.approvePayment(paymentAmount, KEEPERHUB_BASE_URL);
      logger.info('Coordinator: x402 payment approved');
    } catch (err) {
      logger.warn(`Coordinator: x402 payment failed (continuing): ${err.message}`);
    }
  }

  const workflowDef = {
    name:       `sentinel-${proposal.agentType.toLowerCase()}-${proposal.executionId.slice(0, 8)}`,
    type:       proposal.agentType === 'RISK' ? 'LIQUIDATION_PROTECTION' : 'LP_REBALANCE',
    executionId: proposal.executionId,
    positionId:  proposal.positionId,
    action:      proposal.action,
    reasoning:   proposal.reasoning,
    network:     'galileo',
    chainId:     16602,
    contractAddresses: {
      SentinelINFT:     addresses.SentinelINFT,
      PositionRegistry: addresses.PositionRegistry,
      InferenceGuard:   addresses.InferenceGuard,
      MockUniswapPool:  addresses.MockUniswapPool || null,
      MockUSDC:         addresses.MockUSDC        || null,
    },
  };

  let workflowId, executionResult;

  try {
    const created = await keeperHubClient.createWorkflow(workflowDef);
    workflowId    = created.id || created.workflowId || `mock-wf-${Date.now()}`;
    logger.info(`Coordinator: workflow created — ${workflowId}`);
  } catch (err) {
    logger.error(`Coordinator: createWorkflow failed: ${err.message}`);
    workflowId = `fallback-wf-${Date.now()}`;
  }

  try {
    executionResult = await keeperHubClient.triggerExecution(workflowId, {
      executionId: proposal.executionId, proposal,
    });
    logger.info(`Coordinator: execution triggered — ${JSON.stringify(executionResult).slice(0, 120)}`);
  } catch (err) {
    logger.error(`Coordinator: triggerExecution failed: ${err.message}`);
    executionResult = { status: 'api_unavailable', workflowId, error: err.message };
  }

  // consumeProof on-chain
  await safeOnChain('consumeProof', () =>
    inferenceGuard.consumeProof(proposal.executionId, getGasOverrides())
  );

  // incrementExperience on-chain
  await safeOnChain('incrementExperience', () =>
    sentinelINFT.incrementExperience(INFT_TOKEN_ID, getGasOverrides())
  );

  return executionResult;
}

async function safeOnChain(label, txFn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const tx = await txFn();
      await tx.wait();
      logger.info(`Coordinator: ${label} confirmed`);
      return;
    } catch (err) {
      logger.error(`Coordinator: ${label} failed: ${err.message}`);
      if (/network|connect|timeout/i.test(err.message) && attempt === 0) {
        rpcFailover.failover(); initContracts();
      } else {
        return; // non-retryable (e.g. already consumed)
      }
    }
  }
}

// ── Main loop ────────────────────────────────────────────────────────────────

async function processCycle() {
  if (queue.size() === 0) { logger.debug('Coordinator: queue empty'); return; }

  const proposal = queue.peek();
  logger.info(
    `Coordinator: processing — type: ${proposal.agentType} ` +
    `priority: ${proposal.priority} ` +
    `executionId: ${proposal.executionId?.slice(0, 16)}...`
  );

  // Dedup — mark BEFORE execution to prevent double-processing
  if (proposal.executionId && processedExecutionIds.has(proposal.executionId)) {
    logger.info(`Coordinator: already processed ${proposal.executionId.slice(0, 16)}... — skipping`);
    queue.pop();
    return;
  }
  if (proposal.executionId) processedExecutionIds.add(proposal.executionId);

  if (!shouldExecute(proposal)) {
    queue.pop();
    logger.info(`Coordinator: HOLD — discarding type=${proposal.agentType}`);
    return;
  }

  const proofValid = await ensureProofReady(proposal);
  if (!proofValid) {
    logger.warn(`Coordinator: no valid proof — skipping ${proposal.executionId?.slice(0, 16)}...`);
    queue.pop();
    return;
  }

  try {
    const result = await withRetry(
      () => executeProposal(proposal),
      { maxAttempts: 3, baseDelayMs: 1000, label: proposal.executionId?.slice(0, 16) || 'proposal' }
    );
    queue.pop();
    logger.info(`Coordinator: success — ${JSON.stringify(result).slice(0, 120)}`);
  } catch (err) {
    logger.error(`Coordinator: all retries failed — ${err.message}`);
    queue.pop(); // pop anyway to avoid infinite loop
  }
}

async function runCoordinator() {
  if (!PRIVATE_KEY) {
    logger.error('Coordinator: PRIVATE_KEY not set. Exiting.');
    process.exit(1);
  }

  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║       SENTINEL — COORDINATOR AGENT STARTED      ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info(`Network:          0G Galileo (chainId 16602)`);
  logger.info(`RPC endpoints:    ${rpcEndpoints.join(', ')}`);
  logger.info(`InferenceGuard:   ${addresses.InferenceGuard}`);
  logger.info(`SentinelINFT:     ${addresses.SentinelINFT}`);
  logger.info(`MockUSDC:         ${addresses.MockUSDC || 'not deployed yet'}`);
  logger.info(`iNFT Token ID:    ${INFT_TOKEN_ID}`);
  logger.info(`Poll interval:    ${COORDINATOR_POLL_MS}ms`);
  logger.info(`MCP enabled:      ${MCP_ENABLED}`);
  logger.info(`x402 enabled:     ${X402_ENABLED}`);
  logger.info('──────────────────────────────────────────────────');

  initContracts();
  logger.info(`Coordinator wallet: ${wallet.address}`);

  // Attach both agents
  attachAgent('../../yieldAgent',           'yield');
  attachAgent('../riskAgent/index',          'risk');

  logger.info(`Coordinator: starting main loop — polling every ${COORDINATOR_POLL_MS}ms`);
  setInterval(async () => {
    try { await processCycle(); }
    catch (err) { logger.error(`Coordinator: unhandled error: ${err.message}`); }
  }, COORDINATOR_POLL_MS);
}

async function main() {
  try { await runCoordinator(); }
  catch (err) {
    logger.error(`Coordinator: fatal startup error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { main, runCoordinator, processC: processCycle };

if (require.main === module) main();