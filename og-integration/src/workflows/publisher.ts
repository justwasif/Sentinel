/**
 * Workflow Publishing for KeeperHub Marketplace
 * Handles publishing and managing workflows on the KeeperHub marketplace
 */

import { KeeperHubClient } from "../services/keeperhub";
import { KeeperHubWorkflow, WorkflowAction } from "../services/keeperhub";
import { logger } from "../utils/logger";

export class WorkflowPublisher {
  private keeperHubClient: KeeperHubClient;
  private publishedWorkflows: Map<string, KeeperHubWorkflow>;

  constructor(keeperHubClient: KeeperHubClient) {
    this.keeperHubClient = keeperHubClient;
    this.publishedWorkflows = new Map();
  }

  /**
   * Publish Spark liquidation shield workflow
   */
  async publishSparkLiquidationShield(): Promise<KeeperHubWorkflow> {
    logger.info("Publishing Spark liquidation shield workflow...");

    const workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'> = {
      name: 'Spark Liquidation Shield',
      description: 'Automatically repay debt when Spark health factor drops below threshold',
      actions: [
        {
          type: 'repay_debt',
          protocol: 'spark',
          amount: 5000,
          token: 'DAI',
          params: {
            healthFactorThreshold: 1.2,
            maxRepayAmount: 10000
          }
        }
      ],
      price: 0.5,
      enabled: true
    };

    const published = await this.keeperHubClient.publishWorkflow(workflow);
    this.publishedWorkflows.set(published.id, published);

    logger.info(`Spark liquidation shield published: ${published.id}`);
    return published;
  }

  /**
   * Publish Aave liquidation shield workflow
   */
  async publishAaveLiquidationShield(): Promise<KeeperHubWorkflow> {
    logger.info("Publishing Aave liquidation shield workflow...");

    const workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'> = {
      name: 'Aave Liquidation Shield',
      description: 'Automatically repay debt when Aave health factor drops below threshold',
      actions: [
        {
          type: 'repay_debt',
          protocol: 'aave',
          amount: 5000,
          token: 'USDC',
          params: {
            healthFactorThreshold: 1.2,
            maxRepayAmount: 10000
          }
        }
      ],
      price: 0.5,
      enabled: true
    };

    const published = await this.keeperHubClient.publishWorkflow(workflow);
    this.publishedWorkflows.set(published.id, published);

    logger.info(`Aave liquidation shield published: ${published.id}`);
    return published;
  }

  /**
   * Publish LP range rebalancer workflow
   */
  async publishLPRebalancer(): Promise<KeeperHubWorkflow> {
    logger.info("Publishing LP range rebalancer workflow...");

    const workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'> = {
      name: 'LP Range Rebalancer',
      description: 'Rebalance Uniswap V3 LP positions to optimize fee capture',
      actions: [
        {
          type: 'rebalance_lp',
          protocol: 'uniswap',
          params: {
            outOfRangeThreshold: 80,
            minNetBenefit: 100,
            maxGasCost: 50
          }
        }
      ],
      price: 0.75,
      enabled: true
    };

    const published = await this.keeperHubClient.publishWorkflow(workflow);
    this.publishedWorkflows.set(published.id, published);

    logger.info(`LP range rebalancer published: ${published.id}`);
    return published;
  }

  /**
   * Publish custom workflow
   */
  async publishCustomWorkflow(
    name: string,
    description: string,
    actions: WorkflowAction[],
    price: number
  ): Promise<KeeperHubWorkflow> {
    logger.info(`Publishing custom workflow: ${name}`);

    const workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'> = {
      name,
      description,
      actions,
      price,
      enabled: true
    };

    const published = await this.keeperHubClient.publishWorkflow(workflow);
    this.publishedWorkflows.set(published.id, published);

    logger.info(`Custom workflow published: ${published.id}`);
    return published;
  }

  /**
   * Publish all default workflows
   */
  async publishAllDefaultWorkflows(): Promise<KeeperHubWorkflow[]> {
    logger.info("Publishing all default workflows...");

    const workflows = await Promise.all([
      this.publishSparkLiquidationShield(),
      this.publishAaveLiquidationShield(),
      this.publishLPRebalancer()
    ]);

    logger.info(`All default workflows published: ${workflows.length} workflows`);
    return workflows;
  }

  /**
   * Get published workflow by ID
   */
  getPublishedWorkflow(workflowId: string): KeeperHubWorkflow | undefined {
    return this.publishedWorkflows.get(workflowId);
  }

  /**
   * Get all published workflows
   */
  getAllPublishedWorkflows(): KeeperHubWorkflow[] {
    return Array.from(this.publishedWorkflows.values());
  }

  /**
   * Update workflow price
   */
  async updateWorkflowPrice(workflowId: string, newPrice: number): Promise<void> {
    logger.info(`Updating workflow price: ${workflowId} -> $${newPrice}`);

    const workflow = this.publishedWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const updated = await this.keeperHubClient.publishWorkflow({
      ...workflow,
      price: newPrice
    });

    this.publishedWorkflows.set(updated.id, updated);
    logger.info(`Workflow price updated: ${workflowId}`);
  }

  /**
   * Disable workflow
   */
  async disableWorkflow(workflowId: string): Promise<void> {
    logger.info(`Disabling workflow: ${workflowId}`);

    const workflow = this.publishedWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const updated = await this.keeperHubClient.publishWorkflow({
      ...workflow,
      enabled: false
    });

    this.publishedWorkflows.set(updated.id, updated);
    logger.info(`Workflow disabled: ${workflowId}`);
  }

  /**
   * Enable workflow
   */
  async enableWorkflow(workflowId: string): Promise<void> {
    logger.info(`Enabling workflow: ${workflowId}`);

    const workflow = this.publishedWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const updated = await this.keeperHubClient.publishWorkflow({
      ...workflow,
      enabled: true
    });

    this.publishedWorkflows.set(updated.id, updated);
    logger.info(`Workflow enabled: ${workflowId}`);
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats(): Promise<{
    totalRevenue: number;
    totalExecutions: number;
    avgRevenuePerExecution: number;
    workflowCount: number;
  }> {
    logger.info("Getting revenue statistics...");

    const stats = await this.keeperHubClient.getRevenueStats();

    return {
      ...stats,
      workflowCount: this.publishedWorkflows.size
    };
  }

  /**
   * Sync published workflows from KeeperHub
   */
  async syncWorkflows(): Promise<void> {
    logger.info("Syncing workflows from KeeperHub...");

    const workflows = await this.keeperHubClient.listWorkflows();

    for (const workflow of workflows) {
      this.publishedWorkflows.set(workflow.id, workflow);
    }

    logger.info(`Workflows synced: ${workflows.length} workflows`);
  }

  /**
   * Clear published workflows cache
   */
  clearCache(): void {
    this.publishedWorkflows.clear();
    logger.info("Published workflows cache cleared");
  }
}