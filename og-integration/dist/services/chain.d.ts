/**
 * 0G Chain Contract Interface
 * Handles interaction with InferenceGuard contract for proof validation
 */
export interface InferenceGuardConfig {
    contractAddress: string;
    rpcUrl: string;
    privateKey: string;
}
export interface ProofSubmission {
    dataRoot: string;
    proofHash: string;
    epoch: number;
    quorumId: number;
}
export interface ProofVerification {
    isValid: boolean;
    epoch: number;
    quorumId: number;
    timestamp: number;
}
export declare class ChainClient {
    private provider;
    private wallet;
    private contract;
    private contractAddress;
    constructor(config: InferenceGuardConfig);
    /**
     * Submit proof to InferenceGuard contract
     */
    submitProof(submission: ProofSubmission): Promise<string>;
    /**
     * Verify proof on-chain
     */
    verifyProof(submission: ProofSubmission): Promise<ProofVerification>;
    /**
     * Get proof status
     */
    getProofStatus(dataRoot: string): Promise<{
        verified: boolean;
        timestamp: number;
    }>;
    /**
     * Get last verified proof
     */
    getLastVerifiedProof(): Promise<{
        dataRoot: string;
        proofHash: string;
        epoch: number;
        quorumId: number;
        timestamp: number;
    }>;
    /**
     * Get contract balance
     */
    getBalance(): Promise<bigint>;
    /**
     * Get wallet balance
     */
    getWalletBalance(): Promise<bigint>;
    /**
     * Get current block number
     */
    getBlockNumber(): Promise<number>;
    /**
     * Get gas price
     */
    getGasPrice(): Promise<bigint>;
    /**
     * Estimate gas for proof submission
     */
    estimateGas(submission: ProofSubmission): Promise<bigint>;
    /**
     * Get contract address
     */
    getContractAddress(): string;
    /**
     * Get wallet address
     */
    getWalletAddress(): string;
}
export declare class MockChainClient {
    private proofs;
    constructor();
    /**
     * Submit proof (mock)
     */
    submitProof(submission: ProofSubmission): Promise<string>;
    /**
     * Verify proof (mock)
     */
    verifyProof(submission: ProofSubmission): Promise<ProofVerification>;
    /**
     * Get proof status (mock)
     */
    getProofStatus(dataRoot: string): Promise<{
        verified: boolean;
        timestamp: number;
    }>;
    /**
     * Get last verified proof (mock)
     */
    getLastVerifiedProof(): Promise<{
        dataRoot: string;
        proofHash: string;
        epoch: number;
        quorumId: number;
        timestamp: number;
    }>;
    /**
     * Get contract balance (mock)
     */
    getBalance(): Promise<bigint>;
    /**
     * Get wallet balance (mock)
     */
    getWalletBalance(): Promise<bigint>;
    /**
     * Get current block number (mock)
     */
    getBlockNumber(): Promise<number>;
    /**
     * Get gas price (mock)
     */
    getGasPrice(): Promise<bigint>;
    /**
     * Estimate gas (mock)
     */
    estimateGas(submission: ProofSubmission): Promise<bigint>;
    /**
     * Get contract address (mock)
     */
    getContractAddress(): string;
    /**
     * Get wallet address (mock)
     */
    getWalletAddress(): string;
}
//# sourceMappingURL=chain.d.ts.map