/**
 * Deploys MockUniswapV3Pool and registers a position in PositionRegistry.
 *
 * Demo setup:
 *   - Tick range: [-500, 500]  (our LP position covers this range)
 *   - Initial tick: 0          (starts IN range — agent sees ✅)
 *   - During demo: call setTick(600) → agent sees ⚠️ OUT OF RANGE
 */

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));

  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "0G\n");

  // ── Deploy Mock Pool ───────────────────────────────────────────────────────
  console.log("Deploying MockUniswapV3Pool...");

  const TICK_LOWER   = -500;  // Our LP range lower bound
  const TICK_UPPER   =  500;  // Our LP range upper bound
  const INITIAL_TICK =    0;  // Starts IN range

  const MockPool = await ethers.getContractFactory("MockUniswapV3Pool");
  const pool = await MockPool.deploy(
    INITIAL_TICK,
    "WETH",    // token0
    "USDC",    // token1
    3000       // 0.3% fee tier
  );
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("MockUniswapV3Pool deployed:", poolAddr);
  console.log("Initial tick:", INITIAL_TICK, "(IN range ✅)");

  // ── Register position in PositionRegistry ─────────────────────────────────
  console.log("\nRegistering Uniswap position in PositionRegistry...");

  const registry = await ethers.getContractAt(
    "PositionRegistry",
    addresses.PositionRegistry
  );

  const tx = await registry.registerUniswapPosition(
    poolAddr,
    TICK_LOWER,
    TICK_UPPER
  );
  const receipt = await tx.wait();

  // Pull positionId from event
  const event = receipt.logs.find(log => {
    try {
      return registry.interface.parseLog(log)?.name === "PositionRegistered";
    } catch { return false; }
  });
  const parsed = registry.interface.parseLog(event);
  const positionId = parsed.args.positionId;

  console.log("Position registered!");
  console.log("Position ID:", positionId);
  console.log("Pool address:", poolAddr);
  console.log("Tick range: [", TICK_LOWER, ",", TICK_UPPER, "]");

  // ── Save updated addresses ─────────────────────────────────────────────────
  addresses.MockUniswapPool = poolAddr;
  addresses.demoPositionId  = positionId;
  addresses.demoTickLower   = TICK_LOWER;
  addresses.demoTickUpper   = TICK_UPPER;
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("MOCK POOL READY");
  console.log("=".repeat(60));
  console.log("MockUniswapPool:", poolAddr);
  console.log("Position ID:    ", positionId);
  console.log("Tick range:      [", TICK_LOWER, ",", TICK_UPPER, "]");
  console.log("Current tick:    ", INITIAL_TICK, "(IN range)");
  console.log("\nTo trigger OUT OF RANGE during demo:");
  console.log("  npx hardhat run scripts/demoTrigger.js --network galileo");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});