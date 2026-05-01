/**
 * Swarm Coordinator (Agent 3)
 * Orchestrates multi-agent decision making and evolves as iNFT
 */

import { ComputeClient } from "../services/compute";
import { StorageClient } from "../services/storage";
import { RiskAgent } from "./risk-agent";
import { VerificationService } from "../verification/verify";
import { FallbackService } from "../services/fallback";
import { 
  ExecutionProposal, 
  SwarmDecision, 
  MemoryContext, 
  INFTMetadata,
  ComputeRequest 
} from "../types";
import { logger } from "../utils/logger";

export class SwarmCoordinator {
  private computeClient: ComputeClient;
  private storageClient: StorageClient;
  private agentId: string;
  private currentINFT: INFTMetadata;
  private currentCycle: number;
  private riskAgent: RiskAgent;
  private verificationService: VerificationService;
  private fallbackService: FallbackService;

  constructor(
    computeClient: ComputeClient,
    storageClient: StorageClient,
    agentId: string = "coordinator"
  ) {
    this.computeClient = computeClient;
    this.storageClient = storageClient;
    this.agentId = agentId;
    this.currentCycle = 0;
    this.currentINFT = this.initializeINFT();

    this.riskAgent = new RiskAgent(computeClient, agentId);
    this.verificationService = new VerificationService();
    this.fallbackService = new FallbackService(true);
  }

  /**
   * Initialize iNFT metadata
   */
  private initializeINFT(): INFTMetadata {
    const metadata: INFTMetadata = {
      id: `inft-${Date.now()}`,
      riskTolerance: 'moderate',
      maxActionsPerCycle: 2,
      availableCapital: 100000,
      totalCycles: 0,
      successCount: 0,
      failureCount: 0,
      avgQuality: 0.5,
      strategyFingerprint: '',
      lastUpdated: Date.now(),
      encrypted: false
    };
    
    metadata.strategyFingerprint = this.generateStrategyFingerprint(metadata);
    return metadata;
  }

  /**
   * Generate strategy fingerprint
   */
  private generateStrategyFingerprint(metadata: INFTMetadata): string {
    const data = {
      riskTolerance: metadata.riskTolerance,
      maxActions: metadata.maxActionsPerCycle,
      timestamp: Date.now()
    };
    return `0x${Buffer.from(JSON.stringify(data)).toString('hex').substring(0, 64)}`;
  }

  /**
   * Aggregate proposals from all agents
   */
  async aggregateProposals(
    riskProposal: ExecutionProposal,
    yieldProposal: ExecutionProposal
  ): Promise<ExecutionProposal[]> {
    logger.info("Aggregating proposals from agents...");

    const proposals: ExecutionProposal[] = [];

    if (riskProposal.action !== 'none') {
      proposals.push(riskProposal);
    }

    if (yieldProposal.action !== 'none') {
      proposals.push(yieldProposal);
    }

    logger.info(`Aggregated ${proposals.length} proposals`);
    return proposals;
  }

  /**
   * Load context from storage
   */
  async loadContext(): Promise<MemoryContext> {
    logger.info("Loading context from storage...");

    try {
      const history = await this.storageClient.getHistory("", 5);
      
      const context: MemoryContext = {
        lastNCycles: [],
        riskHistory: [],
        yieldHistory: [],
        totalCycles: this.currentINFT.totalCycles
      };

      logger.info(`Context loaded: ${history.length} cycles`);
      return context;

    } catch (error) {
      logger.error("Failed to load context:", error);
      return {
        lastNCycles: [],
        riskHistory: [],
        yieldHistory: [],
        totalCycles: 0
      };
    }
  }

  /**
   * Build coordinator decision prompt
   */
  private buildCoordinatorPrompt(
    riskProposal: ExecutionProposal,
    yieldProposal: ExecutionProposal,
    context: MemoryContext
  ): string {
    let prompt = "You are the Swarm Coordinator, the final decision-maker.\n\n";

    prompt += "PROPOSALS RECEIVED:\n";
    prompt += "1. Risk Agent:\n";
    prompt += JSON.stringify(riskProposal, null, 2);
    prompt += "\n\n";

    prompt += "2. Yield Agent:\n";
    prompt += JSON.stringify(yieldProposal, null, 2);
    prompt += "\n\n";

    prompt += "YOUR STRATEGY (from iNFT metadata):\n";
    prompt += `- Risk Tolerance: ${this.currentINFT.riskTolerance}\n`;
    prompt += `- Max Actions Per Cycle: ${this.currentINFT.maxActionsPerCycle}\n`;
    prompt += `- Capital Available: $${this.currentINFT.availableCapital}\n`;
    prompt += "\n";

    prompt += "HISTORICAL PERFORMANCE:\n";
    prompt += `- Total Cycles: ${this.currentINFT.totalCycles}\n`;
    prompt += `- Successful Protections: ${this.currentINFT.successCount}\n`;
    prompt += `- Failed Executions: ${this.currentINFT.failureCount}\n`;
    prompt += `- Avg Decision Quality: ${this.currentINFT.avgQuality.toFixed(2)}\n`;
    prompt += "\n";

    prompt += "TASK:\n";
    prompt += "Decide which proposals to approve. Consider:\n";
    prompt += "- Urgency (critical > high > medium)\n";
    prompt += "- Capital constraints\n";
    prompt += "- Conflicting actions\n";
    prompt += "- Historical outcomes of similar decisions\n";
    prompt += "\n";

    prompt += "OUTPUT (JSON only):\n";
    prompt += `{\n`;
    prompt += `  "approved": [<proposal IDs: "risk" or "yield">],\n`;
    prompt += `  "rejected": [<proposal IDs: "risk" or "yield">],\n`;
    prompt += `  "reasoning": "<board meeting summary>",\n`;
    prompt += `  "priorityOrder": [<execution sequence>],\n`;
    prompt += `  "confidence": <0-1>\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Make swarm decision
   */
  async makeDecision(
    riskProposal: ExecutionProposal,
    yieldProposal: ExecutionProposal
  ): Promise<SwarmDecision> {
    logger.info("Making swarm decision...");

    try {
      const context = await this.loadContext();
      const prompt = this.buildCoordinatorPrompt(riskProposal, yieldProposal, context);

      const request: ComputeRequest = {
        prompt,
        model: "zai-org/GLM-5-FP8",
        temperature: 0.3,
        maxTokens: 2048,
        verifyTee: true
      };

      const response = await this.computeClient.verifiedEvaluate(request);
      const decision = this.parseSwarmDecision(response.choices[0].message.content);

      logger.info(`Swarm decision made: ${decision.approved.length} approved, ${decision.rejected.length} rejected`);
      return decision;

    } catch (error) {
      logger.error("Failed to make swarm decision:", error);
      throw error;
    }
  }

  /**
   * Parse swarm decision from response
   */
  private parseSwarmDecision(content: string): SwarmDecision {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const approved: ExecutionProposal[] = [];
        const rejected: ExecutionProposal[] = [];

        if (Array.isArray(parsed.approved)) {
          parsed.approved.forEach((agentId: string) => {
            if (agentId === 'risk') {
              approved.push({
                agentId: 'risk',
                action: 'repay_debt',
                urgency: 'high',
                reasoning: 'Approved by coordinator',
                data: {},
                confidence: 0.8,
                timestamp: Date.now()
              });
            } else if (agentId === 'yield') {
              approved.push({
                agentId: 'yield',
                action: 'rebalance_lp',
                urgency: 'medium',
                reasoning: 'Approved by coordinator',
                data: {},
                confidence: 0.7,
                timestamp: Date.now()
              });
            }
          });
        }

        if (Array.isArray(parsed.rejected)) {
          parsed.rejected.forEach((agentId: string) => {
            if (agentId === 'risk') {
              rejected.push({
                agentId: 'risk',
                action: 'none',
                urgency: 'low',
                reasoning: 'Rejected by coordinator',
                data: {},
                confidence: 0.5,
                timestamp: Date.now()
              });
            } else if (agentId === 'yield') {
              rejected.push({
                agentId: 'yield',
                action: 'none',
                urgency: 'low',
                reasoning: 'Rejected by coordinator',
                data: {},
                confidence: 0.5,
                timestamp: Date.now()
              });
            }
          });
        }

        return {
          approved,
          rejected,
          reasoning: parsed.reasoning || "No reasoning provided",
          signature: "0xmock_coordinator_signature",
          attestation: "0xmock_coordinator_attestation",
          timestamp: Date.now(),
          priorityOrder: parsed.priorityOrder || [],
          confidence: parsed.confidence || 0.5
        };
      }

      throw new Error("No JSON found in response");

    } catch (error) {
      logger.error("Failed to parse swarm decision:", error);
      return {
        approved: [],
        rejected: [],
        reasoning: "Failed to parse decision",
        signature: "0xerror",
        attestation: "0xerror",
        timestamp: Date.now(),
        priorityOrder: [],
        confidence: 0.0
      };
    }
  }

  /**
   * Validate decision
   */
  validateDecision(decision: SwarmDecision): boolean {
    logger.info("Validating swarm decision...");

    if (decision.approved.length > this.currentINFT.maxActionsPerCycle) {
      logger.warn(`Too many approved actions: ${decision.approved.length} > ${this.currentINFT.maxActionsPerCycle}`);
      return false;
    }

    if (decision.confidence < 0.5) {
      logger.warn(`Low confidence: ${decision.confidence}`);
      return false;
    }

    logger.info("Decision validation passed");
    return true;
  }

  /**
   * Get current iNFT metadata
   */
  getINFTMetadata(): INFTMetadata {
    return { ...this.currentINFT };
  }

  /**
   * Update iNFT metadata
   */
  updateINFTMetadata(update: Partial<INFTMetadata>): void {
    this.currentINFT = {
      ...this.currentINFT,
      ...update,
      lastUpdated: Date.now(),
      strategyFingerprint: this.generateStrategyFingerprint(this.currentINFT)
    };
    logger.info("iNFT metadata updated");
  }

  /**
   * Evolve iNFT based on decision outcome
   */
  evolveINFT(decision: SwarmDecision, success: boolean): void {
    logger.info(`Evolving iNFT (success: ${success})...`);

    this.currentINFT.totalCycles++;

    if (success) {
      this.currentINFT.successCount++;
      
      if (this.currentINFT.successCount % 5 === 0) {
        logger.info("5 consecutive successes - becoming more aggressive");
        if (this.currentINFT.riskTolerance === 'conservative') {
          this.currentINFT.riskTolerance = 'moderate';
        } else if (this.currentINFT.riskTolerance === 'moderate') {
          this.currentINFT.riskTolerance = 'aggressive';
        }
      }
    } else {
      this.currentINFT.failureCount++;
      
      if (this.currentINFT.failureCount % 3 === 0) {
        logger.info("3 consecutive failures - becoming more conservative");
        if (this.currentINFT.riskTolerance === 'aggressive') {
          this.currentINFT.riskTolerance = 'moderate';
        } else if (this.currentINFT.riskTolerance === 'moderate') {
          this.currentINFT.riskTolerance = 'conservative';
        }
      }
    }

    this.currentINFT.avgQuality = 
      (this.currentINFT.successCount / this.currentINFT.totalCycles);
    
    this.currentINFT.strategyFingerprint = this.generateStrategyFingerprint(this.currentINFT);
    this.currentINFT.lastUpdated = Date.now();

    logger.info(`iNFT evolved: ${this.currentINFT.totalCycles} cycles, ${this.currentINFT.avgQuality.toFixed(2)} quality`);
  }
}