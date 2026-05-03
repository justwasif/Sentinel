/**
 * Workflow Publishing for KeeperHub Marketplace
 * Handles publishing and managing workflows on the KeeperHub marketplace
 */
import { KeeperHubClient } from "../services/keeperhub";
import { KeeperHubWorkflow, WorkflowAction } from "../services/keeperhub";
export declare class WorkflowPublisher {
    private keeperHubClient;
    private publishedWorkflows;
    constructor(keeperHubClient: KeeperHubClient);
    /**
     * Publish Spark liquidation shield workflow
     */
    publishSparkLiquidationShield(): Promise<KeeperHubWorkflow>;
    /**
     * Publish Aave liquidation shield workflow
     */
    publishAaveLiquidationShield(): Promise<KeeperHubWorkflow>;
    /**
     * Publish LP range rebalancer workflow
     */
    publishLPRebalancer(): Promise<KeeperHubWorkflow>;
    /**
     * Publish custom workflow
     */
    publishCustomWorkflow(name: string, description: string, actions: WorkflowAction[], price: number): Promise<KeeperHubWorkflow>;
    /**
     * Publish all default workflows
     */
    publishAllDefaultWorkflows(): Promise<KeeperHubWorkflow[]>;
    /**
     * Get published workflow by ID
     */
    getPublishedWorkflow(workflowId: string): KeeperHubWorkflow | undefined;
    /**
     * Get all published workflows
     */
    getAllPublishedWorkflows(): KeeperHubWorkflow[];
    /**
     * Update workflow price
     */
    updateWorkflowPrice(workflowId: string, newPrice: number): Promise<void>;
    /**
     * Disable workflow
     */
    disableWorkflow(workflowId: string): Promise<void>;
    /**
     * Enable workflow
     */
    enableWorkflow(workflowId: string): Promise<void>;
    /**
     * Get revenue statistics
     */
    getRevenueStats(): Promise<{
        totalRevenue: number;
        totalExecutions: number;
        avgRevenuePerExecution: number;
        workflowCount: number;
    }>;
    /**
     * Sync published workflows from KeeperHub
     */
    syncWorkflows(): Promise<void>;
    /**
     * Clear published workflows cache
     */
    clearCache(): void;
}
//# sourceMappingURL=publisher.d.ts.map