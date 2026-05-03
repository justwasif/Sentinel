'use strict';

require('dotenv').config();

const { ethers }          = require('ethers');
const fs                  = require('fs');
const path                = require('path');

const logger              = require('../../utils/logger');
const rpcEndpoints        = require('../../config/rpcEndpoints');
const RpcFailover         = require('../../keeperhub/rpcFailover');
const { withRetry }       = require('../../keeperhub/retryHandler');
const X402Payment         = require('../../keeperhub/x402Payment');
const KeeperHubClient     = require('../../keeperhub/client');
const NonceManager        = require('../../keeperhub/nonceManager');    // ← NEW
const ProposalQueue       = require('./proposalQueue');
const { classifyProposal, enrichProposal, shouldExecute } = require('./priorityEngine');
const { RISK, YIELD, HOLD } = require('./proposalQueue');

// ── ABIs ────────────────────────────────────────────────────────────────────

const INFERENCE_GUARD_ABI = [
  'function isProofValid(bytes32 executionId) view returns (bool)',
  'function consumeProof(bytes32 executionId) external',
  'function submitProof(bytes32 executionId, bytes32 rootHash) external',
];

const SENTINEL_INFT_ABI = [
  'function incrementExperience(uint256 tokenId) external',
  'function getExperienceCycles(uint256 tokenId) view returns (uint256)',
];

// ── Configuration ────────────────────────────────────────────────────────────

const PRIVATE_KEY         = process.env.PRIVATE_KEY;
const COORDINATOR_POLL_MS = parseInt(process.env.COORDINATOR_POLL_MS || '5000', 10);
const INFT_TOKEN_ID       = parseInt(process.env.INFT_TOKEN_ID || '0', 10);
const USDC_CONTRACT       = process.env.USDC_CONTRACT || '0x0000000000000000000000000000000000000000';
const X402_ENABLED        = process.env.X402_ENABLED === 'true';
const KEEPERHUB_API_KEY   = process.env.KEEPERHUB_API_KEY || '';
const KEEPERHUB_BASE_URL  = process.env.KEEPERHUB_BASE_URL || 'https://api.keeperhub.io';
const MCP_ENABLED         = process.env.KEEPERHUB_MCP_ENABLED === 'true';
const MCP_PORT            = parseInt(process.env.KEEPERHUB_MCP_PORT || '3001', 10);

// ── Load deployed addresses ──────────────────────────────────────────────────

let addresses;
try {
  const addressesPath = path.resolve(__dirname, '../../deployed-addresses.json');
  addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
} catch (err) {
  logger.error(`Coordinator: failed to load deployed-addresses.json: ${err.message}`);
  process.exit(1);
}

// ── Setup singletons ─────────────────────────────────────────────────────────

const rpcFailover     = new RpcFailover(rpcEndpoints);
const queue           = new ProposalQueue();

// Track executionIds we have already processed to prevent double-execution
const processedIds    = new Set();

let wallet;
let inferenceGuard;
let sentinelINFT;
let keeperHubClient;
let x402Payment;
let nonceManager;                               // ← NEW

function initContracts() {
  wallet = rpcFailover.getWallet(PRIVATE_KEY);

  inferenceGuard = new ethers.Contract(
    addresses.InferenceGuard,
    INFERENCE_GUARD_ABI,
    wallet
  );

  sentinelINFT = new ethers.Contract(
    addresses.SentinelINFT,
    SENTINEL_INFT_ABI,
    wallet
  );

  keeperHubClient = new KeeperHubClient({
    apiKey:     KEEPERHUB_API_KEY,
    baseUrl:    KEEPERHUB_BASE_URL,
    mcpEnabled: MCP_ENABLED,
    mcpPort:    MCP_PORT,
  });

  x402Payment = new X402Payment({
    wallet,
    usdcContractAddress: USDC_CONTRACT,
    enabled: X402_ENABLED,
  });

  // Re-create the nonce manager pointing at the new wallet after failover
  nonceManager = new NonceManager(wallet);      // ← NEW
}

// ── Yield agent integration ──────────────────────────────────────────────────

function attachYieldAgent() {
  try {
    const { yieldEmitter } = require('../../yieldAgent');  // root-level file
    yieldEmitter.on('proposal', (rawProposal) => {
      try {
        const priority = classifyProposal(rawProposal);
        const enriched = enrichProposal(rawProposal, priority);

        // De-duplicate: ignore if already in queue or already processed
        if (processedIds.has(enriched.executionId)) {
          logger.debug(`Coordinator: duplicate YIELD proposal ignored — ${enriched.executionId.slice(0, 16)}...`);
          return;
        }

        queue.push(enriched);
        logger.info(
          `Coordinator: YIELD proposal — executionId: ${enriched.executionId.slice(0, 16)}... ` +
          `priority: ${priority} queue: ${queue.size()}`
        );
      } catch (err) {
        logger.error(`Coordinator: error processing yield proposal: ${err.message}`);
      }
    });
    logger.info('Coordinator: yieldEmitter attached');
  } catch (err) {
    logger.warn(`Coordinator: could not attach yieldAgent emitter: ${err.message}`);
  }
}

function attachRiskAgent() {
  try {
    const { riskEmitter } = require('../riskAgent');
    riskEmitter.on('proposal', (rawProposal) => {
      try {
        const priority = classifyProposal(rawProposal);
        const enriched = enrichProposal(rawProposal, priority);

        if (processedIds.has(enriched.executionId)) {
          logger.debug(`Coordinator: duplicate RISK proposal ignored — ${enriched.executionId.slice(0, 16)}...`);
          return;
        }

        queue.push(enriched);
        logger.info(
          `Coordinator: RISK proposal — executionId: ${enriched.executionId.slice(0, 16)}... ` +
          `priority: ${priority} queue: ${queue.size()}`
        );
      } catch (err) {
        logger.error(`Coordinator: error processing risk proposal: ${err.message}`);
      }
    });
    logger.info('Coordinator: riskEmitter attached');
  } catch (err) {
    logger.warn(`Coordinator: riskAgent not available yet — skipping: ${err.message}`);
  }
}

// ── Submit proof to InferenceGuard ──────────────────────────────────────────
//
// The coordinator is the single authority that writes proofs on-chain.
// Previously proof submission happened in an unrelated "System" path that
// raced with the coordinator and produced nonce collisions.  Now the
// coordinator owns the entire lifecycle: submit → verify → execute → consume.

async function submitProofForProposal(proposal) {
  const executionId = proposal.executionId;

  // Check whether a proof already exists (submitted by a previous run or a
  // crash-recovery scenario).
  let existingValid = false;
  try {
    existingValid = await inferenceGuard.isProofValid(executionId);
  } catch (err) {
    logger.warn(`Coordinator: isProofValid pre-check failed: ${err.message}`);
  }

  if (existingValid) {
    logger.info(`Coordinator: proof already valid for ${executionId.slice(0, 16)}... — skipping submit`);
    return true;
  }

  // Build a deterministic rootHash from the proposal content.
  // In production this would be the 0G DA blob rootHash returned after
  // writing the reasoning trace.  For testnet we derive it from the proposal.
  const rootHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({
      executionId,
      agentType:  proposal.agentType,
      action:     proposal.action,
      reasoning:  proposal.reasoning,
      timestamp:  proposal.timestamp,
    }))
  );

  try {
    // Use the nonce manager so this tx never collides with consumeProof /
    // incrementExperience sent moments later.
    await nonceManager.send((nonce) =>
      inferenceGuard.submitProof(executionId, rootHash, { nonce })
    );
    logger.info(`Coordinator: proof submitted — executionId: ${executionId.slice(0, 16)}...`);
    return true;
  } catch (err) {
    // "executionId already exists" is not a fatal error — it means another
    // code path already submitted it; we can proceed.
    if (
      err.message.includes('already exists') ||
      err.message.includes('InferenceGuard: executionId already exists')
    ) {
      logger.warn(`Coordinator: proof already on-chain for ${executionId.slice(0, 16)}... — continuing`);
      return true;
    }
    logger.error(`Coordinator: submitProof failed: ${err.message}`);
    return false;
  }
}

// ── Execute a proposal via KeeperHub ────────────────────────────────────────

async function executeProposal(proposal) {
  const shortId = proposal.executionId ? proposal.executionId.slice(0, 16) + '...' : 'N/A';
  logger.info(`Coordinator: processing — type: ${proposal.agentType} priority: ${proposal.priority} executionId: ${shortId}`);

  // ── x402 payment (approve USDC spend before KeeperHub execution) ─────────
  if (X402_ENABLED) {
    try {
      const KEEPERHUB_SPENDER = process.env.KEEPERHUB_PAYMENT_ADDRESS || ethers.ZeroAddress;
      // 1 USDC = 1_000_000 base units (6 decimals)
      const paymentAmount = BigInt(process.env.KEEPERHUB_PAYMENT_USDC_UNITS || '1000000');
      await x402Payment.approvePayment(paymentAmount, KEEPERHUB_SPENDER);
      logger.info(`Coordinator: x402 payment approved for ${shortId}`);
    } catch (err) {
      // Non-fatal — log and continue; KeeperHub will reject if payment is
      // actually required and not approved.
      logger.warn(`Coordinator: x402 payment approval failed (non-fatal): ${err.message}`);
    }
  }

  // ── KeeperHub workflow ───────────────────────────────────────────────────

  const workflowDefinition = {
    name: `sentinel-${proposal.agentType.toLowerCase()}-${proposal.executionId.slice(0, 8)}`,
    type: proposal.agentType === 'RISK' ? 'LIQUIDATION_PROTECTION' : 'LP_REBALANCE',
    executionId:  proposal.executionId,
    positionId:   proposal.positionId,
    action:       proposal.action,
    reasoning:    proposal.reasoning,
    network:      'galileo',
    chainId:      16602,
    contractAddresses: {
      SentinelINFT:     addresses.SentinelINFT,
      PositionRegistry: addresses.PositionRegistry,
      InferenceGuard:   addresses.InferenceGuard,
      MockUniswapPool:  addresses.MockUniswapPool || null,
    },
  };

  let workflowId;
  let executionResult;

  try {
    const createdWorkflow = await keeperHubClient.createWorkflow(workflowDefinition);
    workflowId = createdWorkflow.id || createdWorkflow.workflowId || `mock-wf-${Date.now()}`;
    logger.info(`Coordinator: workflow created — workflowId: ${workflowId}`);
  } catch (err) {
    logger.error(`Coordinator: createWorkflow failed: ${err.message}`);
    workflowId = `fallback-wf-${Date.now()}`;
    logger.warn(`Coordinator: using fallback workflowId: ${workflowId}`);
  }

  try {
    executionResult = await keeperHubClient.triggerExecution(workflowId, {
      executionId: proposal.executionId,
      proposal,
    });
    logger.info(`Coordinator: execution triggered — result: ${JSON.stringify(executionResult).slice(0, 120)}`);
  } catch (err) {
    logger.error(`Coordinator: triggerExecution failed: ${err.message}`);
    executionResult = { status: 'api_unavailable', workflowId, error: err.message };
  }

  // ── consumeProof on-chain ────────────────────────────────────────────────
  //
  // Use the nonce manager — this tx runs serially after submitProof above,
  // so there is no nonce collision.

  try {
    await nonceManager.send((nonce) =>
      inferenceGuard.consumeProof(proposal.executionId, { nonce })
    );
    logger.info(`Coordinator: consumeProof confirmed — ${shortId}`);
  } catch (err) {
    logger.error(`Coordinator: consumeProof failed: ${err.message}`);
    if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
      logger.warn('Coordinator: RPC error — failing over');
      rpcFailover.failover();
      initContracts();
      try {
        await nonceManager.send((nonce) =>
          inferenceGuard.consumeProof(proposal.executionId, { nonce })
        );
        logger.info('Coordinator: consumeProof retry succeeded');
      } catch (retryErr) {
        logger.error(`Coordinator: consumeProof retry failed: ${retryErr.message}`);
      }
    }
  }

  // ── incrementExperience on-chain ─────────────────────────────────────────

  try {
    await nonceManager.send((nonce) =>
      sentinelINFT.incrementExperience(INFT_TOKEN_ID, { nonce })
    );
    logger.info(`Coordinator: incrementExperience confirmed — tokenId: ${INFT_TOKEN_ID}`);
  } catch (err) {
    logger.error(`Coordinator: incrementExperience failed: ${err.message}`);
    if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
      logger.warn('Coordinator: RPC error — failing over');
      rpcFailover.failover();
      initContracts();
      try {
        await nonceManager.send((nonce) =>
          sentinelINFT.incrementExperience(INFT_TOKEN_ID, { nonce })
        );
        logger.info('Coordinator: incrementExperience retry succeeded');
      } catch (retryErr) {
        logger.error(`Coordinator: incrementExperience retry failed: ${retryErr.message}`);
      }
    }
  }

  return executionResult;
}

// ── Main processing cycle ────────────────────────────────────────────────────

async function processCycle() {
  if (queue.size() === 0) {
    logger.debug('Coordinator: queue empty');
    return;
  }

  const proposal = queue.peek();
  const shortId  = proposal.executionId ? proposal.executionId.slice(0, 16) + '...' : 'N/A';

  // Guard: already processed (covers restart / duplicate emission)
  if (processedIds.has(proposal.executionId)) {
    queue.pop();
    logger.info(`Coordinator: already processed ${shortId} — skipping`);
    return;
  }

  if (!shouldExecute(proposal)) {
    queue.pop();
    logger.info(`Coordinator: HOLD — discarding type=${proposal.agentType}`);
    return;
  }

  // ── Step 1: submit proof (coordinator owns this, no external racing) ──────
  const submitted = await submitProofForProposal(proposal);
  if (!submitted) {
    queue.pop();
    logger.warn(`Coordinator: proof submission failed for ${shortId} — discarding`);
    return;
  }

  // ── Step 2: verify proof is valid on-chain ─────────────────────────────
  let proofValid = false;
  try {
    proofValid = await inferenceGuard.isProofValid(proposal.executionId);
  } catch (err) {
    logger.error(`Coordinator: isProofValid call failed: ${err.message}`);
    if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
      rpcFailover.failover();
      initContracts();
      try {
        proofValid = await inferenceGuard.isProofValid(proposal.executionId);
      } catch (retryErr) {
        logger.error(`Coordinator: isProofValid retry failed: ${retryErr.message}`);
      }
    }
  }

  if (!proofValid) {
    queue.pop();
    logger.warn(`Coordinator: proof not valid for ${shortId} after submit — discarding`);
    return;
  }

  // ── Step 3: mark as processed BEFORE execution to prevent re-entry ───────
  processedIds.add(proposal.executionId);
  queue.pop();

  // ── Step 4: execute with retry ───────────────────────────────────────────
  try {
    const result = await withRetry(
      () => executeProposal(proposal),
      { maxAttempts: 3, baseDelayMs: 1000, label: shortId }
    );
    logger.info(`Coordinator: proposal executed — type: ${proposal.agentType} result: ${JSON.stringify(result).slice(0, 120)}`);
  } catch (err) {
    logger.error(`Coordinator: execution failed after all retries — type: ${proposal.agentType} error: ${err.message}`);
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

async function runCoordinator() {
  if (!PRIVATE_KEY) {
    logger.error('Coordinator: PRIVATE_KEY env var is not set. Exiting.');
    process.exit(1);
  }

  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║       SENTINEL — COORDINATOR AGENT STARTED      ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info(`Network:          0G Galileo (chainId 16602)`);
  logger.info(`RPC endpoints:    ${rpcEndpoints.join(', ')}`);
  logger.info(`InferenceGuard:   ${addresses.InferenceGuard}`);
  logger.info(`SentinelINFT:     ${addresses.SentinelINFT}`);
  logger.info(`MockUSDC:         ${USDC_CONTRACT}`);
  logger.info(`iNFT Token ID:    ${INFT_TOKEN_ID}`);
  logger.info(`Poll interval:    ${COORDINATOR_POLL_MS}ms`);
  logger.info(`MCP enabled:      ${MCP_ENABLED}`);
  logger.info(`x402 enabled:     ${X402_ENABLED}`);
  logger.info('──────────────────────────────────────────────────');

  initContracts();

  // Initialise the nonce manager once — fetches current on-chain nonce
  await nonceManager.init();
  logger.info(`Coordinator wallet: ${wallet.address}`);

  attachYieldAgent();
  attachRiskAgent();

  logger.info(`Coordinator: starting main loop — polling every ${COORDINATOR_POLL_MS}ms`);
  setInterval(async () => {
    try {
      await processCycle();
    } catch (err) {
      logger.error(`Coordinator: unhandled error in processCycle: ${err.message}`);
    }
  }, COORDINATOR_POLL_MS);
}

async function main() {
  try {
    await runCoordinator();
  } catch (err) {
    logger.error(`Coordinator: fatal startup error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { main, runCoordinator, processCycle };

if (require.main === module) {
  main();
}