'use strict';

const { ethers } = require('ethers');
const logger = require('../utils/logger');

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

class X402Payment {
  /**
   * @param {Object} config
   * @param {ethers.Wallet} config.wallet - Connected ethers wallet
   * @param {string} config.usdcContractAddress - USDC ERC20 contract address
   * @param {boolean} config.enabled - Whether x402 payments are enabled
   */
  constructor({ wallet, usdcContractAddress, enabled }) {
    this._wallet = wallet;
    this._usdcContractAddress = usdcContractAddress;
    this._enabled = enabled === true;
  }

  /**
   * Approves a USDC payment to a spender.
   *
   * If x402 is disabled (either via constructor or X402_ENABLED env var),
   * returns a fallback approval object immediately.
   *
   * @param {bigint|string|number} amount - Amount in USDC base units (6 decimals)
   * @param {string} spender - Address to approve
   * @returns {Promise<{method: string, approved: boolean, txHash?: string}>}
   */
  async approvePayment(amount, spender) {
    const x402EnvEnabled = process.env.X402_ENABLED !== 'false' && process.env.X402_ENABLED !== '0';

    if (!this._enabled || !x402EnvEnabled) {
      logger.info('X402Payment: x402 disabled, using fallback approval');
      return { method: 'fallback', approved: true };
    }

    try {
      logger.info(`X402Payment: approving ${amount} USDC to ${spender} via x402`);

      const usdc = new ethers.Contract(this._usdcContractAddress, ERC20_ABI, this._wallet);

      // Check current allowance
      const currentAllowance = await usdc.allowance(this._wallet.address, spender);
      logger.debug(`X402Payment: current allowance for ${spender}: ${currentAllowance.toString()}`);

      const tx = await usdc.approve(spender, amount);
      logger.info(`X402Payment: approve tx submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`X402Payment: approve confirmed in block ${receipt.blockNumber}`);

      return {
        method: 'x402',
        txHash: receipt.hash,
        approved: true,
      };
    } catch (err) {
      logger.error(`X402Payment: approval failed: ${err.message}`);
      throw new Error(`X402Payment.approvePayment failed: ${err.message}`);
    }
  }
}

module.exports = X402Payment;