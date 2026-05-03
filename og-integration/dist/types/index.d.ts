/**
 * Shared type definitions for Sentinel 0G Integration
 */
export interface Position {
    protocol: string;
    collateral: {
        asset: string;
        amount: number;
    };
    borrowed: {
        asset: string;
        amount: number;
    };
    healthFactor: number;
    timestamp?: number;
}
export interface RiskAnalysis {
    riskLevel: "Low" | "Medium" | "High";
    riskFactors: string[];
    recommendedActions: string[];
    confidence: number;
    reasoning?: string;
}
export interface Decision {
    action: "reduce_exposure" | "monitor" | "hold" | "increase_exposure";
    reason: string;
    confidence: number;
}
export interface ExecutionResult {
    position: Position;
    analysis: RiskAnalysis;
    decision: Decision;
    outcome?: any;
}
export interface ComputeRequest {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    verifyTee?: boolean;
    provider?: {
        strategy?: "lowest_latency" | "lowest_price";
        address?: string;
        exclude?: string[];
    };
}
export interface ComputeResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            reasoning_content?: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    x_0g_trace: {
        request_id: string;
        provider: string;
        billing: {
            input_cost: string;
            output_cost: string;
            total_cost: string;
        };
        tee_verified: boolean;
    };
    signature?: string;
}
export interface TEEVerification {
    verified: boolean;
    provider: string;
    signature: string;
    teeSignerAddress: string;
}
export interface MemoryNode {
    id: string;
    type: "position" | "analysis" | "decision" | "outcome" | "inft_metadata";
    timestamp: number;
    data: any;
    parents: string[];
    metadata: {
        cycle: number;
        agentId: string;
        size: number;
    };
}
export interface StorageUploadResult {
    rootHash: string;
    txHash: string;
    size: number;
}
export interface StorageDownloadResult {
    data: any;
    verified: boolean;
}
export interface DABlob {
    data: Uint8Array;
    size: number;
    rootHash?: string;
    proofHash?: string;
}
export interface DAProof {
    dataRoot: string;
    sampleSeed: string;
    epoch: number;
    quorumId: number;
    lineQuality: bigint;
    podasQuality: bigint;
    podasTarget: bigint;
    isValid: boolean;
}
export interface DAWriteResult {
    dataRoot: string;
    proofHash: string;
    sampleValid: boolean;
    txHash: string;
}
export interface AuditRecord {
    id: string;
    timestamp: number;
    agentId: string;
    cycle: number;
    execution: ExecutionResult;
    verification: {
        tee: TEEVerification;
        da: {
            dataRoot: string;
            proofHash: string;
            sampleValid: boolean;
        };
        chain: {
            verified: boolean;
            epoch: number;
            quorumId: number;
        };
    };
    performance: {
        totalTime: number;
        computeTime: number;
        storageTime: number;
        daTime: number;
    };
    metadata: {
        dataSize: number;
        compressed: boolean;
        encrypted: boolean;
    };
}
export interface AuditTrail {
    agentId: string;
    records: AuditRecord[];
    summary: {
        totalRecords: number;
        verifiedRecords: number;
        averageLatency: number;
        successRate: number;
    };
    lastUpdated: number;
}
export interface PerformanceMetrics {
    totalTime: number;
    computeTime: number;
    storageTime: number;
    daTime: number;
    verificationTime: number;
}
export interface LatencyStats {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
}
export declare class SentinelError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class ComputeError extends SentinelError {
    constructor(message: string, details?: any);
}
export declare class StorageError extends SentinelError {
    constructor(message: string, details?: any);
}
export declare class DAError extends SentinelError {
    constructor(message: string, details?: any);
}
export declare class VerificationError extends SentinelError {
    constructor(message: string, details?: any);
}
export interface ExecutionProposal {
    agentId: 'risk' | 'yield';
    action: 'repay_debt' | 'rebalance_lp' | 'none';
    urgency: 'critical' | 'high' | 'medium' | 'low';
    reasoning: string;
    data: any;
    confidence: number;
    timestamp: number;
}
export interface SwarmDecision {
    approved: ExecutionProposal[];
    rejected: ExecutionProposal[];
    reasoning: string;
    signature: string;
    attestation: string;
    timestamp: number;
    priorityOrder: string[];
    confidence: number;
}
export interface MemoryContext {
    lastNCycles: ExecutionCycle[];
    riskHistory: RiskDecision[];
    yieldHistory: YieldDecision[];
    totalCycles: number;
}
export interface ExecutionCycle {
    id: number;
    timestamp: number;
    agentOutputs: {
        risk: any;
        yield: any;
        coordinator: any;
    };
    execution: {
        approved: ExecutionProposal[];
        results: any[];
    };
    signatures: {
        risk: string;
        yield: string;
        coordinator: string;
    };
}
export interface RiskDecision {
    cycleId: number;
    healthFactor: number;
    action: string;
    riskLevel: string;
    timestamp: number;
}
export interface YieldDecision {
    cycleId: number;
    position: any;
    action: string;
    expectedGain: number;
    gasCost: number;
    timestamp: number;
}
export interface INFTMetadata {
    id: string;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    maxActionsPerCycle: number;
    availableCapital: number;
    totalCycles: number;
    successCount: number;
    failureCount: number;
    avgQuality: number;
    strategyFingerprint: string;
    lastUpdated: number;
    encrypted: boolean;
}
export interface INFTUpdate {
    cycleId: number;
    decision: SwarmDecision;
    results: any[];
    timestamp: number;
}
export interface LPPosition {
    pool: string;
    tokenId: string;
    tickLower: number;
    tickUpper: number;
    currentTick: number;
    outOfRange: number;
    fees: number;
    liquidity: number;
    timestamp: number;
}
export interface YieldAnalysis {
    action: 'rebalance_lp' | 'none';
    urgency: 'high' | 'medium' | 'low';
    newRange: [number, number];
    expectedGain: number;
    gasCost: number;
    netBenefit: number;
    reasoning: string;
    confidence: number;
}
export interface KeeperHubWorkflow {
    id: string;
    name: string;
    description: string;
    actions: WorkflowAction[];
    price: number;
    enabled: boolean;
    createdAt: number;
}
export interface WorkflowAction {
    type: 'repay_debt' | 'rebalance_lp' | 'swap';
    protocol: string;
    amount?: number;
    token?: string;
    params?: any;
}
export interface KeeperHubExecution {
    workflowId: string;
    params: any;
    txHash?: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: number;
}
//# sourceMappingURL=index.d.ts.map