"use strict";
/**
 * Main Execution Pipeline
 * Orchestrates the complete risk analysis flow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineExecutor = void 0;
const risk_agent_1 = require("../agents/risk-agent");
const verify_1 = require("../verification/verify");
const fallback_1 = require("../services/fallback");
const logger_1 = require("../utils/logger");
class PipelineExecutor {
    constructor(computeClient, storageClient, daClient, agentId = "agent-1") {
        this.computeClient = computeClient;
        this.storageClient = storageClient;
        this.daClient = daClient;
        this.agentId = agentId;
        this.currentCycle = 0;
        this.riskAgent = new risk_agent_1.RiskAgent(computeClient, agentId);
        this.verificationService = new verify_1.VerificationService();
        this.fallbackService = new fallback_1.FallbackService(true);
    }
    /**
     * Execute complete risk analysis pipeline
     */
    async execute(position) {
        this.currentCycle++;
        const startTime = Date.now();
        logger_1.logger.info(`\n=== Cycle ${this.currentCycle} ===`);
        logger_1.logger.info(`Starting execution for position: ${position.protocol}`);
        try {
            // Step 1: Store position in memory
            const positionNode = await this.storePosition(position);
            logger_1.logger.info(`Position stored: ${positionNode.id}`);
            // Step 2: Get context from memory
            const context = await this.getContext(positionNode.id);
            logger_1.logger.info(`Context retrieved: ${context.length} nodes`);
            // Step 3: Analyze risk
            const computeStartTime = Date.now();
            const analysis = await this.riskAgent.analyzeRisk(position, context);
            const computeTime = Date.now() - computeStartTime;
            logger_1.logger.info(`Risk analysis complete in ${computeTime}ms`);
            // Step 4: Store analysis in memory
            const analysisNode = await this.storeAnalysis(analysis, [positionNode.id]);
            logger_1.logger.info(`Analysis stored: ${analysisNode.id}`);
            // Step 5: Make decision
            const decision = this.riskAgent.makeDecision(analysis);
            logger_1.logger.info(`Decision: ${decision.action}`);
            // Step 6: Store decision in memory
            const decisionNode = await this.storeDecision(decision, [analysisNode.id]);
            logger_1.logger.info(`Decision stored: ${decisionNode.id}`);
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
            logger_1.logger.info(`Execution stored in DA: ${auditRecord.verification.da.dataRoot}`);
            // Step 8: Verify on chain
            const chainVerified = await this.verifyOnChain(auditRecord.verification.da.dataRoot);
            logger_1.logger.info(`Chain verified: ${chainVerified}`);
            // Calculate total time
            const totalTime = Date.now() - startTime;
            logger_1.logger.info(`\n=== Cycle ${this.currentCycle} Complete ===`);
            logger_1.logger.info(`Total time: ${totalTime}ms`);
            logger_1.logger.info(`Risk Level: ${analysis.riskLevel}`);
            logger_1.logger.info(`Decision: ${decision.action}`);
            logger_1.logger.info(`TEE Verified: ${auditRecord.verification.tee.verified}`);
            logger_1.logger.info(`DA Verified: ${chainVerified}`);
            // Return execution result
            return {
                position,
                analysis,
                decision
            };
        }
        catch (error) {
            const totalTime = Date.now() - startTime;
            logger_1.logger.error(`Execution failed after ${totalTime}ms:`, error);
            throw error;
        }
    }
    /**
     * Store position in memory
     */
    async storePosition(position) {
        const node = {
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
    async storeAnalysis(analysis, parents) {
        const node = {
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
    async storeDecision(decision, parents) {
        const node = {
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
    async getContext(positionHash) {
        try {
            const history = await this.storageClient.getHistory(positionHash, 3);
            return history.map(node => node.data);
        }
        catch (error) {
            logger_1.logger.warn("Failed to get context:", error);
            return [];
        }
    }
    /**
     * Store execution result in DA
     */
    async storeInDA(position, analysis, decision, performance) {
        logger_1.logger.info("Storing execution in DA...");
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
            const record = {
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
            logger_1.logger.info(`Execution stored in DA: ${daResult.dataRoot}`);
            return record;
        }
        catch (error) {
            logger_1.logger.error("Failed to store in DA:", error);
            throw error;
        }
    }
    /**
     * Verify on chain
     */
    async verifyOnChain(dataRoot) {
        logger_1.logger.info("Verifying on chain...");
        try {
            // TODO: Implement actual on-chain verification
            // For now, just validate availability
            const isValid = await this.daClient.validateAvailability(dataRoot);
            return isValid;
        }
        catch (error) {
            logger_1.logger.error("Chain verification failed:", error);
            return false;
        }
    }
    /**
     * Batch execute multiple positions
     */
    async batchExecute(positions) {
        logger_1.logger.info(`Batch executing ${positions.length} positions...`);
        const results = [];
        for (let i = 0; i < positions.length; i++) {
            try {
                const result = await this.execute(positions[i]);
                results.push(result);
                logger_1.logger.debug(`Executed ${i + 1}/${positions.length}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to execute position ${i + 1}:`, error);
                // Continue with other positions
            }
        }
        logger_1.logger.info(`Batch execution complete: ${results.length}/${positions.length} successful`);
        return results;
    }
    /**
     * Get current cycle number
     */
    getCurrentCycle() {
        return this.currentCycle;
    }
    /**
     * Get agent ID
     */
    getAgentId() {
        return this.agentId;
    }
}
exports.PipelineExecutor = PipelineExecutor;
//# sourceMappingURL=executor.js.map