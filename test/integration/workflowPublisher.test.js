const assert = require("assert");
const fs = require("fs");
const Module = require("module");
const path = require("path");

const sparkWorkflowPath = path.resolve(__dirname, "../../workflows/sparkLiquidationShield.json");
const lpWorkflowPath = path.resolve(__dirname, "../../workflows/lpRangeRebalancer.json");
const fakeLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function loadPublisherWithMocks(state) {
  const modulePath = require.resolve("../../workflows/workflowPublisher.js");
  delete require.cache[modulePath];

  class FakeKeeperHubClient {
    async createWorkflow(workflowDefinition) {
      state.createWorkflowCalls.push(workflowDefinition);
      return { id: `workflow-${state.createWorkflowCalls.length}` };
    }

    async publishToMarketplace(workflowId, metadata) {
      state.publishCalls.push({ workflowId, metadata });
      return { listingId: `listing-${state.publishCalls.length}` };
    }
  }

  const fakeFs = {
    readFileSync: (file, encoding) => {
      if (String(file).endsWith("deployed-addresses.json")) {
        return JSON.stringify({
          network: "hardhat-test",
          SentinelINFT: "0x0000000000000000000000000000000000000001",
          PositionRegistry: "0x0000000000000000000000000000000000000002",
          InferenceGuard: "0x0000000000000000000000000000000000000003",
        });
      }
      return fs.readFileSync(file, encoding);
    },
    writeFileSync: (file, contents) => {
      state.writeCalls.push({ file, contents });
    },
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "fs") return fakeFs;
    if (request === "../keeperhub/client") return FakeKeeperHubClient;
    if (request === "../utils/logger") return fakeLogger;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("../../workflows/workflowPublisher.js");
  } finally {
    Module._load = originalLoad;
  }
}

function assertWorkflowShape(workflow) {
  assert.equal(typeof workflow.name, "string");
  assert.equal(typeof workflow.description, "string");
  assert.equal(typeof workflow.trigger, "object");
  assert.equal(Array.isArray(workflow.actions), true);
  assert.ok(workflow.actions.length > 0);
}

describe("workflowPublisher", function () {
  it("publishWorkflows reads Spark and LP workflow JSON files and creates workflows", async function () {
    const state = {
      createWorkflowCalls: [],
      publishCalls: [],
      writeCalls: [],
    };
    const { publishWorkflows } = loadPublisherWithMocks(state);

    const result = await publishWorkflows();

    assert.equal(state.createWorkflowCalls.length, 2);
    assert.equal(state.createWorkflowCalls[0].name, "sentinel-spark-liquidation-shield");
    assert.equal(state.createWorkflowCalls[1].name, "sentinel-lp-range-rebalancer");
    assert.equal(result.sparkLiquidationShield, "workflow-1");
    assert.equal(result.lpRangeRebalancer, "workflow-2");
  });

  it("publishWorkflows publishes both workflows to marketplace with metadata", async function () {
    const state = {
      createWorkflowCalls: [],
      publishCalls: [],
      writeCalls: [],
    };
    const { publishWorkflows } = loadPublisherWithMocks(state);

    await publishWorkflows();

    assert.equal(state.publishCalls.length, 2);
    assert.equal(state.publishCalls[0].workflowId, "workflow-1");
    assert.equal(state.publishCalls[0].metadata.name, "sentinel-spark-liquidation-shield");
    assert.equal(state.publishCalls[0].metadata.payment.method, "x402");
    assert.equal(state.publishCalls[1].workflowId, "workflow-2");
    assert.equal(state.publishCalls[1].metadata.name, "sentinel-lp-range-rebalancer");
  });

  it("publishWorkflows captures address updates without writing the real deployed-addresses.json", async function () {
    const state = {
      createWorkflowCalls: [],
      publishCalls: [],
      writeCalls: [],
    };
    const { publishWorkflows } = loadPublisherWithMocks(state);

    await publishWorkflows();

    assert.equal(state.writeCalls.length, 1);
    const updatedAddresses = JSON.parse(state.writeCalls[0].contents);
    assert.equal(updatedAddresses.workflowId_sparkLiquidationShield, "workflow-1");
    assert.equal(updatedAddresses.workflowId_lpRangeRebalancer, "workflow-2");
  });

  it("workflow JSONs have required KeeperHub fields", function () {
    const spark = JSON.parse(fs.readFileSync(sparkWorkflowPath, "utf8"));
    const lp = JSON.parse(fs.readFileSync(lpWorkflowPath, "utf8"));

    assertWorkflowShape(spark);
    assertWorkflowShape(lp);
    assert.equal(spark.type, "LIQUIDATION_PROTECTION");
    assert.equal(lp.type, "LP_REBALANCE");
  });
});
