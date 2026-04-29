require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL           = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY       = process.env.PRIVATE_KEY;
const POLL_INTERVAL_MS  = parseInt(process.env.YIELD_POLL_MS || "30000");


const addresses = require("../deployed-addresses.json");

const POSITION_REGISTRY_ABI = [
  "function getUserPositionIds(address user) view returns (bytes32[])",
  "function positions(bytes32) view returns (bytes32 id, address positionAddress, uint8 protocol, uint256 healthThreshold, int24 tickLower, int24 tickUpper, bool active, uint256 registeredAt)",
];

const UNISWAP_V3_POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
];

const Protocol = { SPARK: 0, AAVE: 1, UNISWAP_V3: 2, OTHER: 3 };

const proposals = [];

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

  console.log("[YieldAgent] Started. Wallet:", wallet.address);
  console.log("[YieldAgent] PositionRegistry:", addresses.PositionRegistry);
  console.log("[YieldAgent] Poll interval:", POLL_INTERVAL_MS / 1000, "seconds\n");

  await runCycle(provider, registry, wallet.address);
  setInterval(() => runCycle(provider, registry, wallet.address), POLL_INTERVAL_MS);
}

async function runCycle(provider, registry, monitoredUser) {
  const timestamp = new Date().toISOString();
  console.log(`[YieldAgent][${timestamp}] Running cycle...`);

  try {
    const positionIds = await registry.getUserPositionIds(monitoredUser);
    console.log(`[YieldAgent] Found ${positionIds.length} positions`);

    for (const posId of positionIds) {
      const pos = await registry.positions(posId);

      if (Number(pos.protocol) !== Protocol.UNISWAP_V3) continue;
      if (!pos.active) continue;

      await checkPosition(provider, pos, posId);
    }
  } catch (err) {
    console.error("[YieldAgent] Cycle error:", err.message);
  }
}

async function checkPosition(provider, pos, posId) {
  const poolAddress = pos.positionAddress;
  const tickLower   = Number(pos.tickLower);
  const tickUpper   = Number(pos.tickUpper);

  try {
    const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
    const slot0 = await pool.slot0();
    const currentTick = Number(slot0.tick);

    const inRange = currentTick >= tickLower && currentTick <= tickUpper;

    console.log(`[YieldAgent] Position ${posId.slice(0, 10)}...`);
    console.log(`  Pool:         ${poolAddress}`);
    console.log(`  Current tick: ${currentTick}`);
    console.log(`  Range:        [${tickLower}, ${tickUpper}]`);
    console.log(`  Status:       ${inRange ? "IN RANGE" : "OUT OF RANGE — proposing rebalance"}`);

    if (!inRange) {
      const proposal = buildRebalanceProposal(posId, poolAddress, currentTick, tickLower, tickUpper);
      proposals.push(proposal);
      console.log(`[YieldAgent] Proposal emitted:`, JSON.stringify(proposal, null, 2));

      emitProposal(proposal);
    }
  } catch (err) {
    console.error(`[YieldAgent] Error checking pool ${poolAddress}:`, err.message);
  }
}

function buildRebalanceProposal(positionId, poolAddress, currentTick, tickLower, tickUpper) {
  const distanceFromRange = currentTick < tickLower
    ? tickLower - currentTick
    : currentTick - tickUpper;

  const rangeWidth = tickUpper - tickLower;
  const suggestedLower = currentTick - Math.floor(rangeWidth / 2);
  const suggestedUpper = currentTick + Math.ceil(rangeWidth / 2);

  return {
    agentType:        "YIELD",
    action:           "REBALANCE_LP",
    priority:         distanceFromRange > 1000 ? "HIGH" : "MEDIUM",
    positionId:       positionId,
    poolAddress:      poolAddress,
    currentTick:      currentTick,
    currentRange:     { tickLower, tickUpper },
    suggestedRange:   { tickLower: suggestedLower, tickUpper: suggestedUpper },
    distanceFromRange,
    reasoning:        `LP position is ${distanceFromRange} ticks out of range. ` +
                      `Earning zero fees. Suggest rebalancing to [${suggestedLower}, ${suggestedUpper}].`,
    timestamp:        Date.now(),
    executionId:      ethers.keccak256(
                        ethers.toUtf8Bytes(`YIELD-${positionId}-${Date.now()}`)
                      ),
  };
}

const EventEmitter = require("events");
const yieldEmitter = new EventEmitter();

function emitProposal(proposal) {
  yieldEmitter.emit("proposal", proposal);
}

module.exports = { yieldEmitter, proposals, main };

if (require.main === module) {
  main().catch(console.error);
}