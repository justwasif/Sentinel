'use strict';

const KeeperHubMcpClient = require('./mcpClient');
const KeeperHubRestClient = require('./restClient');
const logger = require('../utils/logger');

class KeeperHubClient {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - KeeperHub API key
   * @param {string} config.baseUrl - KeeperHub REST base URL
   * @param {boolean} config.mcpEnabled - Whether to try MCP first
   * @param {number} config.mcpPort - MCP server port (default 3001)
   * @param {string} config.mcpHost - MCP server host (default 'localhost')
   */
  constructor({ apiKey, baseUrl, mcpEnabled = false, mcpPort = 3001, mcpHost = 'localhost' }) {
    this._mcpEnabled = mcpEnabled === true;

    this._mcpClient = new KeeperHubMcpClient({ mcpPort, mcpHost });
    this._restClient = new KeeperHubRestClient({ apiKey, baseUrl });

    logger.debug(
      `KeeperHubClient initialized — MCP: ${this._mcpEnabled ? 'enabled' : 'disabled'}, REST base: ${baseUrl}`
    );
  }

  /**
   * Returns the active client to use for this request.
   * Tries MCP if enabled, falls back to REST.
   * @returns {Promise<KeeperHubMcpClient|KeeperHubRestClient>}
   */
  async _getActiveClient() {
    if (this._mcpEnabled) {
      const mcpAvailable = await this._mcpClient.isAvailable();
      if (mcpAvailable) {
        logger.debug('KeeperHubClient: using MCP client');
        return this._mcpClient;
      }
      logger.warn('KeeperHubClient: MCP unavailable, falling back to REST');
    }
    logger.debug('KeeperHubClient: using REST client');
    return this._restClient;
  }

  /**
   * Creates a workflow using the active client.
   * @param {Object} workflowDefinition
   * @returns {Promise<Object>}
   */
  async createWorkflow(workflowDefinition) {
    const client = await this._getActiveClient();
    return client.createWorkflow(workflowDefinition);
  }

  /**
   * Triggers workflow execution using the active client.
   * @param {string} workflowId
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async triggerExecution(workflowId, payload) {
    const client = await this._getActiveClient();
    return client.triggerExecution(workflowId, payload);
  }

  /**
   * Publishes a workflow to the marketplace.
   * Always uses REST (MCP does not support marketplace).
   * @param {string} workflowId
   * @param {Object} metadata
   * @returns {Promise<Object>}
   */
  async publishToMarketplace(workflowId, metadata) {
    logger.debug('KeeperHubClient: publishToMarketplace always uses REST client');
    return this._restClient.publishToMarketplace(workflowId, metadata);
  }
}

module.exports = KeeperHubClient;