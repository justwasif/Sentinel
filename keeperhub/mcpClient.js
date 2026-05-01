'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

class KeeperHubMcpClient {
  /**
   * @param {Object} config
   * @param {number} config.mcpPort - MCP server port (default 3001)
   * @param {string} config.mcpHost - MCP server host (default 'localhost')
   */
  constructor({ mcpPort = 3001, mcpHost = 'localhost' } = {}) {
    this._port = mcpPort;
    this._host = mcpHost;
    this._baseUrl = `http://${mcpHost}:${mcpPort}`;
  }

  /**
   * Checks whether the MCP server is reachable.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this._baseUrl}/health`, { timeout: 3000 });
      return response.status === 200;
    } catch (err) {
      logger.debug(`KeeperHubMcpClient: health check failed — ${err.message}`);
      return false;
    }
  }

  /**
   * Creates a workflow via MCP.
   * @param {Object} workflowDefinition
   * @returns {Promise<Object>}
   */
  async createWorkflow(workflowDefinition) {
    try {
      logger.debug(`KeeperHubMcpClient: POST ${this._baseUrl}/mcp/keeperhub/create_workflow`);
      const response = await axios.post(
        `${this._baseUrl}/mcp/keeperhub/create_workflow`,
        workflowDefinition,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      const result = response.data;
      logger.info(`KeeperHubMcpClient: workflow created — id: ${result.id || result.workflowId || 'unknown'}`);
      return result;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubMcpClient.createWorkflow failed [HTTP ${status}]: ${detail}`);
    }
  }

  /**
   * Triggers workflow execution via MCP.
   * @param {string} workflowId
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async triggerExecution(workflowId, payload) {
    try {
      logger.debug(`KeeperHubMcpClient: POST ${this._baseUrl}/mcp/keeperhub/trigger_execution`);
      const response = await axios.post(
        `${this._baseUrl}/mcp/keeperhub/trigger_execution`,
        { workflowId, ...payload },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      const result = response.data;
      const execId = result.executionId || result.id || 'unknown';
      logger.info(`KeeperHubMcpClient: execution triggered — executionId: ${execId}`);
      return result;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubMcpClient.triggerExecution failed [HTTP ${status}]: ${detail}`);
    }
  }
}

module.exports = KeeperHubMcpClient;