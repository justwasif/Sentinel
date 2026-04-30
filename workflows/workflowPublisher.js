'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const KeeperHubClient = require('../keeperhub/client');
const logger          = require('../utils/logger');

const WORKFLOWS_DIR   = path.resolve(__dirname);
const ADDRESSES_PATH  = path.resolve(__dirname, '../deployed-addresses.json');

const WORKFLOW_FILES = [
  {
    file:     path.join(WORKFLOWS_DIR, 'sparkLiquidationShield.json'),
    name:     'sparkLiquidationShield',
    addressKey: 'workflowId_sparkLiquidationShield',
  },
  {
    file:     path.join(WORKFLOWS_DIR, 'lpRangeRebalancer.json'),
    name:     'lpRangeRebalancer',
    addressKey: 'workflowId_lpRangeRebalancer',
  },
];

async function publishWorkflows() {
  logger.info('WorkflowPublisher: starting workflow publication run');

  // Load deployed addresses
  let addresses;
  try {
    addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  } catch (err) {
    logger.error(`WorkflowPublisher: failed to load deployed-addresses.json: ${err.message}`);
    process.exit(1);
  }

  // Create KeeperHub client
  const client = new KeeperHubClient({
    apiKey:     process.env.KEEPERHUB_API_KEY || '',
    baseUrl:    process.env.KEEPERHUB_BASE_URL || 'https://api.keeperhub.io',
    mcpEnabled: process.env.KEEPERHUB_MCP_ENABLED === 'true',
    mcpPort:    parseInt(process.env.KEEPERHUB_MCP_PORT || '3001', 10),
  });

  const publishedIds = {};

  for (const entry of WORKFLOW_FILES) {
    const { file, name, addressKey } = entry;

    // Read workflow definition
    let workflowDef;
    try {
      workflowDef = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      logger.error(`WorkflowPublisher: failed to read ${file}: ${err.message}`);
      continue;
    }

    logger.info(`WorkflowPublisher: processing workflow "${name}"...`);

    // Step 1: Create the workflow
    let workflowId;
    try {
      const created = await client.createWorkflow(workflowDef);
      workflowId = created.id || created.workflowId || `local-${name}-${Date.now()}`;
      logger.info(`WorkflowPublisher: "${name}" created — workflowId: ${workflowId}`);
    } catch (err) {
      logger.error(`WorkflowPublisher: failed to create "${name}": ${err.message}`);
      workflowId = `fallback-${name}-${Date.now()}`;
      logger.warn(`WorkflowPublisher: using fallback workflowId: ${workflowId}`);
    }

    publishedIds[name] = workflowId;

    // Step 2: Publish to marketplace
    const marketplace_metadata = {
      name:        workflowDef.name,
      description: workflowDef.description,
      type:        workflowDef.type,
      version:     workflowDef.version || '1.0.0',
      protocol:    workflowDef.metadata ? workflowDef.metadata.protocol : 'unknown',
      network:     workflowDef.metadata ? workflowDef.metadata.network : 'galileo',
      tags:        workflowDef.metadata ? workflowDef.metadata.tags : [],
      author:      workflowDef.metadata ? workflowDef.metadata.author : 'Sentinel',
      payment:     workflowDef.payment || { method: 'x402', currency: 'USDC', maxAmount: '1.00' },
    };

    try {
      const listing = await client.publishToMarketplace(workflowId, marketplace_metadata);
      const listingId = listing.id || listing.listingId || 'unknown';
      logger.info(`WorkflowPublisher: "${name}" published to marketplace — listingId: ${listingId}`);
      publishedIds[`${name}_listingId`] = listingId;
    } catch (err) {
      logger.error(`WorkflowPublisher: failed to publish "${name}" to marketplace: ${err.message}`);
    }

    // Save workflowId into addresses
    addresses[addressKey] = workflowId;
  }

  // Persist updated addresses back to deployed-addresses.json
  try {
    fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(addresses, null, 2));
    logger.info('WorkflowPublisher: workflow IDs saved to deployed-addresses.json');
  } catch (err) {
    logger.error(`WorkflowPublisher: failed to save addresses: ${err.message}`);
  }

  // Summary
  logger.info('WorkflowPublisher: ── SUMMARY ─────────────────────────────────');
  for (const [key, val] of Object.entries(publishedIds)) {
    logger.info(`  ${key}: ${val}`);
  }
  logger.info('WorkflowPublisher: done');

  return publishedIds;
}

if (require.main === module) {
  publishWorkflows().catch((err) => {
    logger.error(`WorkflowPublisher: fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { publishWorkflows };