/**
 * KeeperHub MCP Client
 * Handles integration with KeeperHub for workflow execution and payments
 */

import { 
  KeeperHubWorkflow, 
  WorkflowAction, 
  KeeperHubExecution,
  ExecutionProposal 
} from "../types";
import { logger } from "../utils/logger";

export { KeeperHubWorkflow, WorkflowAction, KeeperHubExecution };

export class KeeperHubClient {
  private apiKey: string;
  private baseUrl: string;
  private useMock: boolean;

  constructor(
    apiKey: string,
    baseUrl: string = "https://api.keeperhub.io",
    useMock: boolean = true
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.useMock = useMock;
  }

  /**
   * Create a workflow
   */
  async createWorkflow(workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'>): Promise<KeeperHubWorkflow> {
    logger.info(`Creating workflow: ${workflow.name}`);

    try {
      if (this.useMock) {
        logger.warn("Using mock workflow creation");
        return this.getMockWorkflow(workflow);
      }

      const response = await fetch(`${this.baseUrl}/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(workflow)
      });

      if (!response.ok) {
        throw new Error(`Failed to create workflow: ${response.statusText}`);
      }

      const result = await response.json() as KeeperHubWorkflow;
      logger.info(`Workflow created: ${result.id}`);
      return result;

    } catch (error) {
      logger.error("Failed to create workflow:", error);
      throw error;
    }
  }

  /**
   * Get mock workflow for testing
   */
  private getMockWorkflow(workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'>): KeeperHubWorkflow {
    return {
      id: `workflow-${Date.now()}`,
      name: workflow.name,
      description: workflow.description,
      actions: workflow.actions,
      price: workflow.price,
      enabled: workflow.enabled,
      createdAt: Date.now()
    };
  }

  /**
   * Trigger workflow execution
   */
  async triggerExecution(workflowId: string, params: any): Promise<KeeperHubExecution> {
    logger.info(`Triggering execution for workflow: ${workflowId}`);

    try {
      if (this.useMock) {
        logger.warn("Using mock execution");
        return this.getMockExecution(workflowId, params);
      }

      const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger execution: ${response.statusText}`);
      }

      const result = await response.json() as KeeperHubExecution;
      logger.info(`Execution triggered: ${result.txHash}`);
      return result;

    } catch (error) {
      logger.error("Failed to trigger execution:", error);
      throw error;
    }
  }

  /**
   * Get mock execution for testing
   */
  private getMockExecution(workflowId: string, params: any): KeeperHubExecution {
    return {
      workflowId,
      params,
      txHash: `0xtx${Date.now()}`,
      status: 'success',
      timestamp: Date.now()
    };
  }

  /**
   * Execute proposal via KeeperHub
   */
  async executeProposal(proposal: ExecutionProposal): Promise<KeeperHubExecution> {
    logger.info(`Executing proposal: ${proposal.agentId} - ${proposal.action}`);

    try {
      let workflowId: string;
      let params: any;

      switch (proposal.action) {
        case 'repay_debt':
          workflowId = 'spark-liquidation-shield';
          params = {
            protocol: 'spark',
            amount: proposal.data.amount || 0,
            token: proposal.data.token || 'DAI'
          };
          break;

        case 'rebalance_lp':
          workflowId = 'lp-rebalancer';
          params = {
            pool: proposal.data.pool,
            newRange: proposal.data.newRange,
            tokenId: proposal.data.tokenId
          };
          break;

        default:
          throw new Error(`Unknown action: ${proposal.action}`);
      }

      const execution = await this.triggerExecution(workflowId, params);
      logger.info(`Proposal executed: ${execution.txHash}`);
      return execution;

    } catch (error) {
      logger.error("Failed to execute proposal:", error);
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<KeeperHubWorkflow> {
    logger.info(`Getting workflow: ${workflowId}`);

    try {
      if (this.useMock) {
        logger.warn("Using mock workflow retrieval");
        return this.getMockWorkflowById(workflowId);
      }

      const response = await fetch(`${this.baseUrl}/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get workflow: ${response.statusText}`);
      }

      const result = await response.json() as KeeperHubWorkflow;
      return result;

    } catch (error) {
      logger.error("Failed to get workflow:", error);
      throw error;
    }
  }

  /**
   * Get mock workflow by ID
   */
  private getMockWorkflowById(workflowId: string): KeeperHubWorkflow {
    return {
      id: workflowId,
      name: 'Mock Workflow',
      description: 'Mock workflow for testing',
      actions: [],
      price: 0.5,
      enabled: true,
      createdAt: Date.now()
    };
  }

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<KeeperHubWorkflow[]> {
    logger.info("Listing all workflows");

    try {
      if (this.useMock) {
        logger.warn("Using mock workflow list");
        return this.getMockWorkflows();
      }

      const response = await fetch(`${this.baseUrl}/workflows`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list workflows: ${response.statusText}`);
      }

      const result = await response.json() as KeeperHubWorkflow[];
      return result;

    } catch (error) {
      logger.error("Failed to list workflows:", error);
      throw error;
    }
  }

  /**
   * Get mock workflows
   */
  private getMockWorkflows(): KeeperHubWorkflow[] {
    return [
      {
        id: 'spark-liquidation-shield',
        name: 'Spark Liquidation Shield',
        description: 'Automatically repay debt when health factor is low',
        actions: [
          {
            type: 'repay_debt',
            protocol: 'spark',
            amount: 5000,
            token: 'DAI'
          }
        ],
        price: 0.5,
        enabled: true,
        createdAt: Date.now()
      },
      {
        id: 'aave-liquidation-shield',
        name: 'Aave Liquidation Shield',
        description: 'Automatically repay debt when health factor is low',
        actions: [
          {
            type: 'repay_debt',
            protocol: 'aave',
            amount: 5000,
            token: 'USDC'
          }
        ],
        price: 0.5,
        enabled: true,
        createdAt: Date.now()
      },
      {
        id: 'lp-rebalancer',
        name: 'LP Range Rebalancer',
        description: 'Rebalance LP positions to optimize fee capture',
        actions: [
          {
            type: 'rebalance_lp',
            protocol: 'uniswap',
            params: {}
          }
        ],
        price: 0.75,
        enabled: true,
        createdAt: Date.now()
      }
    ];
  }

  /**
   * Publish workflow to marketplace
   */
  async publishWorkflow(workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'>): Promise<KeeperHubWorkflow> {
    logger.info(`Publishing workflow to marketplace: ${workflow.name}`);

    try {
      const publishedWorkflow = await this.createWorkflow({
        ...workflow,
        enabled: true
      });

      logger.info(`Workflow published: ${publishedWorkflow.id}`);
      return publishedWorkflow;

    } catch (error) {
      logger.error("Failed to publish workflow:", error);
      throw error;
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<KeeperHubExecution> {
    logger.info(`Getting execution status: ${executionId}`);

    try {
      if (this.useMock) {
        logger.warn("Using mock execution status");
        return this.getMockExecutionStatus(executionId);
      }

      const response = await fetch(`${this.baseUrl}/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get execution status: ${response.statusText}`);
      }

      const result = await response.json() as KeeperHubExecution;
      return result;

    } catch (error) {
      logger.error("Failed to get execution status:", error);
      throw error;
    }
  }

  /**
   * Get mock execution status
   */
  private getMockExecutionStatus(executionId: string): KeeperHubExecution {
    return {
      workflowId: 'mock-workflow',
      params: {},
      txHash: `0xtx${Date.now()}`,
      status: 'success',
      timestamp: Date.now()
    };
  }

  /**
   * Verify payment
   */
  async verifyPayment(txHash: string): Promise<boolean> {
    logger.info(`Verifying payment: ${txHash}`);

    try {
      if (this.useMock) {
        logger.warn("Using mock payment verification");
        return true;
      }

      const response = await fetch(`${this.baseUrl}/payments/verify/${txHash}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to verify payment: ${response.statusText}`);
      }

      const result = await response.json() as { verified: boolean };
      return result.verified;

    } catch (error) {
      logger.error("Failed to verify payment:", error);
      return false;
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats(): Promise<{
    totalRevenue: number;
    totalExecutions: number;
    avgRevenuePerExecution: number;
  }> {
    logger.info("Getting revenue statistics");

    try {
      if (this.useMock) {
        logger.warn("Using mock revenue stats");
        return this.getMockRevenueStats();
      }

      const response = await fetch(`${this.baseUrl}/revenue/stats`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get revenue stats: ${response.statusText}`);
      }

      const result = await response.json() as {
        totalRevenue: number;
        totalExecutions: number;
        avgRevenuePerExecution: number;
      };
      return result;

    } catch (error) {
      logger.error("Failed to get revenue stats:", error);
      throw error;
    }
  }

  /**
   * Get mock revenue stats
   */
  private getMockRevenueStats(): {
    totalRevenue: number;
    totalExecutions: number;
    avgRevenuePerExecution: number;
  } {
    return {
      totalRevenue: 125.50,
      totalExecutions: 251,
      avgRevenuePerExecution: 0.5
    };
  }
}