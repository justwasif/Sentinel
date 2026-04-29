const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "0G\n");

  console.log("Deploying SentinelINFT...");
  const SINFT = await ethers.getContractFactory("SentinelINFT");
  const sinft = await SINFT.deploy();
  await sinft.waitForDeployment();
  const sinftAddr = await sinft.getAddress();
  console.log("SentinelINFT deployed:", sinftAddr);

  console.log("Minting token #0...");
  const mintTx = await sinft.mint(
    deployer.address,
    "0g-storage://sentinel/coordinator-v1",   // Placeholder - Update
    "spark-liquidation-shield-v1"
  );
  await mintTx.wait();
  console.log("Token #0 minted to:", deployer.address);


  console.log("\nDeploying PositionRegistry...");
  const PR = await ethers.getContractFactory("PositionRegistry");
  const pr = await PR.deploy();
  await pr.waitForDeployment();
  const prAddr = await pr.getAddress();
  console.log("PositionRegistry deployed:", prAddr);


  console.log("\nDeploying InferenceGuard...");
  const IG = await ethers.getContractFactory("InferenceGuard");
  const ig = await IG.deploy();
  await ig.waitForDeployment();
  const igAddr = await ig.getAddress();
  console.log("InferenceGuard deployed:", igAddr);


  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE — save these addresses!");
  console.log("=".repeat(60));
  console.log("Network:          0G Galileo Testnet (chainId 16602)");
  console.log("Deployer:        ", deployer.address);
  console.log("SentinelINFT:    ", sinftAddr);
  console.log("PositionRegistry:", prAddr);
  console.log("InferenceGuard:  ", igAddr);
  console.log("Explorer:         https://chainscan-galileo.0g.ai");
  console.log("=".repeat(60));

  const fs = require("fs");
  const addresses = {
    network: "0G Galileo Testnet",
    chainId: 16602,
    deployer: deployer.address,
    SentinelINFT: sinftAddr,
    PositionRegistry: prAddr,
    InferenceGuard: igAddr,
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});