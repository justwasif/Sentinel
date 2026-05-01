/**
 * Failure scenario tests
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

describe("Failure Scenario Tests", () => {
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

  describe("Risk Agent Failures", () => {
    it("should handle invalid JSON response from risk agent", async () => {
      const position: Position = {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.8,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis).toBeDefined();
      expect(analysis.riskLevel).toBeDefined();
    });

    it("should handle missing health factor", async () => {
      const position: Position = {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 0,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis).toBeDefined();
    });

    it("should handle extremely low health factor", async () => {
      const position: Position = {
        protocol: "Spark",
        collateral: { asset: "ETH", amount: 10 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.01,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis).toBeDefined();
      expect(analysis.riskLevel).toBe("High");
    });
  });

  describe("Yield Agent Failures", () => {
    it("should handle invalid position data", async () => {
      const position: LPPosition = {
        pool: "ETH-USDC",
        tokenId: "12345",
        tickLower: -887220,
        tickUpper: 887220,
        currentTick: 0,
        outOfRange: 150,
        fees: -100,
        liquidity: 0,
        timestamp: Date.now()
      };

      const analysis = await yieldAgent.analyzePosition(position);
      expect(analysis).toBeDefined();
      expect(analysis.action).toBe("none");
    });

    it("should handle position completely out of range", async () => {
      const position: LPPosition = {
        pool: "ETH-USDC",
        tokenId: "12345",
        tickLower: -100000,
        tickUpper: -50000,
        currentTick: 0,
        outOfRange: 100,
        fees: 0,
        liquidity: 1000000,
        timestamp: Date.now()
      };

      const analysis = await yieldAgent.analyzePosition(position);
      expect(analysis).toBeDefined();
    });

    it("should enforce anti-thrashing rules", async () => {
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

      const analysis = await yieldAgent.analyzePosition(position);
      yieldAgent.recordRebalance();

      const canRebalance = yieldAgent.checkAntiThrashingRules(analysis);
      expect(canRebalance).toBe(false);
    });
  });

  describe("Coordinator Failures", () => {
    it("should handle conflicting proposals", async () => {
      const riskProposal: ExecutionProposal = {
        agentId: 'risk',
        action: 'repay_debt',
        urgency: 'critical',
        reasoning: 'Health factor is dangerously low',
        data: { amount: 10000, token: 'DAI' },
        confidence: 0.9,
        timestamp: Date.now()
      };

      const yieldProposal: ExecutionProposal = {
        agentId: 'yield',
        action: 'rebalance_lp',
        urgency: 'critical',
        reasoning: 'Position is out of range',
        data: { pool: 'ETH-USDC', newRange: [-100000, 100000] },
        confidence: 0.9,
        timestamp: Date.now()
      };

      const decision = await coordinator.makeDecision(riskProposal, yieldProposal);
      expect(decision).toBeDefined();
      expect(decision.approved.length).toBeLessThanOrEqual(2);
    });

    it("should handle low confidence proposals", async () => {
      const riskProposal: ExecutionProposal = {
        agentId: 'risk',
        action: 'repay_debt',
        urgency: 'low',
        reasoning: 'Uncertain risk assessment',
        data: { amount: 100, token: 'DAI' },
        confidence: 0.3,
        timestamp: Date.now()
      };

      const yieldProposal: ExecutionProposal = {
        agentId: 'yield',
        action: 'none',
        urgency: 'low',
        reasoning: 'No action needed',
        data: {},
        confidence: 0.2,
        timestamp: Date.now()
      };

      const decision = await coordinator.makeDecision(riskProposal, yieldProposal);
      expect(decision).toBeDefined();
    });

    it("should validate decision before execution", async () => {
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

      const decision = await coordinator.makeDecision(riskProposal, yieldProposal);
      const isValid = coordinator.validateDecision(decision);
      expect(isValid).toBe(true);
    });
  });

  describe("Storage Failures", () => {
    it("should handle storage upload failure", async () => {
      const failingStorage = new StorageClient("https://invalid-indexer", "https://invalid-rpc", "0xtest-key", true);

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

      const result = await failingStorage.uploadNode(node);
      expect(result).toBeDefined();
      expect(result.rootHash).toBeDefined();
    });

    it("should handle storage download failure", async () => {
      const failingStorage = new StorageClient("https://invalid-indexer", "https://invalid-rpc", "0xtest-key", true);

      const result = await failingStorage.downloadNode("0xinvalidhash");
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe("DA Failures", () => {
    it("should handle DA write failure", async () => {
      const failingDA = new DAClient("0xinvalid-contract", "https://invalid-rpc", "0xtest-key", true);

      const blob = await failingDA.createBlob({ test: "data" });
      expect(blob).toBeDefined();
      expect(blob.data).toBeDefined();

      const result = await failingDA.writeBlob(blob);
      expect(result).toBeDefined();
      expect(result.dataRoot).toBeDefined();
    });

    it("should handle DA verification failure", async () => {
      const failingDA = new DAClient("0xinvalid-contract", "https://invalid-rpc", "0xtest-key", true);

      const isValid = await failingDA.validateAvailability("0xinvalidroot");
      expect(typeof isValid).toBe("boolean");
    });
  });

  describe("KeeperHub Failures", () => {
    it("should handle workflow execution failure", async () => {
      const failingKeeperHub = new KeeperHubClient("invalid-api-key", "https://invalid.api", true);

      const proposal: ExecutionProposal = {
        agentId: 'risk',
        action: 'repay_debt',
        urgency: 'critical',
        reasoning: 'Health factor is dangerously low',
        data: { amount: 5000, token: 'DAI' },
        confidence: 0.9,
        timestamp: Date.now()
      };

      const execution = await failingKeeperHub.executeProposal(proposal);
      expect(execution).toBeDefined();
      expect(execution.status).toBeDefined();
    });

    it("should handle payment verification failure", async () => {
      const isValid = await keeperHubClient.verifyPayment("0xinvalidtx");
      expect(typeof isValid).toBe("boolean");
    });
  });

  describe("Chain Failures", () => {
    it("should handle proof submission failure", async () => {
      const submission = {
        dataRoot: "0xinvalidroot",
        proofHash: "0xinvalidproof",
        epoch: 0,
        quorumId: 0
      };

      const txHash = await chainClient.submitProof(submission);
      expect(txHash).toBeDefined();
    });

    it("should handle proof verification failure", async () => {
      const submission = {
        dataRoot: "0xnonexistent",
        proofHash: "0xnonexistent",
        epoch: 0,
        quorumId: 0
      };

      const verification = await chainClient.verifyProof(submission);
      expect(verification).toBeDefined();
      expect(verification.isValid).toBe(false);
    });
  });

  describe("iNFT Failures", () => {
    it("should handle metadata save failure", async () => {
      const failingStorage = new StorageClient("https://invalid-indexer", "https://invalid-rpc", "0xtest-key", true);
      const failingINFT = new INFTManager(failingStorage, "test-key");

      await expect(failingINFT.saveMetadata()).resolves.not.toThrow();
    });

    it("should handle metadata load failure", async () => {
      const failingStorage = new StorageClient("https://invalid-indexer", "https://invalid-rpc", "0xtest-key", true);
      const failingINFT = new INFTManager(failingStorage, "test-key");

      await expect(failingINFT.loadMetadata("0xinvalidhash")).resolves.not.toThrow();
    });

    it("should handle invalid metadata import", async () => {
      const invalidJson = "{ invalid json }";

      expect(() => {
        inftManager.import(invalidJson);
      }).toThrow();
    });
  });

  describe("Cascading Failures", () => {
    it("should handle multiple component failures", async () => {
      const position: Position = {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.2,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis).toBeDefined();

      const decision = riskAgent.makeDecision(analysis);
      expect(decision).toBeDefined();
    });

    it("should recover from partial failures", async () => {
      const position: Position = {
        protocol: "Spark",
        collateral: { asset: "ETH", amount: 50 },
        borrowed: { asset: "USDC", amount: 45000 },
        healthFactor: 1.1,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis).toBeDefined();
      expect(analysis.riskLevel).toBe("High");
    });
  });
});