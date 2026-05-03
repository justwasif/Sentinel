const assert = require("assert");
const ProposalQueue = require("../../agents/coordinator/proposalQueue");
const { RISK, YIELD, HOLD } = require("../../agents/coordinator/proposalQueue");

describe("ProposalQueue", function () {
  it("push adds a proposal and size increases", function () {
    const queue = new ProposalQueue();

    assert.equal(queue.size(), 0);
    queue.push({ executionId: "a", priority: YIELD, timestamp: 1 });

    assert.equal(queue.size(), 1);
  });

  it("pop returns proposals in priority order", function () {
    const queue = new ProposalQueue();
    queue.push({ executionId: "hold", priority: HOLD, timestamp: 1 });
    queue.push({ executionId: "yield", priority: YIELD, timestamp: 1 });
    queue.push({ executionId: "risk", priority: RISK, timestamp: 1 });

    assert.equal(queue.pop().executionId, "risk");
    assert.equal(queue.pop().executionId, "yield");
    assert.equal(queue.pop().executionId, "hold");
    assert.equal(queue.size(), 0);
  });

  it("pop uses timestamp as a tiebreaker", function () {
    const queue = new ProposalQueue();
    queue.push({ executionId: "later", priority: YIELD, timestamp: 20 });
    queue.push({ executionId: "earlier", priority: YIELD, timestamp: 10 });

    assert.equal(queue.pop().executionId, "earlier");
    assert.equal(queue.pop().executionId, "later");
  });

  it("pop on empty queue returns null and does not throw", function () {
    const queue = new ProposalQueue();

    assert.equal(queue.pop(), null);
    assert.equal(queue.peek(), null);
  });

  it("does not deduplicate duplicate proposals because no dedupe logic exists", function () {
    const queue = new ProposalQueue();
    const proposal = {
      executionId: "same",
      priority: YIELD,
      poolAddress: "0xpool",
      currentTick: 800,
      timestamp: 1,
    };

    queue.push(proposal);
    queue.push({ ...proposal, timestamp: 2 });

    assert.equal(queue.size(), 2);
  });
});
