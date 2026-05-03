/**
 * 0G DA Client Wrapper
 * Handles data availability and audit trail functionality
 */
import { DABlob, DAProof, DAWriteResult } from "../types";
export declare class DAClient {
    private daContractAddress;
    private rpcUrl;
    private privateKey;
    private useMock;
    constructor(daContractAddress: string, rpcUrl: string, privateKey: string, useMock?: boolean);
    /**
     * Create a DA blob from data
     */
    createBlob(data: any): Promise<DABlob>;
    /**
     * Write blob to DA
     */
    writeBlob(blob: DABlob): Promise<DAWriteResult>;
    /**
     * Get mock write result for testing
     */
    private getMockWriteResult;
    /**
     * Verify data availability with random sample
     */
    verifyAvailability(dataRoot: string): Promise<DAProof>;
    /**
     * Get mock proof for testing
     */
    private getMockProof;
    /**
     * Validate blob availability
     */
    validateAvailability(dataRoot: string): Promise<boolean>;
    /**
     * Batch verify multiple blobs
     */
    batchVerifyAvailability(dataRoots: string[]): Promise<Map<string, boolean>>;
}
//# sourceMappingURL=da.d.ts.map