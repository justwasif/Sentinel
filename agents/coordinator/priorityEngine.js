'use strict';

const { RISK, YIELD, HOLD } = require('./proposalQueue');

/**
 * Classifies a proposal into a numeric priority.
 *
 * @param {Object} proposal - Raw proposal from an agent
 * @returns {number} Priority constant (RISK=1, YIELD=2, HOLD=3)
 */
function classifyProposal(proposal) {
  if (!proposal || !proposal.agentType) return HOLD;

  switch (proposal.agentType.toUpperCase()) {
    case 'RISK':
      return RISK;
    case 'YIELD':
      return YIELD;
    default:
      return HOLD;
  }
}

/**
 * Enriches a proposal with priority metadata and sets status to PENDING.
 *
 * @param {Object} proposal - Raw proposal
 * @param {number} priority - Priority value from classifyProposal()
 * @returns {Object} Enriched proposal
 */
function enrichProposal(proposal, priority) {
  return {
    ...proposal,
    priority,
    enrichedAt: Date.now(),
    status: 'PENDING',
  };
}

/**
 * Determines whether a proposal should be executed immediately.
 *
 * RISK proposals always execute.
 * YIELD proposals always execute.
 * HOLD proposals are discarded.
 *
 * @param {Object} proposal - Enriched proposal with .priority set
 * @returns {boolean}
 */
function shouldExecute(proposal) {
  if (!proposal) return false;

  switch (proposal.priority) {
    case RISK:
      return true;
    case YIELD:
      return true;
    case HOLD:
    default:
      return false;
  }
}

module.exports = { classifyProposal, enrichProposal, shouldExecute };