/**
 * Sentinel 0G Integration - Main Entry Point
 * Verified AI risk guardian using 0G primitives
 */

import dotenv from "dotenv";
import { ComputeClient } from "./services/compute";
import { StorageClient } from "./services/storage";
import { DAClient } from "./services/da";
import { PipelineExecutor } from "./pipeline/executor";
import { Position } from "./types";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

/**
 * Main application
 */
async function main() {
  logger.info("Starting Sentinel 0G Integration...");

  try {
    // Initialize clients
    const computeClient = new ComputeClient(
      process.env.API_KEY || "app-sk-eyJhZGRyZXNzIjoiMHg1YUQzRWNBNjVGYmE2OWVGYUM3MTZkNzkyQWJFMTkwNDE2MmYxQjEwIiwicHJvdmlkZXIiOiIweGE0OGYwMTI4NzIzMzUwOUZENjk0YTIyQmY4NDAyMjUwNjJFNjc4MzYiLCJ0aW1lc3RhbXAiOjE3Nzc4MTE2NTc0MTEsImV4cGlyZXNBdCI6MCwibm9uY2UiOiIxNzc3ODExNjU3NDExLXcybnFiNDFvdjNpMDAwMDAwMCIsImdlbmVyYXRpb24iOjAsInRva2VuSWQiOjB9fDB4ZDkxMDc5ZmE1ZTdkNjE2MWQzMjI2ZmNkYWU0N2RiZGM1NmRlZGFkYzY4OTRjMjNkZGZlOTlhZGE1Nzk5NjFmODY0NmE4MzdjMTcwYTZkMjRiYWQxYzMyMGRiMTdiZTMwNTc5M2VhMWFiZWQxYWQzOGE1ZjExZjI4YThmNGIzZTYxYg==",
      process.env.RPC_URL || "https://evmrpc.0g.ai",
      true // Use mock for now
    );

    const storageClient = new StorageClient(
      process.env.INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai",
      process.env.RPC_URL || "https://evmrpc.0g.ai",
      process.env.PRIVATE_KEY || "0xmock-private-key",
      true // Use mock for now
    );

    const daClient = new DAClient(
      process.env.DA_CONTRACT_ADDRESS || "0xmock-contract",
      process.env.RPC_URL || "https://evmrpc.0g.ai",
      process.env.PRIVATE_KEY || "0xmock-private-key",
      true // Use mock for now
    );

    // Initialize pipeline executor
    const executor = new PipelineExecutor(
      computeClient,
      storageClient,
      daClient,
      "agent-1"
    );

    logger.info("✓ All clients initialized");

    // Test positions
    const positions: Position[] = [
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
    logger.info(`\n=== Starting Risk Analysis ===`);
    logger.info(`Processing ${positions.length} positions...\n`);

    for (let i = 0; i < positions.length; i++) {
      try {
        logger.info(`\n--- Position ${i + 1}/${positions.length} ---`);
        const result = await executor.execute(positions[i]);
        
        logger.info(`\nResult Summary:`);
        logger.info(`  Protocol: ${result.position.protocol}`);
        logger.info(`  Health Factor: ${result.position.healthFactor}`);
        logger.info(`  Risk Level: ${result.analysis.riskLevel}`);
        logger.info(`  Decision: ${result.decision.action}`);
        logger.info(`  Confidence: ${result.analysis.confidence.toFixed(2)}`);
        
      } catch (error) {
        logger.error(`Failed to process position ${i + 1}:`, error);
      }
    }

    logger.info(`\n=== Risk Analysis Complete ===`);
    logger.info(`Total cycles: ${executor.getCurrentCycle()}`);
    logger.info(`Agent ID: ${executor.getAgentId()}`);

    // Run benchmark
    logger.info(`\n=== Running Performance Benchmark ===`);
    const stats = await computeClient.benchmark(5);
    logger.info("Benchmark Results:");
    logger.info(`  P50: ${stats.p50}ms`);
    logger.info(`  P95: ${stats.p95}ms`);
    logger.info(`  P99: ${stats.p99}ms`);
    logger.info(`  Avg: ${stats.avg.toFixed(2)}ms`);

    // Check latency threshold
    const MAX_LATENCY = parseInt(process.env.MAX_LATENCY_MS || "15000");
    if (stats.p95 > MAX_LATENCY) {
      logger.warn(`⚠ P95 latency (${stats.p95}ms) exceeds threshold (${MAX_LATENCY}ms)`);
    } else {
      logger.info(`✓ P95 latency (${stats.p95}ms) within threshold (${MAX_LATENCY}ms)`);
    }

    logger.info("\n✓ Sentinel 0G Integration complete");

  } catch (error) {
    logger.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
