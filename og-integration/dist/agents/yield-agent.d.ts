/**
 * Yield Agent (Agent 2)
 * Handles LP position optimization and rebalancing
 */
import { ComputeClient } from "../services/compute";
import { LPPosition, YieldAnalysis } from "../types";
export declare class YieldAgent {
    private computeClient;
    private agentId;
    private lastRebalanceTime;
    private rebalanceCount;
    constructor(computeClient: ComputeClient, agentId?: string);
    /**
     * Analyze LP position for optimization opportunities
     */
    analyzePosition(position: LPPosition, context?: any[]): Promise<YieldAnalysis>;
    /**
     * Build yield optimization prompt
     */
    private buildYieldPrompt;
    /**
     * Parse yield analysis from response
     */
    private parseYieldAnalysis;
    /**
     * Check anti-thrashing rules
     */
    checkAntiThrashingRules(analysis: YieldAnalysis): boolean;
    /**
     * Create execution proposal
     */
    createProposal(analysis: YieldAnalysis, position: LPPosition): any;
    /**
     * Record rebalance
     */
    recordRebalance(): void;
    /**
     * Get rebalance statistics
     */
    getRebalanceStats(): {
        lastRebalanceTime: number;
        rebalanceCount: number;
        hoursSinceLastRebalance: number;
    };
    /**
     * Batch analyze multiple positions
     */
    batchAnalyze(positions: LPPosition[]): Promise<YieldAnalysis[]>;
}
//# sourceMappingURL=yield-agent.d.ts.map