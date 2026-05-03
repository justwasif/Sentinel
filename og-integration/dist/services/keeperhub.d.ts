/**
 * KeeperHub MCP Client
 * Handles integration with KeeperHub for workflow execution and payments
 */
import { KeeperHubWorkflow, WorkflowAction, KeeperHubExecution, ExecutionProposal } from "../types";
export { KeeperHubWorkflow, WorkflowAction, KeeperHubExecution };
export declare class KeeperHubClient {
    private apiKey;
    private baseUrl;
    private useMock;
    constructor(apiKey: string, baseUrl?: string, useMock?: boolean);
    /**
     * Create a workflow
     */
    createWorkflow(workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'>): Promise<KeeperHubWorkflow>;
    /**
     * Get mock workflow for testing
     */
    private getMockWorkflow;
    /**
     * Trigger workflow execution
     */
    triggerExecution(workflowId: string, params: any): Promise<KeeperHubExecution>;
    /**
     * Get mock execution for testing
     */
    private getMockExecution;
    /**
     * Execute proposal via KeeperHub
     */
    executeProposal(proposal: ExecutionProposal): Promise<KeeperHubExecution>;
    /**
     * Get workflow by ID
     */
    getWorkflow(workflowId: string): Promise<KeeperHubWorkflow>;
    /**
     * Get mock workflow by ID
     */
    private getMockWorkflowById;
    /**
     * List all workflows
     */
    listWorkflows(): Promise<KeeperHubWorkflow[]>;
    /**
     * Get mock workflows
     */
    private getMockWorkflows;
    /**
     * Publish workflow to marketplace
     */
    publishWorkflow(workflow: Omit<KeeperHubWorkflow, 'id' | 'createdAt'>): Promise<KeeperHubWorkflow>;
    /**
     * Get execution status
     */
    getExecutionStatus(executionId: string): Promise<KeeperHubExecution>;
    /**
     * Get mock execution status
     */
    private getMockExecutionStatus;
    /**
     * Verify payment
     */
    verifyPayment(txHash: string): Promise<boolean>;
    /**
     * Get revenue statistics
     */
    getRevenueStats(): Promise<{
        totalRevenue: number;
        totalExecutions: number;
        avgRevenuePerExecution: number;
    }>;
    /**
     * Get mock revenue stats
     */
    private getMockRevenueStats;
}
//# sourceMappingURL=keeperhub.d.ts.map