"use strict";
/**
 * Risk Agent
 * Handles risk evaluation logic and prompt engineering
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskAgent = exports.riskEmitter = void 0;
const logger_1 = require("../utils/logger");
const events_1 = require("events");
exports.riskEmitter = new events_1.EventEmitter();
class RiskAgent {
    constructor(computeClient, agentId = "agent-1") {
        this.computeClient = computeClient;
        this.agentId = agentId;
    }
    /**
     * Analyze risk for a given position
     */
    async analyzeRisk(position, context) {
        logger_1.logger.info(`Analyzing risk for position: ${position.protocol}`);
        try {
            // Build prompt
            const prompt = this.buildRiskPrompt(position, context);
            // Execute inference
            const request = {
                prompt,
                model: "zai-org/GLM-5-FP8",
                temperature: 0.3,
                maxTokens: 2048,
                verifyTee: true
            };
            const response = await this.computeClient.verifiedEvaluate(request);
            // Parse response
            const analysis = this.parseRiskAnalysis(response.choices[0].message.content);
            logger_1.logger.info(`Risk analysis complete: ${analysis.riskLevel} (${analysis.confidence})`);
            return analysis;
        }
        catch (error) {
            logger_1.logger.error("Risk analysis failed:", error);
            throw error;
        }
    }
    /**
     * Build risk evaluation prompt
     */
    buildRiskPrompt(position, context) {
        let prompt = "Analyze this DeFi position for risk:\n\n";
        // Current position
        prompt += "Current Position:\n";
        prompt += JSON.stringify(position, null, 2);
        prompt += "\n\n";
        // Historical context
        if (context && context.length > 0) {
            prompt += "Historical Context (Last 3 cycles):\n";
            for (const ctx of context.slice(0, 3)) {
                prompt += `- ${JSON.stringify(ctx).substring(0, 200)}...\n`;
            }
            prompt += "\n";
        }
        // Request format
        prompt += "Provide JSON response in this format:\n";
        prompt += `{\n`;
        prompt += `  "riskLevel": "Low|Medium|High",\n`;
        prompt += `  "riskFactors": ["factor1", "factor2", ...],\n`;
        prompt += `  "recommendedActions": ["action1", "action2", ...],\n`;
        prompt += `  "confidence": 0.0-1.0,\n`;
        prompt += `  "reasoning": "explanation based on analysis"\n`;
        prompt += `}\n`;
        return prompt;
    }
    /**
     * Parse risk analysis from response
     */
    parseRiskAnalysis(content) {
        try {
            // Try to extract JSON from content
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                // Validate required fields
                if (!parsed.riskLevel || !["Low", "Medium", "High"].includes(parsed.riskLevel)) {
                    throw new Error("Invalid or missing riskLevel");
                }
                if (!Array.isArray(parsed.riskFactors)) {
                    throw new Error("Invalid or missing riskFactors");
                }
                if (!Array.isArray(parsed.recommendedActions)) {
                    throw new Error("Invalid or missing recommendedActions");
                }
                if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
                    throw new Error("Invalid or missing confidence");
                }
                return {
                    riskLevel: parsed.riskLevel,
                    riskFactors: parsed.riskFactors,
                    recommendedActions: parsed.recommendedActions,
                    confidence: parsed.confidence,
                    reasoning: parsed.reasoning
                };
            }
            throw new Error("No JSON found in response");
        }
        catch (error) {
            logger_1.logger.error("Failed to parse risk analysis:", error);
            // Return default analysis
            return {
                riskLevel: "Medium",
                riskFactors: ["parsing_error"],
                recommendedActions: ["manual_review"],
                confidence: 0.5,
                reasoning: "Failed to parse AI response, requiring manual review"
            };
        }
    }
    /**
     * Make decision based on risk analysis
     */
    makeDecision(analysis) {
        logger_1.logger.info(`Making decision based on risk level: ${analysis.riskLevel}`);
        let action;
        let reason;
        switch (analysis.riskLevel) {
            case "High":
                action = "reduce_exposure";
                reason = "High risk detected - immediate action required";
                break;
            case "Medium":
                action = "monitor";
                reason = "Medium risk - monitor closely";
                break;
            case "Low":
                action = "hold";
                reason = "Low risk - acceptable position";
                break;
            default:
                action = "monitor";
                reason = "Unknown risk level - monitor closely";
        }
        const decision = {
            action,
            reason,
            confidence: analysis.confidence
        };
        logger_1.logger.info(`Decision: ${action} (${reason})`);
        logger_1.logger.info(`RiskAgent: emitting proposal — action: ${action}`);
        exports.riskEmitter.emit('proposal', {
            agentId: 'risk',
            action,
            reasoning: reason,
            confidence: analysis.confidence,
            timestamp: Date.now()
        });
        return decision;
    }
    /**
     * Batch analyze multiple positions
     */
    async batchAnalyze(positions) {
        logger_1.logger.info(`Batch analyzing ${positions.length} positions...`);
        const results = [];
        for (let i = 0; i < positions.length; i++) {
            try {
                const analysis = await this.analyzeRisk(positions[i]);
                results.push(analysis);
                logger_1.logger.debug(`Analyzed ${i + 1}/${positions.length}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to analyze position ${i + 1}:`, error);
                // Continue with other positions
                results.push({
                    riskLevel: "Medium",
                    riskFactors: ["analysis_failed"],
                    recommendedActions: ["manual_review"],
                    confidence: 0.0,
                    reasoning: "Analysis failed, requiring manual review"
                });
            }
        }
        logger_1.logger.info(`Batch analysis complete: ${results.length}/${positions.length} successful`);
        return results;
    }
}
exports.RiskAgent = RiskAgent;
//# sourceMappingURL=risk-agent.js.map