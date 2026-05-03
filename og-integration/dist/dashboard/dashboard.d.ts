/**
 * Demo Dashboard
 * Simple text-based dashboard for displaying swarm status and metrics
 */
import { INFTManager } from "../inft/metadata";
import { SwarmCoordinator } from "../agents/coordinator";
import { RiskAgent } from "../agents/risk-agent";
import { YieldAgent } from "../agents/yield-agent";
import { KeeperHubClient } from "../services/keeperhub";
import { MockChainClient } from "../services/chain";
export interface DashboardState {
    agentStatus: {
        risk: 'active' | 'idle' | 'error';
        yield: 'active' | 'idle' | 'error';
        coordinator: 'active' | 'idle' | 'error';
    };
    currentProposals: {
        risk: any;
        yield: any;
    };
    recentDecisions: any[];
    iNFTStats: {
        totalCycles: number;
        successRate: number;
        avgQuality: number;
        riskTolerance: string;
    };
    performance: {
        avgLatency: number;
        successRate: number;
        totalExecutions: number;
    };
    revenue: {
        totalRevenue: number;
        totalExecutions: number;
        avgRevenuePerExecution: number;
    };
}
export declare class DemoDashboard {
    private inftManager;
    private coordinator;
    private riskAgent;
    private yieldAgent;
    private keeperHubClient;
    private chainClient;
    private state;
    constructor(inftManager: INFTManager, coordinator: SwarmCoordinator, riskAgent: RiskAgent, yieldAgent: YieldAgent, keeperHubClient: KeeperHubClient, chainClient: MockChainClient);
    /**
     * Initialize dashboard state
     */
    private initializeState;
    /**
     * Update dashboard state
     */
    updateState(): Promise<void>;
    /**
     * Update agent status
     */
    updateAgentStatus(agent: 'risk' | 'yield' | 'coordinator', status: 'active' | 'idle' | 'error'): void;
    /**
     * Update current proposals
     */
    updateProposals(riskProposal: any, yieldProposal: any): void;
    /**
     * Add recent decision
     */
    addRecentDecision(decision: any): void;
    /**
     * Render dashboard
     */
    render(): string;
    /**
     * Get status badge
     */
    private getStatusBadge;
    /**
     * Clear dashboard
     */
    clear(): void;
    /**
     * Display dashboard
     */
    display(): void;
    /**
     * Start live dashboard
     */
    startLiveDashboard(intervalMs?: number): Promise<void>;
    /**
     * Get current state
     */
    getState(): DashboardState;
}
//# sourceMappingURL=dashboard.d.ts.map