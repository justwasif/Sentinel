/**
 * 0G Storage Client Wrapper
 * Handles DAG-based storage for agent memory system
 */
import { MemoryNode, StorageUploadResult, StorageDownloadResult } from "../types";
export declare class StorageClient {
    private indexerRpc;
    private rpcUrl;
    private privateKey;
    private useMock;
    constructor(indexerRpc: string, rpcUrl: string, privateKey: string, useMock?: boolean);
    /**
     * Upload a memory node to 0G Storage
     */
    uploadNode(node: MemoryNode): Promise<StorageUploadResult>;
    /**
     * Download a memory node from 0G Storage
     */
    downloadNode(rootHash: string): Promise<StorageDownloadResult>;
    /**
     * Get mock upload result for testing
     */
    private getMockUploadResult;
    /**
     * Get mock download result for testing
     */
    private getMockDownloadResult;
    /**
     * Get history by traversing parent links
     */
    getHistory(rootHash: string, maxDepth?: number): Promise<MemoryNode[]>;
    /**
     * Batch upload multiple nodes
     */
    batchUpload(nodes: MemoryNode[]): Promise<StorageUploadResult[]>;
}
//# sourceMappingURL=storage.d.ts.map