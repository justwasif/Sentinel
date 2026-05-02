require("dotenv").config();
const { ethers } = require("ethers");
const EventEmitter = require("events");
const fs = require("fs");


const RPC_URL          = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY      = process.env.PRIVATE_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.YIELD_POLL_MS || "15000");
const PROPOSAL_COOLDOWN_MS = parseInt(process.env.YIELD_PROPOSAL_COOLDOWN_MS || "30000");

let addresses;
try {
  addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
} catch {
  console.error("[YieldAgent] ERROR: deployed-addresses.json not found.");
  console.error("             Run deploy.js and deployMockPool.js first.");
  process.exit(1);
}

const POSITION_REGISTRY_ABI = [
  "function getUserPositionIds(address user) view returns (bytes32[])",
  "function positions(bytes32) view returns (bytes32 id, address positionAddress, uint8 protocol, uint256 healthThreshold, int24 tickLower, int24 tickUpper, bool active, uint256 registeredAt)",
  "function getActivePositions(address user) view returns (tuple(bytes32 id, address positionAddress, uint8 protocol, uint256 healthThreshold, int24 tickLower, int24 tickUpper, bool active, uint256 registeredAt)[])",
];

const UNISWAP_V3_POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function getPoolInfo() view returns (string token0, string token1, uint24 fee, int24 tick)",
];

const Protocol = { SPARK: 0, AAVE: 1, UNISWAP_V3: 2, OTHER: 3 };

const yieldEmitter = new EventEmitter();
const proposals    = [];
const lastProposalAt = new Map();

let cycleCount = 0;

async function main() {
  if (!PRIVATE_KEY) {
    console.error("[YieldAgent] ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

  const registry = new ethers.Contract(
    addresses.PositionRegistry,
    POSITION_REGISTRY_ABI,
    provider
  );

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         SENTINEL — YIELD AGENT STARTED          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("Wallet:           ", wallet.address);
  console.log("PositionRegistry: ", addresses.PositionRegistry);
  console.log("Mock Pool:        ", addresses.MockUniswapPool || "not deployed yet");
  console.log("Poll interval:    ", POLL_INTERVAL_MS / 1000, "seconds");
  console.log("──────────────────────────────────────────────────\n");

  await runCycle(provider, registry, wallet.address);
  setInterval(() => runCycle(provider, registry, wallet.address), POLL_INTERVAL_MS);
}

async function runCycle(provider, registry, monitoredUser) {
  cycleCount++;
  const timestamp = new Date().toLocaleTimeString();

  console.log(`\n┌─ Cycle #${cycleCount} @ ${timestamp} ${"─".repeat(30)}`);

  try {
    const positionIds = await registry.getUserPositionIds(monitoredUser);

    if (positionIds.length === 0) {
      console.log("│  No positions registered yet.");
      console.log("│  Run deployMockPool.js to register a demo position.");
      console.log(`└${"─".repeat(50)}`);
      return;
    }

    let checkedCount = 0;

    for (const posId of positionIds) {
      const pos = await registry.positions(posId);

      if (Number(pos.protocol) !== Protocol.UNISWAP_V3) continue;
      if (!pos.active) continue;

      checkedCount++;
      await checkPosition(provider, pos, posId);
    }

    if (checkedCount === 0) {
      console.log("│  No active Uniswap V3 positions to monitor.");
    }

  } catch (err) {
    console.error("│ Cycle error:", err.message);
  }

  console.log(`└${"─".repeat(50)}`);
}

async function checkPosition(provider, pos, posId) {
  const poolAddress = pos.positionAddress;
  const tickLower   = Number(pos.tickLower);
  const tickUpper   = Number(pos.tickUpper);
  const shortId     = posId.slice(0, 10) + "...";

  try {
    const pool   = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
    const slot0  = await pool.slot0();
    const currentTick = Number(slot0.tick);

    let poolLabel = poolAddress.slice(0, 10) + "...";
    try {
      const info = await pool.getPoolInfo();
      poolLabel = `${info.token0}/${info.token1} (${Number(info.fee) / 10000}% fee)`;
    } catch { }

    const inRange = currentTick >= tickLower && currentTick <= tickUpper;
    const distanceFromRange = inRange ? 0
      : currentTick < tickLower
        ? tickLower - currentTick
        : currentTick - tickUpper;

    console.log(`│`);
    console.log(`│  Position: ${shortId}`);
    console.log(`│  Pool:     ${poolLabel}`);
    console.log(`│  Range:    [${tickLower}, ${tickUpper}]`);
    console.log(`│  Tick:     ${currentTick}  →  ${inRange ? "IN RANGE (earning fees)" : `OUT OF RANGE by ${distanceFromRange} ticks`}`);

    if (!inRange) {
      const lastEmittedAt = lastProposalAt.get(posId) || 0;
      if (Date.now() - lastEmittedAt < PROPOSAL_COOLDOWN_MS) {
        console.log(`│  Proposal cooldown active for ${shortId} (${Math.ceil((PROPOSAL_COOLDOWN_MS - (Date.now() - lastEmittedAt)) / 1000)}s remaining)`);
        return;
      }

      const proposal = buildProposal(posId, poolAddress, poolLabel, currentTick, tickLower, tickUpper, distanceFromRange);
      lastProposalAt.set(posId, Date.now());
      proposals.push(proposal);

      console.log(`│`);
      console.log(`│  REBALANCE PROPOSAL EMITTED`);
      console.log(`│     Action:    ${proposal.action}`);
      console.log(`│     Priority:  ${proposal.priority}`);
      console.log(`│     Reasoning: ${proposal.reasoning}`);
      console.log(`│     New range: [${proposal.suggestedRange.tickLower}, ${proposal.suggestedRange.tickUpper}]`);
      console.log(`│     ExecID:    ${proposal.executionId.slice(0, 20)}...`);
      console.log(`│     Status:    proposal emitted`);

      yieldEmitter.emit("proposal", proposal);
    }

  } catch (err) {
    console.error(`│  Error reading pool ${poolAddress.slice(0,10)}...:`, err.message);
  }
}

function buildProposal(positionId, poolAddress, poolLabel, currentTick, tickLower, tickUpper, distanceFromRange) {
  const rangeWidth     = tickUpper - tickLower;
  const suggestedLower = currentTick - Math.floor(rangeWidth / 2);
  const suggestedUpper = currentTick + Math.ceil(rangeWidth / 2);
  const priority       = distanceFromRange > 200 ? "HIGH" : "MEDIUM";

  return {
    agentType:        "YIELD",
    action:           "REBALANCE_LP",
    priority,
    positionId,
    poolAddress,
    poolLabel,
    currentTick,
    currentRange:     { tickLower, tickUpper },
    suggestedRange:   { tickLower: suggestedLower, tickUpper: suggestedUpper },
    distanceFromRange,
    reasoning: `LP position is ${distanceFromRange} ticks outside range [${tickLower}, ${tickUpper}]. ` +
               `Currently earning zero fees. Recommend rebalancing to [${suggestedLower}, ${suggestedUpper}] ` +
               `centered around current tick ${currentTick}.`,
    timestamp:   Date.now(),
    executionId: ethers.keccak256(
                   ethers.toUtf8Bytes(`YIELD-${positionId}-${Date.now()}`)
                 ),
  };
}

module.exports = { yieldEmitter, proposals, main };

if (require.main === module) {
  main().catch(console.error);
}
