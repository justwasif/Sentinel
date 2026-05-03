'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

class KeeperHubRestClient {
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

  async createWorkflow(workflowDefinition) {
    try {
      logger.debug(`KeeperHubRestClient: POST /api/workflows — name: ${workflowDefinition.name || 'unnamed'}`);
      const response = await this._client.post('/api/workflows', workflowDefinition);
      const workflow = response.data;
      logger.info(`KeeperHubRestClient: workflow created — id: ${workflow.id || workflow.workflowId || JSON.stringify(workflow).slice(0, 60)}`);
      return workflow;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubRestClient.createWorkflow failed [HTTP ${status}]: ${detail}`);
    }
  }

  async triggerExecution(workflowId, payload) {
    try {
      logger.debug(`KeeperHubRestClient: POST /api/workflows/${workflowId}/execute`);
      const response = await this._client.post(`/api/workflows/${workflowId}/execute`, payload);
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

  async getExecutionStatus(executionId) {
    try {
      logger.debug(`KeeperHubRestClient: GET /api/executions/${executionId}`);
      const response = await this._client.get(`/api/executions/${executionId}`);
      return response.data;
    } catch (err) {
      const status = err.response ? err.response.status : 'N/A';
      const detail = err.response ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
      throw new Error(`KeeperHubRestClient.getExecutionStatus failed [HTTP ${status}]: ${detail}`);
    }
  }

  async publishToMarketplace(workflowId, metadata) {
    try {
      logger.debug(`KeeperHubRestClient: POST /api/marketplace/publish — workflowId: ${workflowId}`);
      const response = await this._client.post('/api/marketplace/publish', {
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