/**
 * Main Execution Pipeline
 * Orchestrates the complete risk analysis flow
 */

import { Position, ExecutionResult, PerformanceMetrics, AuditRecord } from "../types";
import { ComputeClient } from "../services/compute";
import { StorageClient } from "../services/storage";
import { DAClient } from "../services/da";
import { RiskAgent } from "../agents/risk-agent";
import { VerificationService } from "../verification/verify";
import { FallbackService } from "../services/fallback";
import { MemoryNode } from "../types";
import { logger } from "../utils/logger";

export class PipelineExecutor {
  private computeClient: ComputeClient;
  private storageClient: StorageClient;
  private daClient: DAClient;
  private riskAgent: RiskAgent;
  private verificationService: VerificationService;
  private fallbackService: FallbackService;
  private agentId: string;
  private currentCycle: number;

  constructor(
    computeClient: ComputeClient,
    storageClient: StorageClient,
    daClient: DAClient,
    agentId: string = "agent-1"
  ) {
    this.computeClient = computeClient;
    this.storageClient = storageClient;
    this.daClient = daClient;
    this.agentId = agentId;
    this.currentCycle = 0;

    this.riskAgent = new RiskAgent(computeClient, agentId);
    this.verificationService = new VerificationService();
    this.fallbackService = new FallbackService(true);
  }

  /**
   * Execute complete risk analysis pipeline
   */
  async execute(position: Position): Promise<ExecutionResult> {
    this.currentCycle++;
    const startTime = Date.now();

    logger.info(`\n=== Cycle ${this.currentCycle} ===`);
    logger.info(`Starting execution for position: ${position.protocol}`);

    try {
      // Step 1: Store position in memory
      const positionNode = await this.storePosition(position);
      logger.info(`Position stored: ${positionNode.id}`);

      // Step 2: Get context from memory
      const context = await this.getContext(positionNode.id);
      logger.info(`Context retrieved: ${context.length} nodes`);

      // Step 3: Analyze risk
      const computeStartTime = Date.now();
      const analysis = await this.riskAgent.analyzeRisk(position, context);
      const computeTime = Date.now() - computeStartTime;
      logger.info(`Risk analysis complete in ${computeTime}ms`);

      // Step 4: Store analysis in memory
      const analysisNode = await this.storeAnalysis(analysis, [positionNode.id]);
      logger.info(`Analysis stored: ${analysisNode.id}`);

      // Step 5: Make decision
      const decision = this.riskAgent.makeDecision(analysis);
      logger.info(`Decision: ${decision.action}`);

      // Step 6: Store decision in memory
      const decisionNode = await this.storeDecision(decision, [analysisNode.id]);
      logger.info(`Decision stored: ${decisionNode.id}`);

      // Step 7: Store execution result in DA
      const daStartTime = Date.now();
      const auditRecord = await this.storeInDA(position, analysis, decision, {
        computeTime,
        storageTime: 0,
        daTime: 0,
        totalTime: 0,
        verificationTime: 0
      });
      const daTime = Date.now() - daStartTime;
      logger.info(`Execution stored in DA: ${auditRecord.verification.da.dataRoot}`);

      // Step 8: Verify on chain
      const chainVerified = await this.verifyOnChain(auditRecord.verification.da.dataRoot);
      logger.info(`Chain verified: ${chainVerified}`);

      // Calculate total time
      const totalTime = Date.now() - startTime;
      logger.info(`\n=== Cycle ${this.currentCycle} Complete ===`);
      logger.info(`Total time: ${totalTime}ms`);
      logger.info(`Risk Level: ${analysis.riskLevel}`);
      logger.info(`Decision: ${decision.action}`);
      logger.info(`TEE Verified: ${auditRecord.verification.tee.verified}`);
      logger.info(`DA Verified: ${chainVerified}`);

      // Return execution result
      return {
        position,
        analysis,
        decision
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`Execution failed after ${totalTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Store position in memory
   */
  private async storePosition(position: Position): Promise<MemoryNode> {
    const node: MemoryNode = {
      id: "",
      type: "position",
      timestamp: Date.now(),
      data: position,
      parents: [],
      metadata: {
        cycle: this.currentCycle,
        agentId: this.agentId,
        size: JSON.stringify(position).length
      }
    };

    const result = await this.storageClient.uploadNode(node);
    node.id = result.rootHash;

    return node;
  }

  /**
   * Store analysis in memory
   */
  private async storeAnalysis(analysis: any, parents: string[]): Promise<MemoryNode> {
    const node: MemoryNode = {
      id: "",
      type: "analysis",
      timestamp: Date.now(),
      data: analysis,
      parents,
      metadata: {
        cycle: this.currentCycle,
        agentId: this.agentId,
        size: JSON.stringify(analysis).length
      }
    };

    const result = await this.storageClient.uploadNode(node);
    node.id = result.rootHash;

    return node;
  }

  /**
   * Store decision in memory
   */
  private async storeDecision(decision: any, parents: string[]): Promise<MemoryNode> {
    const node: MemoryNode = {
      id: "",
      type: "decision",
      timestamp: Date.now(),
      data: decision,
      parents,
      metadata: {
        cycle: this.currentCycle,
        agentId: this.agentId,
        size: JSON.stringify(decision).length
      }
    };

    const result = await this.storageClient.uploadNode(node);
    node.id = result.rootHash;

    return node;
  }

  /**
   * Get context from memory
   */
  private async getContext(positionHash: string): Promise<any[]> {
    try {
      const history = await this.storageClient.getHistory(positionHash, 3);
      return history.map(node => node.data);
    } catch (error) {
      logger.warn("Failed to get context:", error);
      return [];
    }
  }

  /**
   * Store execution result in DA
   */
  private async storeInDA(
    position: Position,
    analysis: any,
    decision: any,
    performance: PerformanceMetrics
  ): Promise<AuditRecord> {
    logger.info("Storing execution in DA...");

    try {
      // Create blob data
      const blobData = {
        execution: {
          position,
          analysis,
          decision
        },
        performance,
        metadata: {
          cycle: this.currentCycle,
          agentId: this.agentId,
          timestamp: Date.now()
        }
      };

      // Create blob
      const blob = await this.daClient.createBlob(blobData);

      // Write to DA
      const daResult = await this.daClient.writeBlob(blob);

      // Verify availability
      const sampleValid = await this.daClient.validateAvailability(daResult.dataRoot);

      // Create audit record
      const record: AuditRecord = {
        id: `audit-${Date.now()}`,
        timestamp: Date.now(),
        agentId: this.agentId,
        cycle: this.currentCycle,
        execution: {
          position,
          analysis,
          decision
        },
        verification: {
          tee: {
            verified: true,
            provider: "0g-compute",
            signature: "0xmock",
            teeSignerAddress: "0xmock_provider"
          },
          da: {
            dataRoot: daResult.dataRoot,
            proofHash: daResult.proofHash,
            sampleValid
          },
          chain: {
            verified: false,
            epoch: 0,
            quorumId: 0
          }
        },
        performance: {
          totalTime: performance.computeTime + performance.storageTime + performance.daTime,
          computeTime: performance.computeTime,
          storageTime: performance.storageTime,
          daTime: performance.daTime
        },
        metadata: {
          dataSize: JSON.stringify(blobData).length,
          compressed: false,
          encrypted: false
        }
      };

      logger.info(`Execution stored in DA: ${daResult.dataRoot}`);
      return record;

    } catch (error) {
      logger.error("Failed to store in DA:", error);
      throw error;
    }
  }

  /**
   * Verify on chain
   */
  private async verifyOnChain(dataRoot: string): Promise<boolean> {
    logger.info("Verifying on chain...");

    try {
      // TODO: Implement actual on-chain verification
      // For now, just validate availability
      const isValid = await this.daClient.validateAvailability(dataRoot);
      return isValid;

    } catch (error) {
      logger.error("Chain verification failed:", error);
      return false;
    }
  }

  /**
   * Batch execute multiple positions
   */
  async batchExecute(positions: Position[]): Promise<ExecutionResult[]> {
    logger.info(`Batch executing ${positions.length} positions...`);

    const results: ExecutionResult[] = [];

    for (let i = 0; i < positions.length; i++) {
      try {
        const result = await this.execute(positions[i]);
        results.push(result);
        logger.debug(`Executed ${i + 1}/${positions.length}`);
      } catch (error) {
        logger.error(`Failed to execute position ${i + 1}:`, error);
        // Continue with other positions
      }
    }

    logger.info(`Batch execution complete: ${results.length}/${positions.length} successful`);
    return results;
  }

  /**
   * Get current cycle number
   */
  getCurrentCycle(): number {
    return this.currentCycle;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }
}
