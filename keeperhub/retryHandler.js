'use strict';

const logger = require('../utils/logger');

/**
 * Executes fn() with exponential backoff retry logic.
 *
 * @param {Function} fn - Async function to retry. Should return a Promise.
 * @param {Object} options
 * @param {number} options.maxAttempts - Total number of attempts (default 3)
 * @param {number} options.baseDelayMs - Base delay in ms, doubles each attempt (default 1000)
 * @param {string} options.label - Human-readable label for log messages (default 'operation')
 * @returns {Promise<any>} - Resolves with fn()'s result, or rejects after all attempts fail
 */
async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    label = 'operation',
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`[${label}] Attempt ${attempt}/${maxAttempts}`);
      const result = await fn();
      if (attempt > 1) {
        logger.info(`[${label}] Succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        logger.error(`[${label}] All ${maxAttempts} attempts failed. Last error: ${err.message}`);
      } else {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`[${label}] Attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Pre-configured retry with standard Sentinel defaults.
 * Usage: await defaultRetry(() => someAsyncCall(), 'myLabel')
 */
async function defaultRetry(fn, label = 'operation') {
  return withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000, label });
}

module.exports = { withRetry, defaultRetry };