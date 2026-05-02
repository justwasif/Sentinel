const assert = require("assert");
const Module = require("module");

const fakeLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function loadKeeperHubClient(state) {
  const modulePath = require.resolve("../../keeperhub/client.js");
  delete require.cache[modulePath];

  class FakeMcpClient {
    async isAvailable() {
      state.mcpAvailabilityChecks++;
      return state.mcpAvailable;
    }

    async createWorkflow(workflow) {
      state.mcpCreateWorkflowCalls.push(workflow);
      return { id: "mcp-workflow" };
    }

    async triggerExecution(workflowId, payload) {
      state.mcpTriggerExecutionCalls.push({ workflowId, payload });
      return { id: "mcp-execution" };
    }
  }

  class FakeRestClient {
    async createWorkflow(workflow) {
      state.restCreateWorkflowCalls.push(workflow);
      return { id: "rest-workflow" };
    }

    async triggerExecution(workflowId, payload) {
      state.restTriggerExecutionCalls.push({ workflowId, payload });
      return { id: "rest-execution" };
    }

    async publishToMarketplace(workflowId, metadata) {
      state.restPublishCalls.push({ workflowId, metadata });
      return { id: "listing-1" };
    }
  }

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "./mcpClient") return FakeMcpClient;
    if (request === "./restClient") return FakeRestClient;
    if (request === "../utils/logger") return fakeLogger;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("../../keeperhub/client.js");
  } finally {
    Module._load = originalLoad;
  }
}

function makeState(mcpAvailable) {
  return {
    mcpAvailable,
    mcpAvailabilityChecks: 0,
    mcpCreateWorkflowCalls: [],
    mcpTriggerExecutionCalls: [],
    restCreateWorkflowCalls: [],
    restTriggerExecutionCalls: [],
    restPublishCalls: [],
  };
}

describe("KeeperHubClient routing", function () {
  it("routes to MCP when mcpEnabled is true and MCP is available", async function () {
    const state = makeState(true);
    const KeeperHubClient = loadKeeperHubClient(state);
    const client = new KeeperHubClient({
      apiKey: "test-key",
      baseUrl: "https://keeperhub.test/api",
      mcpEnabled: true,
      mcpPort: 3001,
    });

    await client.createWorkflow({ name: "workflow" });
    await client.triggerExecution("workflow-1", { input: true });

    assert.equal(state.mcpAvailabilityChecks, 2);
    assert.equal(state.mcpCreateWorkflowCalls.length, 1);
    assert.equal(state.mcpTriggerExecutionCalls.length, 1);
    assert.equal(state.restCreateWorkflowCalls.length, 0);
    assert.equal(state.restTriggerExecutionCalls.length, 0);
  });

  it("routes to REST when mcpEnabled is false", async function () {
    const state = makeState(true);
    const KeeperHubClient = loadKeeperHubClient(state);
    const client = new KeeperHubClient({
      apiKey: "test-key",
      baseUrl: "https://keeperhub.test/api",
      mcpEnabled: false,
    });

    await client.createWorkflow({ name: "workflow" });

    assert.equal(state.mcpAvailabilityChecks, 0);
    assert.equal(state.mcpCreateWorkflowCalls.length, 0);
    assert.equal(state.restCreateWorkflowCalls.length, 1);
  });

  it("falls back to REST when MCP is enabled but unavailable", async function () {
    const state = makeState(false);
    const KeeperHubClient = loadKeeperHubClient(state);
    const client = new KeeperHubClient({
      apiKey: "test-key",
      baseUrl: "https://keeperhub.test/api",
      mcpEnabled: true,
    });

    await client.createWorkflow({ name: "workflow" });

    assert.equal(state.mcpAvailabilityChecks, 1);
    assert.equal(state.mcpCreateWorkflowCalls.length, 0);
    assert.equal(state.restCreateWorkflowCalls.length, 1);
  });
});
