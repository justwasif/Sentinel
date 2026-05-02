const assert = require("assert");
const EventEmitter = require("events");
const Module = require("module");
const realEthersModule = require("ethers");
const addresses = require("../../deployed-addresses.json");

const realEthers = realEthersModule.ethers || realEthersModule;
const fakeLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function tx(hash = "0x" + "12".repeat(32)) {
  return {
    hash,
    wait: async () => ({ hash, blockNumber: 1 }),
  };
}

function makeProposal() {
  return {
    agentType: "YIELD",
    action: "REBALANCE_LP",
    priority: "HIGH",
    positionId: realEthers.id(`position-${Date.now()}`),
    poolAddress: "0x0000000000000000000000000000000000000aAa",
    currentTick: 900,
    currentRange: { tickLower: -500, tickUpper: 500 },
    suggestedRange: { tickLower: 400, tickUpper: 1400 },
    distanceFromRange: 400,
    reasoning: "Out of range",
    timestamp: Date.now(),
    executionId: realEthers.id(`execution-${Date.now()}`),
  };
}

function loadCoordinator(options = {}) {
  const state = {
    yieldEmitter: new EventEmitter(),
    riskEmitter: new EventEmitter(),
    scheduled: null,
    proofValid: Boolean(options.proofInitiallyValid),
    proofValidAfterSubmit: options.proofValidAfterSubmit !== false,
    submitProofCalls: [],
    consumeProofCalls: [],
    incrementExperienceCalls: [],
    createWorkflowCalls: [],
    triggerExecutionCalls: [],
    createWorkflowThrows: Boolean(options.createWorkflowThrows),
    triggerExecutionThrows: Boolean(options.triggerExecutionThrows),
  };

  const fakeWallet = {
    address: "0x0000000000000000000000000000000000000bBb",
    provider: {
      getFeeData: async () => ({
        maxPriorityFeePerGas: realEthers.parseUnits("1", "gwei"),
        maxFeePerGas: realEthers.parseUnits("20", "gwei"),
        gasPrice: realEthers.parseUnits("20", "gwei"),
      }),
    },
  };

  const fakeInferenceGuard = {
    isProofValid: async () => state.proofValid,
    submitProof: async (executionId, rootHash) => {
      state.submitProofCalls.push({ executionId, rootHash });
      if (state.proofValidAfterSubmit) state.proofValid = true;
      return tx("0x" + "34".repeat(32));
    },
    consumeProof: async (executionId) => {
      state.consumeProofCalls.push(executionId);
      state.proofValid = false;
      return tx("0x" + "56".repeat(32));
    },
  };

  const fakeSentinelINFT = {
    incrementExperience: async (tokenId) => {
      state.incrementExperienceCalls.push(tokenId);
      return tx("0x" + "78".repeat(32));
    },
  };

  class FakeKeeperHubClient {
    async createWorkflow(workflowDefinition) {
      state.createWorkflowCalls.push(workflowDefinition);
      if (state.createWorkflowThrows) {
        throw new Error("KeeperHub create failed");
      }
      return { id: "workflow-1" };
    }

    async triggerExecution(workflowId, payload) {
      state.triggerExecutionCalls.push({ workflowId, payload });
      if (state.triggerExecutionThrows) {
        throw new Error("KeeperHub trigger failed");
      }
      return { id: "execution-1", status: "success" };
    }
  }

  class FakeRpcFailover {
    getWallet() {
      return fakeWallet;
    }

    failover() {}
  }

  const fakeEthers = {
    ...realEthers,
    Contract: class Contract {
      constructor(address) {
        if (address === addresses.InferenceGuard) return fakeInferenceGuard;
        if (address === addresses.SentinelINFT) return fakeSentinelINFT;
        throw new Error(`Unexpected contract address: ${address}`);
      }
    },
  };

  const coordinatorPath = require.resolve("../../agents/coordinator/index.js");
  const yieldAgentPath = require.resolve("../../yieldAgent.js");
  const riskAgentPath = require.resolve("../../og-integration/src/agents/risk-agent.ts");
  const originalYieldAgentCache = require.cache[yieldAgentPath];
  const originalRiskAgentCache = require.cache[riskAgentPath];

  delete require.cache[coordinatorPath];
  require.cache[yieldAgentPath] = {
    id: yieldAgentPath,
    filename: yieldAgentPath,
    loaded: true,
    exports: { yieldEmitter: state.yieldEmitter },
  };
  require.cache[riskAgentPath] = {
    id: riskAgentPath,
    filename: riskAgentPath,
    loaded: true,
    exports: { riskEmitter: state.riskEmitter },
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "ethers") return { ethers: fakeEthers };
    if (request === "../../utils/logger") return fakeLogger;
    if (request === "../../keeperhub/client") return FakeKeeperHubClient;
    if (request === "../../keeperhub/rpcFallover.js") return FakeRpcFailover;
    if (request === "../../keeperhub/x402Payment") return class FakeX402Payment {};
    if (request === "../../keeperhub/retryHandler") {
      return { withRetry: async (fn) => fn() };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const originalSetInterval = global.setInterval;
  global.setInterval = (fn) => {
    state.scheduled = fn;
    return 1;
  };

  const oldEnv = { ...process.env };
  process.env.PRIVATE_KEY = "0x" + "11".repeat(32);
  process.env.COORDINATOR_POLL_MS = "1";
  process.env.PROOF_RETRY_DELAY_MS = "0";
  process.env.PROOF_RETRY_ATTEMPTS = options.proofRetryAttempts || "1";
  process.env.X402_ENABLED = "false";
  process.env.KEEPERHUB_MCP_ENABLED = "false";

  try {
    state.coordinator = require("../../agents/coordinator/index.js");
  } finally {
    Module._load = originalLoad;
  }

  state.restore = () => {
    global.setInterval = originalSetInterval;
    process.env = oldEnv;
    delete require.cache[coordinatorPath];
    if (originalYieldAgentCache) require.cache[yieldAgentPath] = originalYieldAgentCache;
    else delete require.cache[yieldAgentPath];
    if (originalRiskAgentCache) require.cache[riskAgentPath] = originalRiskAgentCache;
    else delete require.cache[riskAgentPath];
  };

  return state;
}

async function runProposalThroughCoordinator(state, proposal = makeProposal()) {
  await state.coordinator.runCoordinator();
  assert.equal(typeof state.scheduled, "function", "coordinator did not schedule process loop");

  state.yieldEmitter.emit("proposal", proposal);
  await state.scheduled();

  return proposal;
}

describe("coordinator", function () {
  it("receives a YIELD proposal and calls submitProof on InferenceGuard", async function () {
    const state = loadCoordinator();
    try {
      const proposal = await runProposalThroughCoordinator(state);

      assert.equal(state.submitProofCalls.length, 1);
      assert.equal(state.submitProofCalls[0].executionId, proposal.executionId);
      assert.match(state.submitProofCalls[0].rootHash, /^0x[0-9a-fA-F]{64}$/);
    } finally {
      state.restore();
    }
  });

  it("calls KeeperHub createWorkflow and triggerExecution after proof submission", async function () {
    const state = loadCoordinator();
    try {
      const proposal = await runProposalThroughCoordinator(state);

      assert.equal(state.createWorkflowCalls.length, 1);
      assert.equal(state.createWorkflowCalls[0].executionId, proposal.executionId);
      assert.equal(state.triggerExecutionCalls.length, 1);
      assert.equal(state.triggerExecutionCalls[0].workflowId, "workflow-1");
      assert.equal(state.triggerExecutionCalls[0].payload.executionId, proposal.executionId);
    } finally {
      state.restore();
    }
  });

  it("calls incrementExperience on SentinelINFT after successful execution", async function () {
    const state = loadCoordinator();
    try {
      await runProposalThroughCoordinator(state);

      assert.deepEqual(state.incrementExperienceCalls, [0]);
    } finally {
      state.restore();
    }
  });

  it("does not increment experience if proof validation fails", async function () {
    const state = loadCoordinator({
      proofValidAfterSubmit: false,
      proofRetryAttempts: "0",
    });
    try {
      await runProposalThroughCoordinator(state);

      assert.equal(state.createWorkflowCalls.length, 0);
      assert.equal(state.triggerExecutionCalls.length, 0);
      assert.equal(state.incrementExperienceCalls.length, 0);
    } finally {
      state.restore();
    }
  });

  it("handles KeeperHub failure gracefully without throwing", async function () {
    const state = loadCoordinator({ createWorkflowThrows: true, triggerExecutionThrows: true });
    try {
      await assert.doesNotReject(runProposalThroughCoordinator(state));

      assert.equal(state.createWorkflowCalls.length, 1);
      assert.equal(state.triggerExecutionCalls.length, 1);
      assert.equal(state.consumeProofCalls.length, 1);
      assert.equal(state.incrementExperienceCalls.length, 1);
    } finally {
      state.restore();
    }
  });
});
