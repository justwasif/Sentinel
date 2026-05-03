'use strict';

const { ethers } = require('ethers');
const logger = require('../utils/logger');

class RpcFailover {
  /**
   * @param {string[]} rpcUrls - Array of RPC endpoint URLs
   */
  constructor(rpcUrls) {
    if (!Array.isArray(rpcUrls) || rpcUrls.length === 0) {
      throw new Error('RpcFailover: rpcUrls must be a non-empty array');
    }
    this._urls = rpcUrls;
    this._currentIndex = 0;
    logger.debug(`RpcFailover initialized with ${rpcUrls.length} endpoint(s). Primary: ${rpcUrls[0]}`);
  }

  /**
   * Returns the currently active RPC URL.
   * @returns {string}
   */
  get currentUrl() {
    return this._urls[this._currentIndex];
  }

  /**
   * Returns a new JsonRpcProvider connected to the current URL.
   * @returns {ethers.JsonRpcProvider}
   */
  getProvider() {
    return new ethers.JsonRpcProvider(this.currentUrl);
  }

  /**
   * Rotates to the next RPC URL in the list (wraps around).
   */
  failover() {
    const previousUrl = this.currentUrl;
    this._currentIndex = (this._currentIndex + 1) % this._urls.length;
    const nextUrl = this.currentUrl;
    logger.warn(`RpcFailover: switching from ${previousUrl} → ${nextUrl} (index ${this._currentIndex}/${this._urls.length - 1})`);
  }

  /**
   * Returns an ethers Wallet connected to the current provider.
   * @param {string} privateKey
   * @returns {ethers.Wallet}
   */
  getWallet(privateKey) {
    if (!privateKey) {
      throw new Error('RpcFailover.getWallet: privateKey is required');
    }
    const provider = this.getProvider();
    return new ethers.Wallet(privateKey, provider);
  }
}

module.exports = RpcFailover;