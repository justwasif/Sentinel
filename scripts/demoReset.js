const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json"));
  const pool = await ethers.getContractAt("MockUniswapV3Pool", addresses.MockUniswapPool);

  const currentTick = await pool.getCurrentTick();
  console.log("Current tick:", Number(currentTick));
  console.log("Moving tick back IN RANGE (tick = 0)...");

  const tx = await pool.moveInRange(0);
  await tx.wait();

  const newTick = await pool.getCurrentTick();
  console.log("Tick is now:", Number(newTick), "- position is IN RANGE");
  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${addresses.MockUniswapPool}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});