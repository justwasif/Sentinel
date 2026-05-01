/**
 * 0G Storage Client Wrapper
 * Handles DAG-based storage for agent memory system
 */

// TODO: Uncomment when 0G SDK is available
// import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { MemoryNode, StorageUploadResult, StorageDownloadResult, StorageError } from "../types";
import { logger } from "../utils/logger";

export class StorageClient {
  private indexerRpc: string;
  private rpcUrl: string;
  private privateKey: string;
  private useMock: boolean;

  constructor(
    indexerRpc: string,
    rpcUrl: string,
    privateKey: string,
    useMock: boolean = false
  ) {
    this.indexerRpc = indexerRpc;
    this.rpcUrl = rpcUrl;
    this.privateKey = privateKey;
    this.useMock = useMock;
  }

  /**
   * Upload a memory node to 0G Storage
   */
  async uploadNode(node: MemoryNode): Promise<StorageUploadResult> {
    const startTime = Date.now();

    try {
      logger.info(`Uploading ${node.type} node...`);

      if (this.useMock) {
        logger.warn("Using mock storage response");
        return this.getMockUploadResult(node);
      }

      // TODO: Implement actual 0G Storage upload
      // const result = await this.uploadToStorage(node);
      // const latency = Date.now() - startTime;
      // logger.info(`Upload complete in ${latency}ms`);
      // return result;

      // For now, use mock
      logger.warn("0G Storage API not yet implemented, using mock");
      return this.getMockUploadResult(node);

    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error(`Upload failed after ${latency}ms:`, error);
      throw new StorageError(
        `Storage upload failed: ${error instanceof Error ? error.message : String(error)}`,
        { latency, node }
      );
    }
  }

  /**
   * Download a memory node from 0G Storage
   */
  async downloadNode(rootHash: string): Promise<StorageDownloadResult> {
    const startTime = Date.now();

    try {
      logger.info(`Downloading node: ${rootHash}...`);

      if (this.useMock) {
        logger.warn("Using mock storage response");
        return this.getMockDownloadResult(rootHash);
      }

      // TODO: Implement actual 0G Storage download
      // const result = await this.downloadFromStorage(rootHash);
      // const latency = Date.now() - startTime;
      // logger.info(`Download complete in ${latency}ms`);
      // return result;

      // For now, use mock
      logger.warn("0G Storage API not yet implemented, using mock");
      return this.getMockDownloadResult(rootHash);

    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error(`Download failed after ${latency}ms:`, error);
      throw new StorageError(
        `Storage download failed: ${error instanceof Error ? error.message : String(error)}`,
        { latency, rootHash }
      );
    }
  }

  /**
   * Get mock upload result for testing
   */
  private getMockUploadResult(node: MemoryNode): StorageUploadResult {
    const mockHash = `0x${Buffer.from(JSON.stringify(node)).toString('hex').substring(0, 64)}`;
    
    return {
      rootHash: mockHash,
      txHash: `0xtx${Date.now()}`,
      size: JSON.stringify(node).length
    };
  }

  /**
   * Get mock download result for testing
   */
  private getMockDownloadResult(rootHash: string): StorageDownloadResult {
    // Return a mock node
    const mockNode: MemoryNode = {
      id: rootHash,
      type: "position",
      timestamp: Date.now(),
      data: {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.8
      },
      parents: [],
      metadata: {
        cycle: 1,
        agentId: "agent-1",
        size: 256
      }
    };

    return {
      data: mockNode,
      verified: true
    };
  }

  /**
   * Get history by traversing parent links
   */
  async getHistory(rootHash: string, maxDepth: number = 10): Promise<MemoryNode[]> {
    logger.info(`Getting history for ${rootHash} (max depth: ${maxDepth})...`);

    const history: MemoryNode[] = [];
    const visited = new Set<string>();
    let currentHash = rootHash;
    let depth = 0;

    while (currentHash && depth < maxDepth && !visited.has(currentHash)) {
      visited.add(currentHash);

      try {
        const result = await this.downloadNode(currentHash);
        const node = result.data as MemoryNode;
        history.push(node);

        // Move to first parent
        currentHash = node.parents.length > 0 ? node.parents[0] : "";
        depth++;

      } catch (error) {
        logger.error(`Failed to download node ${currentHash}:`, error);
        break;
      }
    }

    logger.info(`Retrieved ${history.length} nodes from history`);
    return history.reverse(); // Return oldest first
  }

  /**
   * Batch upload multiple nodes
   */
  async batchUpload(nodes: MemoryNode[]): Promise<StorageUploadResult[]> {
    logger.info(`Batch uploading ${nodes.length} nodes...`);

    const results: StorageUploadResult[] = [];

    for (let i = 0; i < nodes.length; i++) {
      try {
        const result = await this.uploadNode(nodes[i]);
        results.push(result);
        logger.debug(`Uploaded ${i + 1}/${nodes.length}: ${result.rootHash}`);
      } catch (error) {
        logger.error(`Failed to upload node ${i + 1}/${nodes.length}:`, error);
        // Continue with other nodes
      }
    }

    logger.info(`Batch upload complete: ${results.length}/${nodes.length} successful`);
    return results;
  }
}
