'use strict';

/**
 * runSystem.js
 * ────────────
 * Starts the full Sentinel swarm:
 *   1. Swarm Coordinator (listens for proposals)
 *   2. Yield Agent (monitors LP tick range)
 *   3. Risk Agent  (monitors lending health factors)
 *
 * For every proposal emitted by either agent the coordinator:
 *   a) auto-submits a 0G DA proof (via InferenceGuard.submitProof)
 *   b) validates the proof
 *   c) calls KeeperHub to execute the action
 *   d) calls incrementExperience on the iNFT
 *
 * Usage:
 *   node runSystem.js
 */

require('dotenv').config();

const { ethers }    = require('ethers');
const fs            = require('fs');
const logger        = require('./utils/logger');
const addresses     = JSON.parse(fs.readFileSync('./deployed-addresses.json', 'utf8'));

const INFERENCE_GUARD_ABI = [
  'function submitProof(bytes32 executionId, bytes32 rootHash) external',
];

const coordinator = require('./agents/coordinator/index');
const yieldAgent  = require('./yieldAgent');
const riskAgent   = require('./agents/riskAgent/index');

async function start() {
  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║         SENTINEL — FULL SYSTEM STARTING         ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info(`SentinelINFT:     ${addresses.SentinelINFT}`);
  logger.info(`PositionRegistry: ${addresses.PositionRegistry}`);
  logger.info(`InferenceGuard:   ${addresses.InferenceGuard}`);
  logger.info(`MockUSDC:         ${addresses.MockUSDC || 'not deployed — run deployUSDC.js'}`);
  logger.info('──────────────────────────────────────────────────');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai');
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const inferenceGuard = new ethers.Contract(
    addresses.InferenceGuard,
    INFERENCE_GUARD_ABI,
    wallet
  );

  // Auto-submit proof for every proposal from any agent
  async function autoSubmitProof(proposal) {
    try {
      const rootHash = ethers.keccak256(ethers.toUtf8Bytes(
        JSON.stringify({ executionId: proposal.executionId, action: proposal.action })
      ));
      const tx = await inferenceGuard.submitProof(proposal.executionId, rootHash);
      logger.info(`[System] Proof submitted for ${proposal.agentType} — ${proposal.executionId.slice(0, 16)}... tx: ${tx.hash}`);
      await tx.wait();
    } catch (err) {
      if (!err.message.includes('already exists')) {
        logger.error(`[System] Proof submission failed: ${err.message}`);
      }
    }
  }

  yieldAgent.yieldEmitter.on('proposal', autoSubmitProof);
  riskAgent.riskEmitter.on('proposal',   autoSubmitProof);

  // Start all three processes
  coordinator.runCoordinator();
  riskAgent.main();
  await yieldAgent.main();

  logger.info('✅ Coordinator + Yield Agent + Risk Agent running');
}

start().catch((err) => {
  logger.error(`[System] Fatal: ${err.message}`);
  process.exit(1);
});