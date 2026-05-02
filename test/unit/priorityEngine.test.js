const assert = require("assert");
const {
  classifyProposal,
  enrichProposal,
  shouldExecute,
} = require("../../agents/coordinator/priorityEngine");
const { RISK, YIELD, HOLD } = require("../../agents/coordinator/proposalQueue");

describe("priorityEngine", function () {
  it("RISK proposals outrank YIELD and HOLD proposals", function () {
    const riskPriority = classifyProposal({ agentType: "RISK" });
    const yieldPriority = classifyProposal({ agentType: "YIELD" });
    const holdPriority = classifyProposal({ agentType: "UNKNOWN" });

    assert.equal(riskPriority, RISK);
    assert.equal(yieldPriority, YIELD);
    assert.equal(holdPriority, HOLD);
    assert.ok(riskPriority < yieldPriority);
    assert.ok(yieldPriority < holdPriority);
  });

  it("YIELD proposals have a defined numeric priority", function () {
    const priority = classifyProposal({ agentType: "YIELD" });

    assert.equal(typeof priority, "number");
    assert.equal(priority, YIELD);
  });

  it("priority is a positive finite number", function () {
    for (const agentType of ["RISK", "YIELD", "OTHER", undefined]) {
      const priority = classifyProposal({ agentType });
      assert.equal(Number.isFinite(priority), true);
      assert.ok(priority > 0);
    }
  });

  it("enrichProposal preserves proposal fields and sets pending status", function () {
    const raw = {
      agentType: "YIELD",
      executionId: "0xabc",
      timestamp: 123,
    };

    const enriched = enrichProposal(raw, YIELD);

    assert.equal(enriched.agentType, raw.agentType);
    assert.equal(enriched.executionId, raw.executionId);
    assert.equal(enriched.priority, YIELD);
    assert.equal(enriched.status, "PENDING");
    assert.equal(typeof enriched.enrichedAt, "number");
  });

  it("shouldExecute approves RISK and YIELD, rejects HOLD", function () {
    assert.equal(shouldExecute({ priority: RISK }), true);
    assert.equal(shouldExecute({ priority: YIELD }), true);
    assert.equal(shouldExecute({ priority: HOLD }), false);
    assert.equal(shouldExecute(null), false);
  });
});
