const assert = require("assert");
const EventEmitter = require("events");
const Module = require("module");
const { ethers } = require("hardhat");
const realEthersModule = require("ethers");

const realEthers = realEthersModule.ethers || realEthersModule;
const fakeLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function parseEventFromReceipt(receipt, contract, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === eventName) return parsed;
    } catch (_) {
      // Ignore unrelated logs.
    }
  }
  return null;
}

async function deployFixture() {
  const [owner] = await ethers.getSigners();

  const InferenceGuard = await ethers.getContractFactory("InferenceGuard");
  const guard = await InferenceGuard.deploy();
  await guard.waitForDeployment();

  const SentinelINFT = await ethers.getContractFactory("SentinelINFT");
  const inft = await SentinelINFT.deploy();
  await inft.waitForDeployment();
  await (await inft.mint(owner.address, "0g-storage://sentinel/e2e", "strategy-e2e")).wait();

  const PositionRegistry = await ethers.getContractFactory("PositionRegistry");
  const registry = await PositionRegistry.deploy();
  await registry.waitForDeployment();

  const MockUniswapV3Pool = await ethers.getContractFactory("MockUniswapV3Pool");
  const pool = await MockUniswapV3Pool.deploy(0, "WETH", "USDC", 3000);
  await pool.waitForDeployment();

  const lower = -500;
  const upper = 500;
  const registerTx = await registry.registerUniswapPosition(await pool.getAddress(), lower, upper);
  const registerReceipt = await registerTx.wait();
  const registerEvent = parseEventFromReceipt(registerReceipt, registry, "PositionRegistered");

  return {
    owner,
    guard,
    inft,
    registry,
    pool,
    lower,
    upper,
    positionId: registerEvent.args.positionId,
    addresses: {
      network: "hardhat",
      chainId: 31337,
      SentinelINFT: await inft.getAddress(),
      PositionRegistry: await registry.getAddress(),
      InferenceGuard: await guard.getAddress(),
      MockUniswapPool: await pool.getAddress(),
      demoTickLower: lower,
      demoTickUpper: upper,
    },
  };
}

function loadYieldAgentForFixture(fixture) {
  const modulePath = require.resolve("../../yieldAgent.js");
  delete require.cache[modulePath];

  const fakeFs = {
    readFileSync: () => JSON.stringify(fixture.addresses),
  };

  const fakeEthers = {
    JsonRpcProvider: class JsonRpcProvider {},
    Wallet: class Wallet {
      constructor() {
        this.address = fixture.owner.address;
      }
    },
    Contract: class Contract {
      constructor(address) {
        if (address === fixture.addresses.PositionRegistry) return fixture.registry;
        if (address === fixture.addresses.MockUniswapPool) return fixture.pool;
        throw new Error(`Unexpected yieldAgent contract address: ${address}`);
      }
    },
    keccak256: realEthers.keccak256,
    toUtf8Bytes: realEthers.toUtf8Bytes,
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "fs") return fakeFs;
    if (request === "ethers") return { ethers: fakeEthers };
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("../../yieldAgent.js");
  } finally {
    Module._load = originalLoad;
  }
}

async function runYieldCycle(yieldAgent, ownerAddress) {
  const oldPrivateKey = process.env.PRIVATE_KEY;
  const originalSetInterval = global.setInterval;

  process.env.PRIVATE_KEY = "0x" + "11".repeat(32);
  global.setInterval = () => 0;

  try {
    await yieldAgent.main();
  } finally {
    global.setInterval = originalSetInterval;
    if (oldPrivateKey === undefined) delete process.env.PRIVATE_KEY;
    else process.env.PRIVATE_KEY = oldPrivateKey;
  }
}

function loadCoordinatorForFixture(fixture, keeperHubState) {
  const modulePath = require.resolve("../../agents/coordinator/index.js");
  const yieldAgentPath = require.resolve("../../yieldAgent.js");
  const riskAgentPath = require.resolve("../../og-integration/src/agents/risk-agent.ts");
  const originalYieldAgentCache = require.cache[yieldAgentPath];
  const originalRiskAgentCache = require.cache[riskAgentPath];

  delete require.cache[modulePath];

  const fakeYieldEmitter = new EventEmitter();
  const fakeRiskEmitter = new EventEmitter();
  const fakeFs = {
    readFileSync: (file) => {
      if (String(file).endsWith("deployed-addresses.json")) {
        return JSON.stringify(fixture.addresses);
      }
      throw new Error(`Unexpected fs read: ${file}`);
    },
  };

  class FakeRpcFailover {
    getWallet() {
      return {
        address: fixture.owner.address,
        provider: {
          getFeeData: async () => ({
            maxPriorityFeePerGas: realEthers.parseUnits("1", "gwei"),
            maxFeePerGas: realEthers.parseUnits("20", "gwei"),
            gasPrice: realEthers.parseUnits("20", "gwei"),
          }),
        },
      };
    }

    failover() {}
  }

  class FakeKeeperHubClient {
    async createWorkflow(workflowDefinition) {
      keeperHubState.createWorkflowCalls.push(workflowDefinition);
      return { id: "e2e-workflow" };
    }

    async triggerExecution(workflowId, payload) {
      keeperHubState.triggerExecutionCalls.push({ workflowId, payload });
      return { id: "e2e-execution", status: "success" };
    }
  }

  const fakeEthers = {
    ...realEthers,
    Contract: class Contract {
      constructor(address) {
        if (address === fixture.addresses.InferenceGuard) return fixture.guard;
        if (address === fixture.addresses.SentinelINFT) return fixture.inft;
        throw new Error(`Unexpected coordinator contract address: ${address}`);
      }
    },
  };

  const originalLoad = Module._load;
  require.cache[yieldAgentPath] = {
    id: yieldAgentPath,
    filename: yieldAgentPath,
    loaded: true,
    exports: { yieldEmitter: fakeYieldEmitter },
  };
  require.cache[riskAgentPath] = {
    id: riskAgentPath,
    filename: riskAgentPath,
    loaded: true,
    exports: { riskEmitter: fakeRiskEmitter },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "fs") return fakeFs;
    if (request === "ethers") return { ethers: fakeEthers };
    if (request === "../../utils/logger") return fakeLogger;
    if (request === "../../keeperhub/client") return FakeKeeperHubClient;
    if (request === "../../keeperhub/rpcFallover.js") return FakeRpcFailover;
    if (request === "../../keeperhub/x402Payment") return class FakeX402Payment {};
    if (request === "../../keeperhub/retryHandler") return { withRetry: async (fn) => fn() };
    return originalLoad.call(this, request, parent, isMain);
  };

  const originalSetInterval = global.setInterval;
  let scheduled = null;
  global.setInterval = (fn) => {
    scheduled = fn;
    return 1;
  };

  const oldEnv = { ...process.env };
  process.env.PRIVATE_KEY = "0x" + "11".repeat(32);
  process.env.COORDINATOR_POLL_MS = "1";
  process.env.PROOF_RETRY_DELAY_MS = "0";
  process.env.PROOF_RETRY_ATTEMPTS = "1";
  process.env.X402_ENABLED = "false";
  process.env.KEEPERHUB_MCP_ENABLED = "false";

  try {
    const coordinator = require("../../agents/coordinator/index.js");
    return {
      coordinator,
      fakeYieldEmitter,
      getScheduled: () => scheduled,
      restore: () => {
        global.setInterval = originalSetInterval;
        process.env = oldEnv;
        delete require.cache[modulePath];
        if (originalYieldAgentCache) require.cache[yieldAgentPath] = originalYieldAgentCache;
        else delete require.cache[yieldAgentPath];
        if (originalRiskAgentCache) require.cache[riskAgentPath] = originalRiskAgentCache;
        else delete require.cache[riskAgentPath];
      },
    };
  } finally {
    Module._load = originalLoad;
  }
}

describe("E2E simulation", function () {
  it("out-of-range LP position triggers full guardian cycle with mocked KeeperHub", async function () {
    const fixture = await deployFixture();
    const keeperHubState = {
      createWorkflowCalls: [],
      triggerExecutionCalls: [],
    };

    await (await fixture.pool.moveOutOfRange(-900)).wait();

    const yieldAgent = loadYieldAgentForFixture(fixture);
    const emitted = [];
    yieldAgent.yieldEmitter.on("proposal", (proposal) => emitted.push(proposal));
    await runYieldCycle(yieldAgent, fixture.owner.address);

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].agentType, "YIELD");
    assert.equal(emitted[0].positionId, fixture.positionId);

    const coordinatorHarness = loadCoordinatorForFixture(fixture, keeperHubState);
    try {
      await coordinatorHarness.coordinator.runCoordinator();
      coordinatorHarness.fakeYieldEmitter.emit("proposal", emitted[0]);
      await coordinatorHarness.getScheduled()();

      assert.equal(await fixture.guard.isProofValid(emitted[0].executionId), false);
      assert.equal(keeperHubState.createWorkflowCalls.length, 1);
      assert.equal(keeperHubState.triggerExecutionCalls.length, 1);
      assert.equal(keeperHubState.createWorkflowCalls[0].positionId, fixture.positionId);
      assert.equal(keeperHubState.triggerExecutionCalls[0].payload.executionId, emitted[0].executionId);
      assert.equal(await fixture.inft.getExperienceCycles(0), 1n);
    } finally {
      coordinatorHarness.restore();
    }

    await (await fixture.pool.moveInRange(0)).wait();
    const emittedAfterReset = [];
    yieldAgent.yieldEmitter.on("proposal", (proposal) => emittedAfterReset.push(proposal));
    await runYieldCycle(yieldAgent, fixture.owner.address);

    assert.equal(emittedAfterReset.length, 0);
    assert.equal(keeperHubState.createWorkflowCalls.length, 1);
    assert.equal(keeperHubState.triggerExecutionCalls.length, 1);
  });
});
