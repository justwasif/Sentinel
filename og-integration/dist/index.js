"use strict";
/**
 * Sentinel 0G Integration - Main Entry Point
 * Verified AI risk guardian using 0G primitives
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const compute_1 = require("./services/compute");
const storage_1 = require("./services/storage");
const da_1 = require("./services/da");
const executor_1 = require("./pipeline/executor");
const logger_1 = require("./utils/logger");
// Load environment variables
dotenv_1.default.config();
/**
 * Main application
 */
async function main() {
    logger_1.logger.info("Starting Sentinel 0G Integration...");
    try {
        // Initialize clients
        const computeClient = new compute_1.ComputeClient(process.env.API_KEY || "app-sk-eyJhZGRyZXNzIjoiMHg1YUQzRWNBNjVGYmE2OWVGYUM3MTZkNzkyQWJFMTkwNDE2MmYxQjEwIiwicHJvdmlkZXIiOiIweGE0OGYwMTI4NzIzMzUwOUZENjk0YTIyQmY4NDAyMjUwNjJFNjc4MzYiLCJ0aW1lc3RhbXAiOjE3Nzc4MTE2NTc0MTEsImV4cGlyZXNBdCI6MCwibm9uY2UiOiIxNzc3ODExNjU3NDExLXcybnFiNDFvdjNpMDAwMDAwMCIsImdlbmVyYXRpb24iOjAsInRva2VuSWQiOjB9fDB4ZDkxMDc5ZmE1ZTdkNjE2MWQzMjI2ZmNkYWU0N2RiZGM1NmRlZGFkYzY4OTRjMjNkZGZlOTlhZGE1Nzk5NjFmODY0NmE4MzdjMTcwYTZkMjRiYWQxYzMyMGRiMTdiZTMwNTc5M2VhMWFiZWQxYWQzOGE1ZjExZjI4YThmNGIzZTYxYg==", process.env.RPC_URL || "https://evmrpc.0g.ai", true // Use mock for now
        );
        const storageClient = new storage_1.StorageClient(process.env.INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai", process.env.RPC_URL || "https://evmrpc.0g.ai", process.env.PRIVATE_KEY || "0xmock-private-key", true // Use mock for now
        );
        const daClient = new da_1.DAClient(process.env.DA_CONTRACT_ADDRESS || "0xmock-contract", process.env.RPC_URL || "https://evmrpc.0g.ai", process.env.PRIVATE_KEY || "0xmock-private-key", true // Use mock for now
        );
        // Initialize pipeline executor
        const executor = new executor_1.PipelineExecutor(computeClient, storageClient, daClient, "agent-1");
        logger_1.logger.info("✓ All clients initialized");
        // Test positions
        const positions = [
            {
                protocol: "Aave",
                collateral: { asset: "ETH", amount: 100 },
                borrowed: { asset: "USDC", amount: 50000 },
                healthFactor: 1.8,
                timestamp: Date.now()
            },
            {
                protocol: "Compound",
                collateral: { asset: "ETH", amount: 50 },
                borrowed: { asset: "USDC", amount: 25000 },
                healthFactor: 2.5,
                timestamp: Date.now()
            },
            {
                protocol: "Aave",
                collateral: { asset: "ETH", amount: 200 },
                borrowed: { asset: "USDC", amount: 150000 },
                healthFactor: 1.2,
                timestamp: Date.now()
            }
        ];
        // Execute risk analysis for each position
        logger_1.logger.info(`\n=== Starting Risk Analysis ===`);
        logger_1.logger.info(`Processing ${positions.length} positions...\n`);
        for (let i = 0; i < positions.length; i++) {
            try {
                logger_1.logger.info(`\n--- Position ${i + 1}/${positions.length} ---`);
                const result = await executor.execute(positions[i]);
                logger_1.logger.info(`\nResult Summary:`);
                logger_1.logger.info(`  Protocol: ${result.position.protocol}`);
                logger_1.logger.info(`  Health Factor: ${result.position.healthFactor}`);
                logger_1.logger.info(`  Risk Level: ${result.analysis.riskLevel}`);
                logger_1.logger.info(`  Decision: ${result.decision.action}`);
                logger_1.logger.info(`  Confidence: ${result.analysis.confidence.toFixed(2)}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to process position ${i + 1}:`, error);
            }
        }
        logger_1.logger.info(`\n=== Risk Analysis Complete ===`);
        logger_1.logger.info(`Total cycles: ${executor.getCurrentCycle()}`);
        logger_1.logger.info(`Agent ID: ${executor.getAgentId()}`);
        // Run benchmark
        logger_1.logger.info(`\n=== Running Performance Benchmark ===`);
        const stats = await computeClient.benchmark(5);
        logger_1.logger.info("Benchmark Results:");
        logger_1.logger.info(`  P50: ${stats.p50}ms`);
        logger_1.logger.info(`  P95: ${stats.p95}ms`);
        logger_1.logger.info(`  P99: ${stats.p99}ms`);
        logger_1.logger.info(`  Avg: ${stats.avg.toFixed(2)}ms`);
        // Check latency threshold
        const MAX_LATENCY = parseInt(process.env.MAX_LATENCY_MS || "15000");
        if (stats.p95 > MAX_LATENCY) {
            logger_1.logger.warn(`⚠ P95 latency (${stats.p95}ms) exceeds threshold (${MAX_LATENCY}ms)`);
        }
        else {
            logger_1.logger.info(`✓ P95 latency (${stats.p95}ms) within threshold (${MAX_LATENCY}ms)`);
        }
        logger_1.logger.info("\n✓ Sentinel 0G Integration complete");
    }
    catch (error) {
        logger_1.logger.error("Fatal error:", error);
        process.exit(1);
    }
}
// Run main function
main().catch((error) => {
    logger_1.logger.error("Unhandled error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map