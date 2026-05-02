const assert = require("assert");
const Module = require("module");

const fakeLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function loadRestClientWithAxios(fakeAxios) {
  const modulePath = require.resolve("../../keeperhub/restClient.js");
  delete require.cache[modulePath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "axios") return fakeAxios;
    if (request === "../utils/logger") return fakeLogger;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require("../../keeperhub/restClient.js");
  } finally {
    Module._load = originalLoad;
  }
}

describe("KeeperHubRestClient", function () {
  it("createWorkflow sends POST to /v1/workflows with correct payload shape and Authorization header", async function () {
    const calls = [];
    let axiosConfig;
    const fakeAxios = {
      create: (config) => {
        axiosConfig = config;
        return {
          post: async (url, body) => {
            calls.push({ url, body });
            return { data: { id: "workflow-1" } };
          },
        };
      },
    };
    const RestClient = loadRestClientWithAxios(fakeAxios);
    const client = new RestClient({
      apiKey: "test-key",
      baseUrl: "https://keeperhub.test/api",
    });

    const workflow = {
      name: "workflow",
      description: "test workflow",
      trigger: { type: "manual" },
      actions: [{ type: "noop" }],
    };
    const result = await client.createWorkflow(workflow);

    assert.equal(result.id, "workflow-1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/v1/workflows");
    assert.deepEqual(calls[0].body, workflow);
    assert.equal(axiosConfig.headers.Authorization, "Bearer test-key");
  });

  it("triggerExecution sends the correct workflowId and input payload", async function () {
    const calls = [];
    const fakeAxios = {
      create: () => ({
        post: async (url, body) => {
          calls.push({ url, body });
          return { data: { executionId: "exec-1", status: "success" } };
        },
      }),
    };
    const RestClient = loadRestClientWithAxios(fakeAxios);
    const client = new RestClient({ apiKey: "test-key", baseUrl: "https://keeperhub.test/api" });

    await client.triggerExecution("workflow-123", { executionId: "exec-1", input: true });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/v1/workflows/workflow-123/execute");
    assert.deepEqual(calls[0].body, { executionId: "exec-1", input: true });
  });

  it("publishToMarketplace sends the workflow to the marketplace endpoint", async function () {
    const calls = [];
    const fakeAxios = {
      create: () => ({
        post: async (url, body) => {
          calls.push({ url, body });
          return { data: { listingId: "listing-1" } };
        },
      }),
    };
    const RestClient = loadRestClientWithAxios(fakeAxios);
    const client = new RestClient({ apiKey: "test-key", baseUrl: "https://keeperhub.test/api" });

    await client.publishToMarketplace("workflow-123", {
      name: "Spark Shield",
      description: "Liquidation protection",
      payment: { method: "x402", currency: "USDC", maxAmount: "1.00" },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/v1/marketplace/publish");
    assert.equal(calls[0].body.workflowId, "workflow-123");
    assert.equal(calls[0].body.name, "Spark Shield");
    assert.equal(calls[0].body.description, "Liquidation protection");
    assert.equal(calls[0].body.payment.maxAmount, "1.00");
  });

  it("handles a 4xx response without crashing the process", async function () {
    const fakeAxios = {
      create: () => ({
        post: async () => {
          const err = new Error("bad request");
          err.response = { status: 400, data: { error: "invalid" } };
          throw err;
        },
      }),
    };
    const RestClient = loadRestClientWithAxios(fakeAxios);
    const client = new RestClient({ apiKey: "test-key", baseUrl: "https://keeperhub.test/api" });

    await assert.rejects(
      client.createWorkflow({ name: "bad" }),
      /HTTP 400/,
    );
  });

  it("handles a 5xx response without crashing the process", async function () {
    const fakeAxios = {
      create: () => ({
        post: async () => {
          const err = new Error("unavailable");
          err.response = { status: 503, data: { error: "service unavailable" } };
          throw err;
        },
      }),
    };
    const RestClient = loadRestClientWithAxios(fakeAxios);
    const client = new RestClient({ apiKey: "test-key", baseUrl: "https://keeperhub.test/api" });

    await assert.rejects(
      client.triggerExecution("workflow-123", {}),
      /HTTP 503/,
    );
  });
});
