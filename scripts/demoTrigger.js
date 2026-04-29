/**
 * DEMO TRIGGER SCRIPT
 * ───────────────────
 * Run this live in front of judges to simulate a price crash
 * that moves the LP position out of range.
 *
 * Usage:
 *   Move OUT of range:  npx hardhat run scripts/demoTrigger.js --network galileo
 *   Move back IN range: npx hardhat run scripts/demoTrigger.js --network galileo -- --reset
 */

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));

  const pool = await ethers.getContractAt(
    "MockUniswapV3Pool",
    addresses.MockUniswapPool
  );

  const args = process.argv.slice(2);
  const reset = args.includes("--reset");

  const currentTick = await pool.getCurrentTick();
  console.log("Current tick:", Number(currentTick));

  if (reset) {
    // Move back IN range (tick = 0, which is within [-500, 500])
    console.log("\n🔄 Moving tick BACK IN RANGE (tick = 0)...");
    const tx = await pool.moveInRange(0);
    await tx.wait();
    console.log("✅ Tick is now 0 — position is IN RANGE");
    console.log("   Yield Agent will see: ✅ IN RANGE on next cycle");
  } else {
    // Move OUT of range — tick = 800, outside [-500, 500]
    console.log("\n💥 Simulating ETH price crash — moving tick OUT OF RANGE (tick = 800)...");
    const tx = await pool.moveOutOfRange(800);
    await tx.wait();
    console.log("⚠️  Tick is now 800 — position is OUT OF RANGE");
    console.log("   Yield Agent will detect this within 30 seconds");
    console.log("   Watch the agent terminal for the rebalance proposal!");
  }

  // Verify the change
  const newTick = await pool.getCurrentTick();
  const lower = addresses.demoTickLower;
  const upper = addresses.demoTickUpper;
  const inRange = Number(newTick) >= lower && Number(newTick) <= upper;

  console.log("\nPool state after change:");
  console.log("  Current tick:", Number(newTick));
  console.log("  Range: [", lower, ",", upper, "]");
  console.log("  Status:", inRange ? "✅ IN RANGE" : "⚠️  OUT OF RANGE");
  console.log("\nExplorer:", `https://chainscan-galileo.0g.ai/address/${addresses.MockUniswapPool}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});