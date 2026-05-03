/**
 * Swarm Coordinator (Agent 3)
 * Orchestrates multi-agent decision making and evolves as iNFT
 */
import { ComputeClient } from "../services/compute";
import { StorageClient } from "../services/storage";
import { ExecutionProposal, SwarmDecision, MemoryContext, INFTMetadata } from "../types";
export declare class SwarmCoordinator {
    private computeClient;
    private storageClient;
    private agentId;
    private currentINFT;
    private currentCycle;
    private riskAgent;
    private verificationService;
    private fallbackService;
    constructor(computeClient: ComputeClient, storageClient: StorageClient, agentId?: string);
    /**
     * Initialize iNFT metadata
     */
    private initializeINFT;
    /**
     * Generate strategy fingerprint
     */
    private generateStrategyFingerprint;
    /**
     * Aggregate proposals from all agents
     */
    aggregateProposals(riskProposal: ExecutionProposal, yieldProposal: ExecutionProposal): Promise<ExecutionProposal[]>;
    /**
     * Load context from storage
     */
    loadContext(): Promise<MemoryContext>;
    /**
     * Build coordinator decision prompt
     */
    private buildCoordinatorPrompt;
    /**
     * Make swarm decision
     */
    makeDecision(riskProposal: ExecutionProposal, yieldProposal: ExecutionProposal): Promise<SwarmDecision>;
    /**
     * Parse swarm decision from response
     */
    private parseSwarmDecision;
    /**
     * Validate decision
     */
    validateDecision(decision: SwarmDecision): boolean;
    /**
     * Get current iNFT metadata
     */
    getINFTMetadata(): INFTMetadata;
    /**
     * Update iNFT metadata
     */
    updateINFTMetadata(update: Partial<INFTMetadata>): void;
    /**
     * Evolve iNFT based on decision outcome
     */
    evolveINFT(decision: SwarmDecision, success: boolean): void;
}
//# sourceMappingURL=coordinator.d.ts.map