/**
 * Integration tests for full swarm cycle
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

describe("Full Swarm Cycle Integration", () => {
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

  describe("Complete Risk Protection Cycle", () => {
    it("should execute full risk protection cycle", async () => {
      const position: Position = {
        protocol: "Aave",
        collateral: { asset: "ETH", amount: 100 },
        borrowed: { asset: "USDC", amount: 50000 },
        healthFactor: 1.2,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis).toBeDefined();
      expect(["Low", "Medium", "High"]).toContain(analysis.riskLevel);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);

      const decision = riskAgent.makeDecision(analysis);
      expect(decision).toBeDefined();
      expect(["reduce_exposure", "monitor", "hold", "increase_exposure"]).toContain(decision.action);
    });

    it("should handle high risk scenario", async () => {
      const position: Position = {
        protocol: "Spark",
        collateral: { asset: "ETH", amount: 50 },
        borrowed: { asset: "USDC", amount: 45000 },
        healthFactor: 1.1,
        timestamp: Date.now()
      };

      const analysis = await riskAgent.analyzeRisk(position);
      expect(analysis.riskLevel).toBe("High");
      expect(analysis.riskFactors).toContain("liquidation_risk");
    });
  });

  describe("Complete Yield Optimization Cycle", () => {
    it("should execute full yield optimization cycle", async () => {
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
      expect(analysis).toBeDefined();
      expect(["rebalance_lp", "none"]).toContain(analysis.action);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it("should respect anti-thrashing rules", async () => {
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
      const canRebalance = yieldAgent.checkAntiThrashingRules(analysis);
      expect(canRebalance).toBe(true);

      yieldAgent.recordRebalance();
      const canRebalanceAgain = yieldAgent.checkAntiThrashingRules(analysis);
      expect(canRebalanceAgain).toBe(false);
    });
  });

  describe("Swarm Coordinator Integration", () => {
    it("should aggregate and make decisions from multiple agents", async () => {
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
        action: 'rebalance_lp',
        urgency: 'medium',
        reasoning: 'Position is out of range',
        data: { pool: 'ETH-USDC', newRange: [-100000, 100000] },
        confidence: 0.7,
        timestamp: Date.now()
      };

      const decision = await coordinator.makeDecision(riskProposal, yieldProposal);
      expect(decision).toBeDefined();
      expect(decision.approved.length).toBeGreaterThanOrEqual(0);
      expect(decision.rejected.length).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should prioritize critical risk over yield", async () => {
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
        action: 'rebalance_lp',
        urgency: 'high',
        reasoning: 'Position is out of range',
        data: { pool: 'ETH-USDC', newRange: [-100000, 100000] },
        confidence: 0.7,
        timestamp: Date.now()
      };

      const decision = await coordinator.makeDecision(riskProposal, yieldProposal);
      const riskApproved = decision.approved.some(p => p.agentId === 'risk');
      expect(riskApproved).toBe(true);
    });
  });

  describe("iNFT Evolution Integration", () => {
    it("should evolve iNFT based on successful decisions", async () => {
      const initialStats = inftManager.getEvolutionStats();
      expect(initialStats.totalCycles).toBe(0);

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

      await inftManager.evolveINFT(mockDecision, true);
      const statsAfterSuccess = inftManager.getEvolutionStats();
      expect(statsAfterSuccess.totalCycles).toBe(1);
      expect(statsAfterSuccess.successRate).toBe(1.0);

      await inftManager.evolveINFT(mockDecision, false);
      const statsAfterFailure = inftManager.getEvolutionStats();
      expect(statsAfterFailure.totalCycles).toBe(2);
      expect(statsAfterFailure.successRate).toBe(0.5);
    });

    it("should adjust risk tolerance based on performance", async () => {
      const initialMetadata = inftManager.getMetadata();
      expect(initialMetadata.riskTolerance).toBe('moderate');

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

      for (let i = 0; i < 5; i++) {
        await inftManager.evolveINFT(mockDecision, true);
      }

      const metadataAfterSuccess = inftManager.getMetadata();
      expect(metadataAfterSuccess.riskTolerance).toBe('aggressive');
    });
  });

  describe("KeeperHub Integration", () => {
    it("should execute proposal via KeeperHub", async () => {
      const proposal: ExecutionProposal = {
        agentId: 'risk',
        action: 'repay_debt',
        urgency: 'critical',
        reasoning: 'Health factor is dangerously low',
        data: { amount: 5000, token: 'DAI' },
        confidence: 0.9,
        timestamp: Date.now()
      };

      const execution = await keeperHubClient.executeProposal(proposal);
      expect(execution).toBeDefined();
      expect(execution.status).toBe('success');
      expect(execution.txHash).toBeDefined();
    });

    it("should list available workflows", async () => {
      const workflows = await keeperHubClient.listWorkflows();
      expect(workflows).toBeDefined();
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows[0].id).toBeDefined();
      expect(workflows[0].name).toBeDefined();
    });
  });

  describe("Chain Integration", () => {
    it("should submit and verify proof on-chain", async () => {
      const submission = {
        dataRoot: "0xtestdataroot",
        proofHash: "0xtestproofhash",
        epoch: 100,
        quorumId: 0
      };

      const txHash = await chainClient.submitProof(submission);
      expect(txHash).toBeDefined();
      expect(txHash).toMatch(/^0x[a-fA-F0-9]+$/);

      const verification = await chainClient.verifyProof(submission);
      expect(verification).toBeDefined();
      expect(verification.isValid).toBe(true);
    });

    it("should get proof status", async () => {
      const submission = {
        dataRoot: "0xtestdataroot2",
        proofHash: "0xtestproofhash2",
        epoch: 101,
        quorumId: 0
      };

      await chainClient.submitProof(submission);
      const status = await chainClient.getProofStatus(submission.dataRoot);
      expect(status).toBeDefined();
      expect(status.verified).toBe(true);
      expect(status.timestamp).toBeGreaterThan(0);
    });
  });

  describe("End-to-End Swarm Cycle", () => {
    it("should execute complete swarm cycle with all components", async () => {
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
      expect(decision).toBeDefined();

      if (decision.approved.length > 0) {
        const execution = await keeperHubClient.executeProposal(decision.approved[0]);
        expect(execution.status).toBe('success');
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
      const stats = inftManager.getEvolutionStats();
      expect(stats.totalCycles).toBeGreaterThan(0);
    }, 30000);
  });
});