'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

class KeeperHubRestClient {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - KeeperHub API key
   * @param {string} config.baseUrl - KeeperHub base URL (e.g. https://api.keeperhub.io)
   */
  constructor({ apiKey, baseUrl }) {
    if (!apiKey) {
      logger.warn('KeeperHubRestClient: no apiKey provided; requests will likely return 401');
    }
    if (!baseUrl) {
      throw new Error('KeeperHubRestClient: baseUrl is required');
    }

    this._client = axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Creates a workflow on KeeperHub.
   * @param {Object} workflowDefinition
   * @returns {Promise<Object>} Created workflow object
   */
  async createWorkflow(workflowDefinition) {
    try {
      logger.debug(`KeeperHubRestClient: POST /v1/workflows — name: ${workflowDefinition.name || 'unnamed'}`);
      const response = await this._client.post('/v1/workflows', workflowDefinition);
      const workflow = response.data;
      logger.info(`KeeperHubRestClient: workflow created — id: ${workflow.id || workflow.workflowId || JSON.stringify(workflow).slice(0, 60)}`);
      return workflow;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubRestClient.createWorkflow failed [HTTP ${status}]: ${detail}`);
    }
  }

  /**
   * Triggers execution of a workflow.
   * @param {string} workflowId
   * @param {Object} payload
   * @returns {Promise<Object>} Execution result
   */
  async triggerExecution(workflowId, payload) {
    try {
      logger.debug(`KeeperHubRestClient: POST /v1/workflows/${workflowId}/execute`);
      const response = await this._client.post(`/v1/workflows/${workflowId}/execute`, payload);
      const result = response.data;
      const execId = result.executionId || result.id || 'unknown';
      logger.info(`KeeperHubRestClient: execution triggered — executionId: ${execId}`);
      return result;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubRestClient.triggerExecution failed [HTTP ${status}]: ${detail}`);
    }
  }

  /**
   * Gets the status of an execution.
   * @param {string} executionId
   * @returns {Promise<Object>} Status object
   */
  async getExecutionStatus(executionId) {
    try {
      logger.debug(`KeeperHubRestClient: GET /v1/executions/${executionId}`);
      const response = await this._client.get(`/v1/executions/${executionId}`);
      return response.data;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubRestClient.getExecutionStatus failed [HTTP ${status}]: ${detail}`);
    }
  }

  /**
   * Publishes a workflow to the KeeperHub marketplace.
   * @param {string} workflowId
   * @param {Object} metadata
   * @returns {Promise<Object>} Published listing
   */
  async publishToMarketplace(workflowId, metadata) {
    try {
      logger.debug(`KeeperHubRestClient: POST /v1/marketplace/publish — workflowId: ${workflowId}`);
      const response = await this._client.post('/v1/marketplace/publish', {
        workflowId,
        ...metadata,
      });
      const listing = response.data;
      logger.info(`KeeperHubRestClient: published to marketplace — listingId: ${listing.id || listing.listingId || 'unknown'}`);
      return listing;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubRestClient.publishToMarketplace failed [HTTP ${status}]: ${detail}`);
    }
  }
}

module.exports = KeeperHubRestClient;