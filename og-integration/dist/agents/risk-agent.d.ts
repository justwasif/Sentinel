/**
 * Risk Agent
 * Handles risk evaluation logic and prompt engineering
 */
import { Position, RiskAnalysis, Decision } from "../types";
import { ComputeClient } from "../services/compute";
import { EventEmitter } from 'events';
export declare const riskEmitter: EventEmitter<[never]>;
export declare class RiskAgent {
    private computeClient;
    private agentId;
    constructor(computeClient: ComputeClient, agentId?: string);
    /**
     * Analyze risk for a given position
     */
    analyzeRisk(position: Position, context?: any[]): Promise<RiskAnalysis>;
    /**
     * Build risk evaluation prompt
     */
    private buildRiskPrompt;
    /**
     * Parse risk analysis from response
     */
    private parseRiskAnalysis;
    /**
     * Make decision based on risk analysis
     */
    makeDecision(analysis: RiskAnalysis): Decision;
    /**
     * Batch analyze multiple positions
     */
    batchAnalyze(positions: Position[]): Promise<RiskAnalysis[]>;
}
//# sourceMappingURL=risk-agent.d.ts.map