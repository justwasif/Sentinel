const assert = require("assert");
const { ethers } = require("hardhat");

const ZERO_BYTES32 = "0x" + "00".repeat(32);

async function parseEvent(receiptPromise, contract, eventName) {
  const receipt = await (await receiptPromise).wait();
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === eventName) return parsed;
    } catch (_) {
      // Ignore logs emitted by other contracts.
    }
  }
  return null;
}

describe("Sentinel contracts", function () {
  let owner;
  let other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
  });

  describe("InferenceGuard", function () {
    let guard;

    beforeEach(async function () {
      const InferenceGuard = await ethers.getContractFactory("InferenceGuard");
      guard = await InferenceGuard.deploy();
      await guard.waitForDeployment();
    });

    it("submitProof stores the rootHash against the executionId", async function () {
      const executionId = ethers.id("execution-1");
      const rootHash = ethers.id("root-1");

      await (await guard.submitProof(executionId, rootHash)).wait();

      assert.equal(await guard.isProofValid(executionId), true);
      assert.equal(await guard.getRootHash(executionId), rootHash);
      assert.equal(await guard.getRootHash(ethers.id("missing")), ZERO_BYTES32);
    });

    it("submitProof emits ProofSubmitted", async function () {
      const executionId = ethers.id("execution-event");
      const rootHash = ethers.id("root-event");

      const event = await parseEvent(
        guard.submitProof(executionId, rootHash),
        guard,
        "ProofSubmitted",
      );

      assert.ok(event, "ProofSubmitted event was not emitted");
      assert.equal(event.args.executionId, executionId);
      assert.equal(event.args.rootHash, rootHash);
      assert.equal(event.args.submitter, owner.address);
    });

    it("consumeProof marks proof as consumed", async function () {
      const executionId = ethers.id("execution-consume");
      const rootHash = ethers.id("root-consume");

      await (await guard.submitProof(executionId, rootHash)).wait();
      await (await guard.consumeProof(executionId)).wait();

      assert.equal(await guard.isProofValid(executionId), false);
      const proof = await guard.getProof(executionId);
      assert.equal(proof.consumed, true);
    });

    it("consumeProof on non-existent proof reverts cleanly", async function () {
      await assert.rejects(
        guard.consumeProof(ethers.id("missing-proof")),
      );
    });

    it("double-consuming the same proof reverts cleanly", async function () {
      const executionId = ethers.id("execution-double-consume");
      const rootHash = ethers.id("root-double-consume");

      await (await guard.submitProof(executionId, rootHash)).wait();
      await (await guard.consumeProof(executionId)).wait();

      await assert.rejects(
        guard.consumeProof(executionId),
      );
    });
  });

  describe("SentinelINFT", function () {
    let inft;

    beforeEach(async function () {
      const SentinelINFT = await ethers.getContractFactory("SentinelINFT");
      inft = await SentinelINFT.deploy();
      await inft.waitForDeployment();
    });

    it("mint creates a token with correct initial state", async function () {
      const storagePointer = "0g-storage://sentinel/test";
      const strategyFingerprint = "strategy-test-v1";

      await (await inft.mint(owner.address, storagePointer, strategyFingerprint)).wait();

      assert.equal(await inft.ownerOf(0), owner.address);
      assert.equal(await inft.getExperienceCycles(0), 0n);
      assert.equal(await inft.getStoragePointer(0), storagePointer);

      const metadata = await inft.getFullMetadata(0);
      assert.equal(metadata.storagePointer, storagePointer);
      assert.equal(metadata.strategyFingerprint, strategyFingerprint);
      assert.equal(metadata.active, true);
    });

    it("incrementExperience increases experienceCycles by 1", async function () {
      await (await inft.mint(owner.address, "0g-storage://sentinel/test", "strategy-test-v1")).wait();

      await (await inft.incrementExperience(0)).wait();
      assert.equal(await inft.getExperienceCycles(0), 1n);

      await (await inft.incrementExperience(0)).wait();
      assert.equal(await inft.getExperienceCycles(0), 2n);
    });

    it("incrementExperience called by non-owner/non-authorized caller reverts", async function () {
      await (await inft.mint(owner.address, "0g-storage://sentinel/test", "strategy-test-v1")).wait();

      await assert.rejects(
        inft.connect(other).incrementExperience(0),
        /caller not authorized/,
      );
    });

    it("tokenURI metadata includes storagePointer reference", async function () {
      const storagePointer = "0g-storage://sentinel/metadata-test";

      await (await inft.mint(owner.address, storagePointer, "strategy-test-v1")).wait();
      const tokenURI = await inft.tokenURI(0);

      assert.ok(tokenURI.includes(storagePointer));
      assert.ok(tokenURI.includes("Experience Cycles"));
    });
  });

  describe("PositionRegistry", function () {
    let registry;

    beforeEach(async function () {
      const PositionRegistry = await ethers.getContractFactory("PositionRegistry");
      registry = await PositionRegistry.deploy();
      await registry.waitForDeployment();
    });

    it("registerLendingPosition stores and returns position correctly", async function () {
      const positionAddress = other.address;
      const protocolSpark = 0;
      const threshold = ethers.parseEther("1.2");

      const event = await parseEvent(
        registry.registerLendingPosition(positionAddress, protocolSpark, threshold),
        registry,
        "PositionRegistered",
      );

      assert.ok(event, "PositionRegistered event was not emitted");
      const positionId = event.args.positionId;
      const position = await registry.positions(positionId);

      assert.equal(position.id, positionId);
      assert.equal(position.positionAddress, positionAddress);
      assert.equal(position.protocol, BigInt(protocolSpark));
      assert.equal(position.healthThreshold, threshold);
      assert.equal(position.tickLower, 0n);
      assert.equal(position.tickUpper, 0n);
      assert.equal(position.active, true);
      assert.equal(await registry.positionOwner(positionId), owner.address);
    });

    it("registerUniswapPosition stores and returns a Uniswap V3 LP position", async function () {
      const poolAddress = other.address;
      const tickLower = -500;
      const tickUpper = 500;

      const event = await parseEvent(
        registry.registerUniswapPosition(poolAddress, tickLower, tickUpper),
        registry,
        "PositionRegistered",
      );

      assert.ok(event, "PositionRegistered event was not emitted");
      const positionId = event.args.positionId;
      const position = await registry.positions(positionId);

      assert.equal(position.id, positionId);
      assert.equal(position.positionAddress, poolAddress);
      assert.equal(position.protocol, 2n);
      assert.equal(position.healthThreshold, 0n);
      assert.equal(position.tickLower, BigInt(tickLower));
      assert.equal(position.tickUpper, BigInt(tickUpper));
      assert.equal(position.active, true);
    });

    it("only the position owner can update or remove their position", async function () {
      const event = await parseEvent(
        registry.registerLendingPosition(other.address, 0, ethers.parseEther("1.2")),
        registry,
        "PositionRegistered",
      );
      const positionId = event.args.positionId;

      await assert.rejects(
        registry.connect(other).updateHealthThreshold(positionId, ethers.parseEther("1.3")),
        /not owner/,
      );
      await assert.rejects(
        registry.connect(other).removePosition(positionId),
        /not owner/,
      );

      await (await registry.updateHealthThreshold(positionId, ethers.parseEther("1.4"))).wait();
      await (await registry.removePosition(positionId)).wait();
      assert.equal(await registry.isPositionActive(positionId), false);
    });

    it("fetching a non-existent position returns zero values", async function () {
      const position = await registry.positions(ethers.id("missing-position"));

      assert.equal(position.id, ZERO_BYTES32);
      assert.equal(position.positionAddress, ethers.ZeroAddress);
      assert.equal(position.healthThreshold, 0n);
      assert.equal(position.active, false);
    });
  });

  describe("MockUniswapV3Pool", function () {
    let pool;

    beforeEach(async function () {
      const MockUniswapV3Pool = await ethers.getContractFactory("MockUniswapV3Pool");
      pool = await MockUniswapV3Pool.deploy(0, "WETH", "USDC", 3000);
      await pool.waitForDeployment();
    });

    it("slot0 returns the current tick and sqrtPriceX96", async function () {
      const slot0 = await pool.slot0();

      assert.equal(slot0.sqrtPriceX96, 1n << 96n);
      assert.equal(slot0.tick, 0n);
      assert.equal(slot0.unlocked, true);
    });

    it("setTick changes the tick returned by slot0", async function () {
      await (await pool.setTick(777, "test move")).wait();

      const slot0 = await pool.slot0();
      assert.equal(slot0.tick, 777n);
    });

    it("non-owner cannot call setTick", async function () {
      await assert.rejects(
        pool.connect(other).setTick(123, "not owner"),
        /OwnableUnauthorizedAccount/,
      );
    });
  });
});
