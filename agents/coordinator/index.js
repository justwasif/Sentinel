'use strict';

require('dotenv').config();

const { ethers }          = require('ethers');
const fs                  = require('fs');
const path                = require('path');

const logger              = require('../../utils/logger');
const rpcEndpoints        = require('../../config/rpcEndpoints');
const RpcFailover         = require('../../keeperhub/rpcFallover.js');
const { withRetry }       = require('../../keeperhub/retryHandler');
const X402Payment         = require('../../keeperhub/x402Payment');
const KeeperHubClient     = require('../../keeperhub/client');
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
const PROOF_RETRY_DELAY_MS = parseInt(process.env.PROOF_RETRY_DELAY_MS || '750', 10);
const PROOF_RETRY_ATTEMPTS = parseInt(process.env.PROOF_RETRY_ATTEMPTS || '2', 10);
const GAS_BUMP_GWEI        = parseInt(process.env.GAS_BUMP_GWEI || '2', 10);

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
const processedExecutionIds = new Set();

let wallet;
let inferenceGuard;
let sentinelINFT;
let keeperHubClient;
let x402Payment;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGasOverrides() {
  const feeData = await wallet.provider.getFeeData();
  const bump = ethers.parseUnits(String(GAS_BUMP_GWEI), 'gwei');
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei')) + bump;
  const baseMaxFee = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
  const maxFeePerGas = baseMaxFee + bump;

  return { maxFeePerGas, maxPriorityFeePerGas };
}

function buildProofRootHash(proposal) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({
      executionId: proposal.executionId,
      agentType: proposal.agentType,
      positionId: proposal.positionId,
      action: proposal.action,
      reasoning: proposal.reasoning,
      timestamp: proposal.timestamp,
    }))
  );
}

async function ensureProofReady(proposal) {
  for (let attempt = 0; attempt <= PROOF_RETRY_ATTEMPTS; attempt++) {
    let proofValid = false;

    try {
      proofValid = await inferenceGuard.isProofValid(proposal.executionId);
    } catch (err) {
      logger.error(`Coordinator: isProofValid call failed: ${err.message}`);
      if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
        rpcFailover.failover();
        initContracts();
      }
    }

    if (proofValid) return true;

    try {
      const rootHash = proposal.rootHash || buildProofRootHash(proposal);
      const submitTx = await inferenceGuard.submitProof(
        proposal.executionId,
        rootHash,
        await getGasOverrides()
      );
      logger.info(`Coordinator: proof submitted — executionId: ${proposal.executionId.slice(0, 16)}... tx: ${submitTx.hash}`);
      await submitTx.wait();
    } catch (err) {
      const alreadyExists = err.message.includes('executionId already exists');
      if (!alreadyExists) {
        logger.error(`Coordinator: submitProof failed: ${err.message}`);
        if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
          rpcFailover.failover();
          initContracts();
        }
      }
    }

    if (attempt < PROOF_RETRY_ATTEMPTS) {
      await sleep(PROOF_RETRY_DELAY_MS);
    }
  }

  try {
    return await inferenceGuard.isProofValid(proposal.executionId);
  } catch (err) {
    logger.error(`Coordinator: final isProofValid call failed: ${err.message}`);
    return false;
  }
}

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
}

// ── Yield agent integration ──────────────────────────────────────────────────

function attachYieldAgent() {
  try {
    const { yieldEmitter } = require('../../yieldAgent.js');
    yieldEmitter.on('proposal', (rawProposal) => {
      try {
        const priority = classifyProposal(rawProposal);
        const enriched = enrichProposal(rawProposal, priority);
        queue.push(enriched);
        logger.info(
          `Coordinator: proposal received — executionId: ${enriched.executionId.slice(0, 16)}... ` +
          `priority: ${priority} queue size: ${queue.size()}`
        );
      } catch (err) {
        logger.error(`Coordinator: error processing yield proposal: ${err.message}`);
      }
    });
    logger.info('Coordinator: yieldEmitter listener attached');
  } catch (err) {
    logger.warn(`Coordinator: could not attach yieldAgent emitter: ${err.message}`);
  }
}

function attachRiskAgent() {
  try {
    const { riskEmitter } = require('../../og-integration/src/agents/risk-agent.ts');
    riskEmitter.on('proposal', (rawProposal) => {
      try {
        const priority = classifyProposal(rawProposal);
        const enriched = enrichProposal(rawProposal, priority);
        queue.push(enriched);
        logger.info(
          `Coordinator: RISK proposal enqueued — executionId: ${enriched.executionId.slice(0, 16)}... ` +
          `priority: ${priority} queue size: ${queue.size()}`
        );
      } catch (err) {
        logger.error(`Coordinator: error processing risk proposal: ${err.message}`);
      }
    });
    logger.info('Coordinator: riskEmitter listener attached');
  } catch (err) {
    logger.warn(`Coordinator: riskAgent not available yet — skipping: ${err.message}`);
  }
}

// ── Execute a proposal via KeeperHub ────────────────────────────────────────

async function executeProposal(proposal) {
  logger.info(`Coordinator: executing proposal ${proposal.executionId.slice(0, 16)}... type: ${proposal.agentType}`);

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

  // Step 1: Create workflow on KeeperHub
  let workflowId;
  let executionResult;

  try {
    const createdWorkflow = await keeperHubClient.createWorkflow(workflowDefinition);
    workflowId = createdWorkflow.id || createdWorkflow.workflowId || `mock-wf-${Date.now()}`;
    logger.info(`Coordinator: workflow created — workflowId: ${workflowId}`);
  } catch (err) {
    logger.error(`Coordinator: createWorkflow failed: ${err.message}`);
    // Use a synthetic workflowId so we can still attempt the on-chain steps
    workflowId = `fallback-wf-${Date.now()}`;
    logger.warn(`Coordinator: using fallback workflowId: ${workflowId}`);
  }

  // Step 2: Trigger execution
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

  // Step 3: consumeProof on-chain
  try {
    const consumeTx = await inferenceGuard.consumeProof(
      proposal.executionId,
      await getGasOverrides()
    );
    await consumeTx.wait();
    logger.info(`Coordinator: consumeProof confirmed — executionId: ${proposal.executionId.slice(0, 16)}...`);
  } catch (err) {
    logger.error(`Coordinator: consumeProof failed: ${err.message}`);
    // If it looks like an RPC error, failover and retry once
    if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
      logger.warn('Coordinator: RPC error detected, failing over and retrying consumeProof...');
      rpcFailover.failover();
      initContracts();
      try {
        const consumeTx2 = await inferenceGuard.consumeProof(
          proposal.executionId,
          await getGasOverrides()
        );
        await consumeTx2.wait();
        logger.info('Coordinator: consumeProof retry succeeded after failover');
      } catch (retryErr) {
        logger.error(`Coordinator: consumeProof retry also failed: ${retryErr.message}`);
      }
    }
  }

  // Step 4: incrementExperience on-chain
  try {
    const expTx = await sentinelINFT.incrementExperience(
      INFT_TOKEN_ID,
      await getGasOverrides()
    );
    await expTx.wait();
    logger.info(`Coordinator: incrementExperience confirmed — tokenId: ${INFT_TOKEN_ID}`);
  } catch (err) {
    logger.error(`Coordinator: incrementExperience failed: ${err.message}`);
    if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('timeout')) {
      logger.warn('Coordinator: RPC error detected, failing over and retrying incrementExperience...');
      rpcFailover.failover();
      initContracts();
      try {
        const expTx2 = await sentinelINFT.incrementExperience(
          INFT_TOKEN_ID,
          await getGasOverrides()
        );
        await expTx2.wait();
        logger.info('Coordinator: incrementExperience retry succeeded after failover');
      } catch (retryErr) {
        logger.error(`Coordinator: incrementExperience retry also failed: ${retryErr.message}`);
      }
    }
  }

  return executionResult;
}

// ── Main processing cycle ────────────────────────────────────────────────────

async function processCycle() {
  if (queue.size() === 0) {
    logger.debug('Coordinator: Queue empty, waiting...');
    return;
  }

  const proposal = queue.peek();

  logger.info(
    `Coordinator: processing proposal — type: ${proposal.agentType} ` +
    `priority: ${proposal.priority} ` +
    `executionId: ${proposal.executionId ? proposal.executionId.slice(0, 16) + '...' : 'N/A'}`
  );

  if (proposal.executionId && processedExecutionIds.has(proposal.executionId)) {
    logger.info(
      `Coordinator: Skipping already processed executionId ${proposal.executionId.slice(0, 16)}...`
    );
    queue.pop();
    return;
  }

  // Check if this proposal should be executed
  if (!shouldExecute(proposal)) {
    queue.pop();
    logger.info(`Coordinator: HOLD — discarding proposal type=${proposal.agentType} priority=${proposal.priority}`);
    return;
  }

  // Submit proof first, then validate with a short bounded retry window.
  const proofValid = await ensureProofReady(proposal);

  if (!proofValid) {
    logger.warn(
      `Coordinator: no valid proof for executionId ${proposal.executionId ? proposal.executionId.slice(0, 16) + '...' : 'N/A'}, skipping`
    );
    queue.pop();
    return;
  }

  // Execute with retry
  try {
    const result = await withRetry(
      () => executeProposal(proposal),
      { maxAttempts: 3, baseDelayMs: 1000, label: proposal.executionId ? proposal.executionId.slice(0, 16) : 'proposal' }
    );
    if (proposal.executionId) {
      processedExecutionIds.add(proposal.executionId);
    }
    queue.pop();
    logger.info(
      `Coordinator: proposal executed successfully — type: ${proposal.agentType} ` +
      `result: ${JSON.stringify(result).slice(0, 120)}`
    );
  } catch (err) {
    logger.error(
      `Coordinator: proposal execution failed after all retries — type: ${proposal.agentType} ` +
      `error: ${err.message}`
    );
    // Pop anyway to avoid infinite loop
    queue.pop();
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
  logger.info(`iNFT Token ID:    ${INFT_TOKEN_ID}`);
  logger.info(`Poll interval:    ${COORDINATOR_POLL_MS}ms`);
  logger.info(`MCP enabled:      ${MCP_ENABLED}`);
  logger.info(`x402 enabled:     ${X402_ENABLED}`);
  logger.info('──────────────────────────────────────────────────');

  // Initialize contracts and clients
  initContracts();
  logger.info(`Coordinator wallet: ${wallet.address}`);

  // Attach agent event listeners
  attachYieldAgent();
  attachRiskAgent();

  // Start polling loop
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

module.exports = { main, runCoordinator, processC: processCycle };

if (require.main === module) {
  main();
}
