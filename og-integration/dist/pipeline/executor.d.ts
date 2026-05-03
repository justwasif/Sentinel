/**
 * Main Execution Pipeline
 * Orchestrates the complete risk analysis flow
 */
import { Position, ExecutionResult } from "../types";
import { ComputeClient } from "../services/compute";
import { StorageClient } from "../services/storage";
import { DAClient } from "../services/da";
export declare class PipelineExecutor {
    private computeClient;
    private storageClient;
    private daClient;
    private riskAgent;
    private verificationService;
    private fallbackService;
    private agentId;
    private currentCycle;
    constructor(computeClient: ComputeClient, storageClient: StorageClient, daClient: DAClient, agentId?: string);
    /**
     * Execute complete risk analysis pipeline
     */
    execute(position: Position): Promise<ExecutionResult>;
    /**
     * Store position in memory
     */
    private storePosition;
    /**
     * Store analysis in memory
     */
    private storeAnalysis;
    /**
     * Store decision in memory
     */
    private storeDecision;
    /**
     * Get context from memory
     */
    private getContext;
    /**
     * Store execution result in DA
     */
    private storeInDA;
    /**
     * Verify on chain
     */
    private verifyOnChain;
    /**
     * Batch execute multiple positions
     */
    batchExecute(positions: Position[]): Promise<ExecutionResult[]>;
    /**
     * Get current cycle number
     */
    getCurrentCycle(): number;
    /**
     * Get agent ID
     */
    getAgentId(): string;
}
//# sourceMappingURL=executor.d.ts.map