require("dotenv").config();
const { ethers } = require("ethers");
const addresses = require("./deployed-addresses.json");

const INFERENCE_GUARD_ABI = [
  "function submitProof(bytes32 executionId, bytes32 rootHash) external",
];
const coordinator = require("./agents/coordinator/index");
const yieldAgent = require("./yieldAgent");

async function start() {
  console.log("🚀 Starting integrated system...\n");

  coordinator.runCoordinator();
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const inferenceGuard = new ethers.Contract(
    addresses.InferenceGuard,
    INFERENCE_GUARD_ABI,
    wallet,
  );

  // Listen to proposals and auto-submit proof
  yieldAgent.yieldEmitter.on("proposal", async (proposal) => {
    try {
      const rootHash = ethers.keccak256(ethers.toUtf8Bytes("demo-proof"));

      const tx = await inferenceGuard.submitProof(
        proposal.executionId,
        rootHash,
      );

      console.log(
        "✅ Proof submitted:",
        proposal.executionId.slice(0, 20),
        "...",
      );
      await tx.wait();
    } catch (err) {
      console.error("❌ Proof submission failed:", err.message);
    }
  });
  await yieldAgent.main();

  console.log("✅ Coordinator + Yield Agent running together\n");
}

start();
