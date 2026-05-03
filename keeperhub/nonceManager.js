'use strict';

/**
 * NonceManager — serialises all on-chain transactions through a single
 * pending-nonce counter so concurrent callers never reuse the same nonce.
 *
 * Auto-retries up to 3 times when a stale nonce is detected (caused by
 * external transactions — risk agent, previous run, etc. — mining between
 * our init() call and the actual send).
 *
 * Usage:
 *   const nm = new NonceManager(wallet);
 *   await nm.init();
 *   const receipt = await nm.send(nonce => contract.method(...args, { nonce }));
 */

const logger = require('../utils/logger');

class NonceManager {
  /** @param {import('ethers').Wallet} wallet */
  constructor(wallet) {
    this._wallet = wallet;
    this._nonce  = null;
    this._lock   = Promise.resolve();
  }

  async init() {
    this._nonce = await this._wallet.getNonce('pending');
    logger.info(`NonceManager: initialised — starting nonce ${this._nonce}`);
  }

  async reset() {
    this._nonce = await this._wallet.getNonce('pending');
    logger.warn(`NonceManager: reset — nonce is now ${this._nonce}`);
  }

  /**
   * @param {(nonce: number) => Promise<import('ethers').TransactionResponse>} txFactory
   * @returns {Promise<import('ethers').TransactionReceipt>}
   */
  async send(txFactory) {
    this._lock = this._lock.then(() => this._doSend(txFactory, 1));
    return this._lock;
  }

  async _doSend(txFactory, attempt) {
    if (this._nonce === null) await this.init();

    const nonce = this._nonce;
    this._nonce += 1;

    try {
      logger.debug(`NonceManager: sending tx nonce ${nonce} (attempt ${attempt}/3)`);
      const tx      = await txFactory(nonce);
      const receipt = await tx.wait();
      logger.debug(`NonceManager: confirmed — hash ${receipt.hash} nonce ${nonce}`);
      return receipt;
    } catch (err) {
      const isNonceError =
        err.message.includes('nonce too low') ||
        err.message.includes('nonce has already been used') ||
        err.code === 'NONCE_EXPIRED';

      if (isNonceError && attempt < 3) {
        logger.warn(
          `NonceManager: nonce ${nonce} stale (attempt ${attempt}/3) — resyncing and retrying`
        );
        await this.reset();
        return this._doSend(txFactory, attempt + 1);
      }

      if (isNonceError) {
        logger.error(`NonceManager: nonce stale after 3 attempts — giving up on nonce ${nonce}`);
        await this.reset();
      } else {
        this._nonce = nonce;
      }

      throw err;
    }
  }
}

module.exports = NonceManager;