/**
 * Performance tests and benchmarks
 */

import { ComputeClient } from "../../src/services/compute";
import { StorageClient } from "../../src/services/storage";
import { DAClient } from "../../src/services/da";
import { RiskAgent } from "../../src/agents/risk-agent";
import { YieldAgent } from "../../src/agents/yield-agent";
import { SwarmCoordinator } from "../../src/agents/coordinator";
import { INFTManager } from "../../src/inft/metadata";
import { KeeperHubClient } from "../../src/services/keeperhub";
import { MockChainClient } from "../../src/services/chain";
import { Position, LPPosition, ExecutionProposal } from "../../src/types";

describe("Performance Tests and Benchmarks", () => {
  let computeClient: ComputeClient;
  let storageClient: StorageClient;
  let daClient: DAClient;
  let riskAgent: RiskAgent;
  let yieldAgent: YieldAgent;
  let coordinator: SwarmCoordinator;
  let inftManager: INFTManager;
  let keeperHubClient: KeeperHubClient;
  let chainClient: MockChainClient;

  beforeEach(() => {
    computeClient = new ComputeClient("test-key", "https://test.rpc", true);
    storageClient = new StorageClient("https://test-indexer", "https://test-rpc", "0xtest-key", true);
    daClient = new DAClient("0xtest-contract", "https://test-rpc", "0xtest-key", true);
    riskAgent = new RiskAgent(computeClient, "risk-agent");
    yieldAgent = new YieldAgent(computeClient, "yield-agent");
    coordinator = new SwarmCoordinator(computeClient, storageClient, "coordinator");
    inftManager = new INFTManager(storageClient, "test-encryption-key");
    keeperHubClient = new KeeperHubClient("test-api-key", "https://test.api", true);
    chainClient = new MockChainClient();
  });

  describe("Compute Performance", () => {
    it("should meet latency target for risk analysis", async () => {
      const position: Position = {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.8,
        timestamp: Date.now()
      };

      const startTime = Date.now();
      await riskAgent.analyzeRisk(position);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(15000);
    });

    it("should meet latency target for yield analysis", async () => {
      const position: LPPosition = {
        pool: "ETH-USDC",
        tokenId: "12345",
        tickLower: -887220,
        tickUpper: 887220,
        currentTick: 0,
        outOfRange: 80,
        fees: 1500,
        liquidity: 1000000,
        timestamp: Date.now()
      };

      const startTime = Date.now();
      await yieldAgent.analyzePosition(position);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(15000);
    });

    it("should handle concurrent compute requests", async () => {
      const positions: Position[] = Array.from({ length: 10 }, (_, i) => ({
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 + i },
        borrowed: { asset: "USDC", amount: 50000 + i * 1000 },
        healthFactor: 1.5 + i * 0.1,
        timestamp: Date.now()
      }));

      const startTime = Date.now();
      const promises = positions.map(p => riskAgent.analyzeRisk(p));
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(60000);
    });
  });

  describe("Storage Performance", () => {
    it("should meet latency target for storage upload", async () => {
      const node = {
        id: "",
        type: "position" as const,
        timestamp: Date.now(),
        data: { test: "data" },
        parents: [],
        metadata: {
          cycle: 1,
          agentId: "test",
          size: 100
        }
      };

      const startTime = Date.now();
      await storageClient.uploadNode(node);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(5000);
    });

    it("should meet latency target for storage download", async () => {
      const startTime = Date.now();
      await storageClient.downloadNode("0xtesthash");
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(5000);
    });

    it("should handle batch storage operations", async () => {
      const nodes = Array.from({ length: 50 }, (_, i) => ({
        id: "",
        type: "position" as const,
        timestamp: Date.now(),
        data: { test: `data-${i}` },
        parents: [],
        metadata: {
          cycle: i,
          agentId: "test",
          size: 100
        }
      }));

      const startTime = Date.now();
      await storageClient.batchUpload(nodes);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(30000);
    });
  });

  describe("DA Performance", () => {
    it("should meet latency target for blob creation", async () => {
      const data = { test: "data" };

      const startTime = Date.now();
      await daClient.createBlob(data);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(1000);
    });

    it("should meet latency target for blob write", async () => {
      const blob = await daClient.createBlob({ test: "data" });

      const startTime = Date.now();
      await daClient.writeBlob(blob);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(10000);
    });

    it("should meet latency target for availability verification", async () => {
      const startTime = Date.now();
      await daClient.validateAvailability("0xtestroot");
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(5000);
    });
  });

  describe("Coordinator Performance", () => {
    it("should meet latency target for decision making", async () => {
      const riskProposal: ExecutionProposal = {
        agentId: 'risk',
        action: 'repay_debt',
        urgency: 'critical',
        reasoning: 'Health factor is dangerously low',
        data: { amount: 5000, token: 'DAI' },
        confidence: 0.9,
        timestamp: Date.now()
      };

      const yieldProposal: ExecutionProposal = {
        agentId: 'yield',
        action: 'none',
        urgency: 'low',
        reasoning: 'No action needed',
        data: {},
        confidence: 0.5,
        timestamp: Date.now()
      };

      const startTime = Date.now();
      await coordinator.makeDecision(riskProposal, yieldProposal);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(15000);
    });
  });

  describe("iNFT Performance", () => {
    it("should meet latency target for metadata save", async () => {
      const startTime = Date.now();
      await inftManager.saveMetadata();
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(5000);
    });

    it("should meet latency target for iNFT evolution", async () => {
      const mockDecision = {
        approved: [],
        rejected: [],
        reasoning: "Test decision",
        signature: "0xtest",
        attestation: "0xtest",
        timestamp: Date.now(),
        priorityOrder: [],
        confidence: 0.8
      };

      const startTime = Date.now();
      await inftManager.evolveINFT(mockDecision, true);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(10000);
    });
  });

  describe("KeeperHub Performance", () => {
    it("should meet latency target for workflow execution", async () => {
      const proposal: ExecutionProposal = {
        agentId: 'risk',
        action: 'repay_debt',
        urgency: 'critical',
        reasoning: 'Health factor is dangerously low',
        data: { amount: 5000, token: 'DAI' },
        confidence: 0.9,
        timestamp: Date.now()
      };

      const startTime = Date.now();
      await keeperHubClient.executeProposal(proposal);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(10000);
    });

    it("should meet latency target for workflow listing", async () => {
      const startTime = Date.now();
      await keeperHubClient.listWorkflows();
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(5000);
    });
  });

  describe("Chain Performance", () => {
    it("should meet latency target for proof submission", async () => {
      const submission = {
        dataRoot: "0xtestdataroot",
        proofHash: "0xtestproofhash",
        epoch: 100,
        quorumId: 0
      };

      const startTime = Date.now();
      await chainClient.submitProof(submission);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(5000);
    });

    it("should meet latency target for proof verification", async () => {
      const submission = {
        dataRoot: "0xtestdataroot",
        proofHash: "0xtestproofhash",
        epoch: 100,
        quorumId: 0
      };

      const startTime = Date.now();
      await chainClient.verifyProof(submission);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(3000);
    });
  });

  describe("End-to-End Performance", () => {
    it("should complete full swarm cycle within target time", async () => {
      const position: Position = {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.2,
        timestamp: Date.now()
      };

      const lpPosition: LPPosition = {
        pool: "ETH-USDC",
        tokenId: "12345",
        tickLower: -887220,
        tickUpper: 887220,
        currentTick: 0,
        outOfRange: 80,
        fees: 1500,
        liquidity: 1000000,
        timestamp: Date.now()
      };

      const startTime = Date.now();

      const riskAnalysis = await riskAgent.analyzeRisk(position);
      const yieldAnalysis = await yieldAgent.analyzePosition(lpPosition);

      const riskProposal: ExecutionProposal = {
        agentId: 'risk',
        action: riskAnalysis.riskLevel === 'High' ? 'repay_debt' : 'none',
        urgency: riskAnalysis.riskLevel === 'High' ? 'critical' : 'low',
        reasoning: riskAnalysis.reasoning || 'Risk analysis',
        data: { amount: 5000, token: 'DAI' },
        confidence: riskAnalysis.confidence,
        timestamp: Date.now()
      };

      const yieldProposal: ExecutionProposal = {
        agentId: 'yield',
        action: yieldAnalysis.action,
        urgency: yieldAnalysis.urgency,
        reasoning: yieldAnalysis.reasoning,
        data: { pool: lpPosition.pool, newRange: yieldAnalysis.newRange },
        confidence: yieldAnalysis.confidence,
        timestamp: Date.now()
      };

      const decision = await coordinator.makeDecision(riskProposal, yieldProposal);

      if (decision.approved.length > 0) {
        await keeperHubClient.executeProposal(decision.approved[0]);
      }

      const mockDecision = {
        approved: decision.approved,
        rejected: decision.rejected,
        reasoning: decision.reasoning,
        signature: decision.signature,
        attestation: decision.attestation,
        timestamp: decision.timestamp,
        priorityOrder: decision.priorityOrder,
        confidence: decision.confidence
      };

      await inftManager.evolveINFT(mockDecision, true);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(60000);
    });

    it("should handle multiple concurrent cycles", async () => {
      const positions: Position[] = Array.from({ length: 5 }, (_, i) => ({
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 + i },
        borrowed: { asset: "USDC", amount: 50000 + i * 1000 },
        healthFactor: 1.5 + i * 0.1,
        timestamp: Date.now()
      }));

      const startTime = Date.now();
      const promises = positions.map(p => riskAgent.analyzeRisk(p));
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(30000);
    });
  });

  describe("Benchmark Tests", () => {
    it("should benchmark compute performance", async () => {
      const stats = await computeClient.benchmark(10);

      expect(stats.p50).toBeGreaterThan(0);
      expect(stats.p95).toBeGreaterThan(0);
      expect(stats.p99).toBeGreaterThan(0);
      expect(stats.avg).toBeGreaterThan(0);
    });

    it("should benchmark storage performance", async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const node = {
          id: "",
          type: "position" as const,
          timestamp: Date.now(),
          data: { test: `data-${i}` },
          parents: [],
          metadata: {
            cycle: i,
            agentId: "test",
            size: 100
          }
        };

        const start = Date.now();
        await storageClient.uploadNode(node);
        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);

      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];

      expect(p50).toBeLessThan(5000);
      expect(p95).toBeLessThan(10000);
    });

    it("should benchmark DA performance", async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const blob = await daClient.createBlob({ test: `data-${i}` });

        const start = Date.now();
        await daClient.writeBlob(blob);
        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);

      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];

      expect(p50).toBeLessThan(5000);
      expect(p95).toBeLessThan(10000);
    });
  });
});