const assert = require("assert");
const Module = require("module");
const realEthersModule = require("ethers");

const realEthers = realEthersModule.ethers || realEthersModule;

function loadYieldAgentWithTick(currentTick) {
  const modulePath = require.resolve("../../yieldAgent.js");
  delete require.cache[modulePath];

  const positionId = realEthers.id(`position-${currentTick}-${Date.now()}`);
  const poolAddress = "0x0000000000000000000000000000000000000aAa";
  const fakePosition = {
    id: positionId,
    positionAddress: poolAddress,
    protocol: 2,
    healthThreshold: 0n,
    tickLower: -500,
    tickUpper: 500,
    active: true,
    registeredAt: 1n,
  };

  const fakeRegistry = {
    getUserPositionIds: async () => [positionId],
    positions: async () => fakePosition,
  };

  const fakePool = {
    slot0: async () => ({
      sqrtPriceX96: 1n << 96n,
      tick: currentTick,
      observationIndex: 0,
      observationCardinality: 1,
      observationCardinalityNext: 1,
      feeProtocol: 0,
      unlocked: true,
    }),
    getPoolInfo: async () => ({
      token0: "WETH",
      token1: "USDC",
      fee: 3000,
      tick: currentTick,
    }),
  };

  const fakeEthers = {
    JsonRpcProvider: class JsonRpcProvider {},
    Wallet: class Wallet {
      constructor() {
        this.address = "0x0000000000000000000000000000000000000bBb";
      }
    },
    Contract: class Contract {
      constructor(_address, abi) {
        if (abi.some((entry) => entry.includes("getUserPositionIds"))) {
          return fakeRegistry;
        }
        return fakePool;
      }
    },
    keccak256: realEthers.keccak256,
    toUtf8Bytes: realEthers.toUtf8Bytes,
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "ethers") {
      return { ethers: fakeEthers };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return {
      yieldAgent: require("../../yieldAgent.js"),
      positionId,
      poolAddress,
    };
  } finally {
    Module._load = originalLoad;
  }
}

async function runSingleCycle(yieldAgent) {
  const originalPrivateKey = process.env.PRIVATE_KEY;
  const originalSetInterval = global.setInterval;

  process.env.PRIVATE_KEY = "0x" + "11".repeat(32);
  global.setInterval = () => 0;

  try {
    await yieldAgent.main();
  } finally {
    global.setInterval = originalSetInterval;
    if (originalPrivateKey === undefined) {
      delete process.env.PRIVATE_KEY;
    } else {
      process.env.PRIVATE_KEY = originalPrivateKey;
    }
  }
}

describe("yieldAgent", function () {
  it("when pool tick is within [tickLower, tickUpper], no YIELD proposal is emitted", async function () {
    const { yieldAgent } = loadYieldAgentWithTick(0);
    const emitted = [];
    yieldAgent.yieldEmitter.on("proposal", (proposal) => emitted.push(proposal));

    await runSingleCycle(yieldAgent);

    assert.equal(emitted.length, 0);
  });

  it("when pool tick is below tickLower, a YIELD rebalance proposal is emitted", async function () {
    const { yieldAgent, poolAddress } = loadYieldAgentWithTick(-900);
    const emitted = [];
    yieldAgent.yieldEmitter.on("proposal", (proposal) => emitted.push(proposal));

    await runSingleCycle(yieldAgent);

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].agentType, "YIELD");
    assert.equal(emitted[0].action, "REBALANCE_LP");
    assert.equal(emitted[0].poolAddress, poolAddress);
    assert.equal(emitted[0].currentTick, -900);
  });

  it("when pool tick is above tickUpper, a YIELD rebalance proposal is emitted", async function () {
    const { yieldAgent } = loadYieldAgentWithTick(900);
    const emitted = [];
    yieldAgent.yieldEmitter.on("proposal", (proposal) => emitted.push(proposal));

    await runSingleCycle(yieldAgent);

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].agentType, "YIELD");
    assert.equal(emitted[0].currentTick, 900);
    assert.deepEqual(emitted[0].currentRange, { tickLower: -500, tickUpper: 500 });
  });

  it("proposal object shape is correct for coordinator consumption", async function () {
    const { yieldAgent, positionId, poolAddress } = loadYieldAgentWithTick(800);
    const emitted = [];
    yieldAgent.yieldEmitter.on("proposal", (proposal) => emitted.push(proposal));

    await runSingleCycle(yieldAgent);

    const proposal = emitted[0];
    assert.equal(proposal.agentType, "YIELD");
    assert.equal(proposal.action, "REBALANCE_LP");
    assert.equal(proposal.positionId, positionId);
    assert.equal(proposal.poolAddress, poolAddress);
    assert.equal(proposal.currentTick, 800);
    assert.deepEqual(proposal.currentRange, { tickLower: -500, tickUpper: 500 });
    assert.equal(typeof proposal.timestamp, "number");
    assert.match(proposal.executionId, /^0x[0-9a-fA-F]{64}$/);
    assert.equal(typeof proposal.reasoning, "string");
  });
});
