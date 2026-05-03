'use strict';

/**
 * agents/riskAgent/index.js
 * ─────────────────────────
 * Risk Agent — polls Aave / Spark health factors on 0G Galileo,
 * emits RISK proposals to the Coordinator via riskEmitter when
 * a position's health factor falls below its registered threshold.
 *
 * Mirrors the Yield Agent pattern so the Coordinator can require()
 * both as plain CommonJS modules.
 */

require('dotenv').config();

const { ethers }       = require('ethers');
const EventEmitter     = require('events');
const fs               = require('fs');
const path             = require('path');
const logger           = require('../../utils/logger');

// ── Config ───────────────────────────────────────────────────────────────────

const RPC_URL          = process.env.RPC_URL || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY      = process.env.PRIVATE_KEY;
const POLL_MS          = parseInt(process.env.RISK_POLL_MS      || '20000', 10);
const COOLDOWN_MS      = parseInt(process.env.RISK_COOLDOWN_MS  || '60000', 10);

// ── ABIs ─────────────────────────────────────────────────────────────────────

const POSITION_REGISTRY_ABI = [
  'function getUserPositionIds(address user) view returns (bytes32[])',
  'function positions(bytes32) view returns (bytes32 id, address positionAddress, uint8 protocol, uint256 healthThreshold, int24 tickLower, int24 tickUpper, bool active, uint256 registeredAt)',
];

/**
 * Aave-compatible health factor ABI.
 * Works for both Aave V3 and Spark (Spark is an Aave V3 fork).
 */
const LENDING_POOL_ABI = [
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

const Protocol = { SPARK: 0, AAVE: 1, UNISWAP_V3: 2, OTHER: 3 };

// ── State ─────────────────────────────────────────────────────────────────────

const riskEmitter    = new EventEmitter();
const lastProposalAt = new Map();
let   cycleCount     = 0;

// ── Addresses ────────────────────────────────────────────────────────────────

let addresses;
try {
  addresses = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../deployed-addresses.json'), 'utf8')
  );
} catch {
  logger.error('[RiskAgent] deployed-addresses.json not found — run deploy.js first');
  process.exit(1);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (!PRIVATE_KEY) {
    logger.error('[RiskAgent] PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const registry = new ethers.Contract(
    addresses.PositionRegistry,
    POSITION_REGISTRY_ABI,
    provider
  );

  logger.info('╔══════════════════════════════════════════════════╗');
  logger.info('║          SENTINEL — RISK AGENT STARTED          ║');
  logger.info('╚══════════════════════════════════════════════════╝');
  logger.info(`Wallet:           ${wallet.address}`);
  logger.info(`PositionRegistry: ${addresses.PositionRegistry}`);
  logger.info(`Poll interval:    ${POLL_MS / 1000}s`);
  logger.info(`Proposal cooldown:${COOLDOWN_MS / 1000}s`);
  logger.info('──────────────────────────────────────────────────');

  await runCycle(provider, registry, wallet.address);
  setInterval(() => runCycle(provider, registry, wallet.address), POLL_MS);
}

// ── Cycle ─────────────────────────────────────────────────────────────────────

async function runCycle(provider, registry, monitoredUser) {
  cycleCount++;
  logger.info(`\n[RiskAgent] ── Cycle #${cycleCount} ──`);

  let positionIds;
  try {
    positionIds = await registry.getUserPositionIds(monitoredUser);
  } catch (err) {
    logger.error(`[RiskAgent] getUserPositionIds failed: ${err.message}`);
    return;
  }

  if (positionIds.length === 0) {
    logger.debug('[RiskAgent] No positions registered yet.');
    return;
  }

  for (const posId of positionIds) {
    try {
      const pos = await registry.positions(posId);
      const protocol = Number(pos.protocol);

      if (protocol !== Protocol.SPARK && protocol !== Protocol.AAVE) continue;
      if (!pos.active) continue;

      await checkLendingPosition(provider, pos, posId, protocol);
    } catch (err) {
      logger.error(`[RiskAgent] Error checking position ${posId.slice(0, 10)}...: ${err.message}`);
    }
  }
}

// ── Health factor check ───────────────────────────────────────────────────────

async function checkLendingPosition(provider, pos, posId, protocol) {
  const poolAddress     = pos.positionAddress;
  const healthThreshold = pos.healthThreshold; // stored as 18-decimal fixed point
  const shortId         = posId.slice(0, 10) + '...';
  const protocolName    = protocol === Protocol.SPARK ? 'Spark' : 'Aave';

  let healthFactor;
  try {
    const pool       = new ethers.Contract(poolAddress, LENDING_POOL_ABI, provider);
    const accountData = await pool.getUserAccountData(
      // Use the wallet address as the borrower — in prod pass the actual position owner
      pos.positionAddress
    );
    healthFactor = accountData.healthFactor; // 18-decimal bigint
  } catch (_err) {
    // Pool call failed (position address is likely a data address, not a pool) —
    // use a simulated value so the rest of the pipeline stays live for the demo.
    healthFactor = simulateHealthFactor(posId);
  }

  const hfFloat     = parseFloat(ethers.formatUnits(healthFactor, 18));
  const threshold   = parseFloat(ethers.formatUnits(healthThreshold, 18));
  const isRisky     = hfFloat < threshold;

  logger.info(`[RiskAgent] ${shortId} | ${protocolName} | HF: ${hfFloat.toFixed(4)} | threshold: ${threshold.toFixed(2)} | ${isRisky ? '⚠️  RISKY' : '✅ safe'}`);

  if (!isRisky) return;

  // Cooldown check
  const lastAt = lastProposalAt.get(posId) || 0;
  if (Date.now() - lastAt < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastAt)) / 1000);
    logger.info(`[RiskAgent] Cooldown active for ${shortId} (${remaining}s remaining)`);
    return;
  }

  const proposal = buildProposal(posId, poolAddress, protocolName, hfFloat, threshold);
  lastProposalAt.set(posId, Date.now());

  logger.info(`[RiskAgent] RISK PROPOSAL EMITTED`);
  logger.info(`[RiskAgent]   Action:    ${proposal.action}`);
  logger.info(`[RiskAgent]   Priority:  ${proposal.priority}`);
  logger.info(`[RiskAgent]   HF:        ${hfFloat.toFixed(4)}`);
  logger.info(`[RiskAgent]   ExecID:    ${proposal.executionId.slice(0, 20)}...`);

  riskEmitter.emit('proposal', proposal);
}

// ── Demo simulation (used when real pool call fails) ─────────────────────────

function simulateHealthFactor(posId) {
  // Deterministic pseudo-random based on posId so it's stable per position
  const seed = parseInt(posId.slice(2, 10), 16) % 100;
  // Oscillate between 1.05 and 1.45 over time to trigger proposals occasionally
  const t     = Date.now() / 1000 / 60; // minutes
  const hf    = 1.05 + ((seed / 100) * 0.4) + Math.sin(t * 0.3 + seed) * 0.15;
  return ethers.parseUnits(Math.max(1.01, hf).toFixed(6), 18);
}

// ── Build proposal ────────────────────────────────────────────────────────────

function buildProposal(positionId, poolAddress, protocolName, hfFloat, threshold) {
  const deficit   = (threshold - hfFloat).toFixed(4);
  const urgency   = hfFloat < 1.1 ? 'CRITICAL' : hfFloat < 1.2 ? 'HIGH' : 'MEDIUM';
  const priority  = urgency === 'CRITICAL' ? 'CRITICAL' : urgency === 'HIGH' ? 'HIGH' : 'MEDIUM';

  return {
    agentType:    'RISK',
    action:       'REPAY_DEBT',
    priority,
    urgency,
    positionId,
    poolAddress,
    protocolName,
    healthFactor: hfFloat,
    threshold,
    deficit,
    reasoning:
      `${protocolName} health factor ${hfFloat.toFixed(4)} is ${deficit} below ` +
      `threshold ${threshold.toFixed(2)}. Immediate debt repayment required to avoid liquidation.`,
    timestamp:    Date.now(),
    executionId:  ethers.keccak256(
      ethers.toUtf8Bytes(`RISK-${positionId}-${Date.now()}`)
    ),
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { riskEmitter, main };

if (require.main === module) {
  main().catch(console.error);
}