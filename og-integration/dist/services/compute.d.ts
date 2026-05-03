/**
 * 0G Compute Client Wrapper
 * Handles verified AI inference with TEE signature verification
 */
import { ComputeRequest, ComputeResponse, TEEVerification } from "../types";
export declare class ComputeError extends Error {
    details?: any;
    constructor(message: string, details?: any);
}
export declare class ComputeClient {
    private apiKey;
    private rpcUrl;
    private useMock;
    constructor(apiKey: string, rpcUrl: string, useMock?: boolean);
    /**
     * Execute verified inference with TEE signature verification
     */
    verifiedEvaluate(request: ComputeRequest): Promise<ComputeResponse>;
    /**
     * Get mock response for testing/fallback
     */
    private getMockResponse;
    /**
     * Extract TEE verification from response
     */
    extractTEEVerification(response: ComputeResponse): TEEVerification;
    /**
     * Verify TEE signature (placeholder)
     */
    verifySignature(signature: string, content: string, teeSignerAddress: string): Promise<boolean>;
    /**
     * Benchmark performance
     */
    benchmark(count?: number): Promise<{
        p50: number;
        p95: number;
        p99: number;
        avg: number;
    }>;
}
//# sourceMappingURL=compute.d.ts.map