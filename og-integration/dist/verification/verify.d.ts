/**
 * Verification Service
 * Handles signature verification and cryptographic proofs
 */
import { ComputeResponse, TEEVerification } from "../types";
export declare class VerificationService {
    private cache;
    private cacheTTL;
    constructor(cacheTTL?: number);
    /**
     * Verify TEE signature
     */
    verifyTEESignature(response: ComputeResponse, teeSignerAddress: string): Promise<TEEVerification>;
    /**
     * Verify attestation chain
     */
    verifyAttestationChain(attestation: any): Promise<boolean>;
    /**
     * Verify Merkle proof
     */
    verifyMerkleProof(proof: any, data: any, rootHash: string): Promise<boolean>;
    /**
     * Clear verification cache
     */
    clearCache(): void;
    /**
     * Get cache size
     */
    getCacheSize(): number;
}
//# sourceMappingURL=verify.d.ts.map