'use strict';

// Priority constants — lower number = higher priority
const RISK  = 1;
const YIELD = 2;
const HOLD  = 3;

class ProposalQueue {
  constructor() {
    this._queue = [];
  }

  /**
   * Adds a proposal to the queue.
   * @param {Object} proposal
   */
  push(proposal) {
    this._queue.push(proposal);
  }

  /**
   * Removes and returns the highest-priority proposal.
   * Sorts by priority number ascending (1 = highest), then by timestamp ascending for ties.
   * @returns {Object|null} The highest-priority proposal, or null if empty.
   */
  pop() {
    if (this._queue.length === 0) return null;
    this._sort();
    return this._queue.shift();
  }

  /**
   * Returns the highest-priority proposal without removing it.
   * @returns {Object|null}
   */
  peek() {
    if (this._queue.length === 0) return null;
    this._sort();
    return this._queue[0];
  }

  /**
   * Returns the number of proposals in the queue.
   * @returns {number}
   */
  size() {
    return this._queue.length;
  }

  /**
   * Empties the queue.
   */
  clear() {
    this._queue = [];
  }

  /**
   * Returns a sorted copy of the queue (does not mutate).
   * @returns {Object[]}
   */
  toArray() {
    const copy = [...this._queue];
    copy.sort((a, b) => {
      const pA = a.priority != null ? a.priority : HOLD;
      const pB = b.priority != null ? b.priority : HOLD;
      if (pA !== pB) return pA - pB;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
    return copy;
  }

  /**
   * Sorts the internal queue in place.
   * @private
   */
  _sort() {
    this._queue.sort((a, b) => {
      const pA = a.priority != null ? a.priority : HOLD;
      const pB = b.priority != null ? b.priority : HOLD;
      if (pA !== pB) return pA - pB;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }
}

module.exports = ProposalQueue;
module.exports.RISK  = RISK;
module.exports.YIELD = YIELD;
module.exports.HOLD  = HOLD;