"use strict";
/**
 * 0G Storage Client Wrapper
 * Handles DAG-based storage for agent memory system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageClient = void 0;
// TODO: Uncomment when 0G SDK is available
// import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
class StorageClient {
    constructor(indexerRpc, rpcUrl, privateKey, useMock = false) {
        this.indexerRpc = indexerRpc;
        this.rpcUrl = rpcUrl;
        this.privateKey = privateKey;
        this.useMock = useMock;
    }
    /**
     * Upload a memory node to 0G Storage
     */
    async uploadNode(node) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Uploading ${node.type} node...`);
            if (this.useMock) {
                logger_1.logger.warn("Using mock storage response");
                return this.getMockUploadResult(node);
            }
            // TODO: Implement actual 0G Storage upload
            // const result = await this.uploadToStorage(node);
            // const latency = Date.now() - startTime;
            // logger.info(`Upload complete in ${latency}ms`);
            // return result;
            // For now, use mock
            logger_1.logger.warn("0G Storage API not yet implemented, using mock");
            return this.getMockUploadResult(node);
        }
        catch (error) {
            const latency = Date.now() - startTime;
            logger_1.logger.error(`Upload failed after ${latency}ms:`, error);
            throw new types_1.StorageError(`Storage upload failed: ${error instanceof Error ? error.message : String(error)}`, { latency, node });
        }
    }
    /**
     * Download a memory node from 0G Storage
     */
    async downloadNode(rootHash) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Downloading node: ${rootHash}...`);
            if (this.useMock) {
                logger_1.logger.warn("Using mock storage response");
                return this.getMockDownloadResult(rootHash);
            }
            // TODO: Implement actual 0G Storage download
            // const result = await this.downloadFromStorage(rootHash);
            // const latency = Date.now() - startTime;
            // logger.info(`Download complete in ${latency}ms`);
            // return result;
            // For now, use mock
            logger_1.logger.warn("0G Storage API not yet implemented, using mock");
            return this.getMockDownloadResult(rootHash);
        }
        catch (error) {
            const latency = Date.now() - startTime;
            logger_1.logger.error(`Download failed after ${latency}ms:`, error);
            throw new types_1.StorageError(`Storage download failed: ${error instanceof Error ? error.message : String(error)}`, { latency, rootHash });
        }
    }
    /**
     * Get mock upload result for testing
     */
    getMockUploadResult(node) {
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
    getMockDownloadResult(rootHash) {
        // Return a mock node
        const mockNode = {
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
    async getHistory(rootHash, maxDepth = 10) {
        logger_1.logger.info(`Getting history for ${rootHash} (max depth: ${maxDepth})...`);
        const history = [];
        const visited = new Set();
        let currentHash = rootHash;
        let depth = 0;
        while (currentHash && depth < maxDepth && !visited.has(currentHash)) {
            visited.add(currentHash);
            try {
                const result = await this.downloadNode(currentHash);
                const node = result.data;
                history.push(node);
                // Move to first parent
                currentHash = node.parents.length > 0 ? node.parents[0] : "";
                depth++;
            }
            catch (error) {
                logger_1.logger.error(`Failed to download node ${currentHash}:`, error);
                break;
            }
        }
        logger_1.logger.info(`Retrieved ${history.length} nodes from history`);
        return history.reverse(); // Return oldest first
    }
    /**
     * Batch upload multiple nodes
     */
    async batchUpload(nodes) {
        logger_1.logger.info(`Batch uploading ${nodes.length} nodes...`);
        const results = [];
        for (let i = 0; i < nodes.length; i++) {
            try {
                const result = await this.uploadNode(nodes[i]);
                results.push(result);
                logger_1.logger.debug(`Uploaded ${i + 1}/${nodes.length}: ${result.rootHash}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to upload node ${i + 1}/${nodes.length}:`, error);
                // Continue with other nodes
            }
        }
        logger_1.logger.info(`Batch upload complete: ${results.length}/${nodes.length} successful`);
        return results;
    }
}
exports.StorageClient = StorageClient;
//# sourceMappingURL=storage.js.map