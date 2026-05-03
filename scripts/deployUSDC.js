'use strict';

/**
 * scripts/deployUSDC.js
 * ---------------------
 * Deploys MockUSDC to 0G Galileo testnet and saves address to
 * deployed-addresses.json so every other module picks it up automatically.
 *
 * Usage:
 *   npx hardhat run scripts/deployUSDC.js --network galileo
 */

const { ethers } = require('hardhat');
const fs          = require('fs');
const path        = require('path');

const ADDRESSES_PATH = path.resolve(__dirname, '../deployed-addresses.json');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying MockUSDC...');
  console.log('Deployer:  ', deployer.address);
  console.log('Balance:   ', ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  ), '0G\n');

  const MockUSDC = await ethers.getContractFactory('MockUSDC');
  const usdc     = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const usdcAddr = await usdc.getAddress();
  const supply   = await usdc.totalSupply();

  console.log('MockUSDC deployed:', usdcAddr);
  console.log('Initial supply:   ', ethers.formatUnits(supply, 6), 'USDC');
  console.log('Explorer:         ', `https://chainscan-galileo.0g.ai/address/${usdcAddr}`);

  // ── Persist into deployed-addresses.json ──────────────────────────────────
  let addresses = {};
  try {
    addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  } catch (_) {
    // file doesn't exist yet — start fresh
  }

  addresses.MockUSDC    = usdcAddr;
  addresses.USDCDecimals = 6;

  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(addresses, null, 2));
  console.log('\nAddress saved to deployed-addresses.json');

  // ── Quick sanity check: call faucet ───────────────────────────────────────
  console.log('\nRunning faucet() sanity check...');
  const tx = await usdc.faucet();
  await tx.wait();
  const bal = await usdc.balanceOf(deployer.address);
  console.log('Deployer balance after faucet:', ethers.formatUnits(bal, 6), 'USDC');

  console.log('\n' + '='.repeat(55));
  console.log('DONE — add this to your .env:');
  console.log(`USDC_CONTRACT=${usdcAddr}`);
  console.log('='.repeat(55));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});