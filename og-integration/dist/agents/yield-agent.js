"use strict";
/**
 * Yield Agent (Agent 2)
 * Handles LP position optimization and rebalancing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YieldAgent = void 0;
const logger_1 = require("../utils/logger");
class YieldAgent {
    constructor(computeClient, agentId = "yield-agent") {
        this.computeClient = computeClient;
        this.agentId = agentId;
        this.lastRebalanceTime = 0;
        this.rebalanceCount = 0;
    }
    /**
     * Analyze LP position for optimization opportunities
     */
    async analyzePosition(position, context) {
        logger_1.logger.info(`Analyzing LP position: ${position.pool}`);
        try {
            const prompt = this.buildYieldPrompt(position, context);
            const request = {
                prompt,
                model: "zai-org/GLM-5-FP8",
                temperature: 0.3,
                maxTokens: 2048,
                verifyTee: true
            };
            const response = await this.computeClient.verifiedEvaluate(request);
            const analysis = this.parseYieldAnalysis(response.choices[0].message.content);
            logger_1.logger.info(`Yield analysis complete: ${analysis.action} (${analysis.confidence})`);
            return analysis;
        }
        catch (error) {
            logger_1.logger.error("Yield analysis failed:", error);
            throw error;
        }
    }
    /**
     * Build yield optimization prompt
     */
    buildYieldPrompt(position, context) {
        let prompt = "You are the Yield Agent in a 3-agent DeFi protection swarm.\n\n";
        prompt += "CURRENT LP POSITION:\n";
        prompt += `- Pool: ${position.pool}\n`;
        prompt += `- Range: [${position.tickLower}, ${position.tickUpper}]\n`;
        prompt += `- Current Tick: ${position.currentTick}\n`;
        prompt += `- Out of Range: ${position.outOfRange}%\n`;
        prompt += `- Uncollected Fees: $${position.fees}\n`;
        prompt += `- Liquidity: ${position.liquidity}\n`;
        prompt += "\n";
        if (context && context.length > 0) {
            prompt += "HISTORICAL CONTEXT (last 5 cycles):\n";
            for (const ctx of context.slice(0, 5)) {
                prompt += `- Cycle ${ctx.cycleId}: Action=${ctx.action}, Gas Cost=$${ctx.gasCost}, Fees Earned=$${ctx.fees}\n`;
            }
            prompt += "\n";
        }
        prompt += "REBALANCE HISTORY:\n";
        prompt += `- Last rebalance: ${this.lastRebalanceTime > 0 ? new Date(this.lastRebalanceTime).toISOString() : 'Never'}\n`;
        prompt += `- Frequency: ${this.rebalanceCount} times total\n`;
        prompt += "\n";
        prompt += "TASK:\n";
        prompt += "Determine if rebalancing would improve fee capture.\n";
        prompt += "Consider: gas cost, volatility, recent rebalance frequency.\n";
        prompt += "\n";
        prompt += "ANTI-THRASHING RULES:\n";
        prompt += "- No rebalance if last one < 24h ago\n";
        prompt += "- Net benefit must exceed 2x gas cost\n";
        prompt += "- Skip if 24h volatility > 10%\n";
        prompt += "\n";
        prompt += "OUTPUT (JSON only):\n";
        prompt += `{\n`;
        prompt += `  "action": "rebalance_lp|none",\n`;
        prompt += `  "urgency": "high|medium|low",\n`;
        prompt += `  "newRange": [<tickLower>, <tickUpper>],\n`;
        prompt += `  "expectedGain": <USD>,\n`;
        prompt += `  "gasCost": <USD>,\n`;
        prompt += `  "netBenefit": <USD>,\n`;
        prompt += `  "reasoning": "<explanation>",\n`;
        prompt += `  "confidence": <0-1>\n`;
        prompt += `}\n`;
        return prompt;
    }
    /**
     * Parse yield analysis from response
     */
    parseYieldAnalysis(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (!parsed.action || !["rebalance_lp", "none"].includes(parsed.action)) {
                    throw new Error("Invalid or missing action");
                }
                if (!Array.isArray(parsed.newRange) || parsed.newRange.length !== 2) {
                    throw new Error("Invalid or missing newRange");
                }
                if (typeof parsed.expectedGain !== "number") {
                    throw new Error("Invalid or missing expectedGain");
                }
                if (typeof parsed.gasCost !== "number") {
                    throw new Error("Invalid or missing gasCost");
                }
                if (typeof parsed.netBenefit !== "number") {
                    throw new Error("Invalid or missing netBenefit");
                }
                if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
                    throw new Error("Invalid or missing confidence");
                }
                return {
                    action: parsed.action,
                    urgency: parsed.urgency || "medium",
                    newRange: parsed.newRange,
                    expectedGain: parsed.expectedGain,
                    gasCost: parsed.gasCost,
                    netBenefit: parsed.netBenefit,
                    reasoning: parsed.reasoning,
                    confidence: parsed.confidence
                };
            }
            throw new Error("No JSON found in response");
        }
        catch (error) {
            logger_1.logger.error("Failed to parse yield analysis:", error);
            return {
                action: "none",
                urgency: "low",
                newRange: [0, 0],
                expectedGain: 0,
                gasCost: 0,
                netBenefit: 0,
                reasoning: "Failed to parse AI response",
                confidence: 0.0
            };
        }
    }
    /**
     * Check anti-thrashing rules
     */
    checkAntiThrashingRules(analysis) {
        logger_1.logger.info("Checking anti-thrashing rules...");
        const now = Date.now();
        const hoursSinceLastRebalance = (now - this.lastRebalanceTime) / (1000 * 60 * 60);
        if (hoursSinceLastRebalance < 24) {
            logger_1.logger.warn(`Rebalance blocked: only ${hoursSinceLastRebalance.toFixed(2)}h since last rebalance`);
            return false;
        }
        if (analysis.netBenefit < 2 * analysis.gasCost) {
            logger_1.logger.warn(`Rebalance blocked: net benefit ($${analysis.netBenefit}) < 2x gas cost ($${2 * analysis.gasCost})`);
            return false;
        }
        logger_1.logger.info("Anti-thrashing rules passed");
        return true;
    }
    /**
     * Create execution proposal
     */
    createProposal(analysis, position) {
        logger_1.logger.info("Creating yield proposal...");
        return {
            agentId: 'yield',
            action: analysis.action,
            urgency: analysis.urgency,
            reasoning: analysis.reasoning,
            data: {
                pool: position.pool,
                tokenId: position.tokenId,
                newRange: analysis.newRange,
                expectedGain: analysis.expectedGain,
                gasCost: analysis.gasCost,
                netBenefit: analysis.netBenefit
            },
            confidence: analysis.confidence,
            timestamp: Date.now()
        };
    }
    /**
     * Record rebalance
     */
    recordRebalance() {
        this.lastRebalanceTime = Date.now();
        this.rebalanceCount++;
        logger_1.logger.info(`Rebalance recorded: ${this.rebalanceCount} total`);
    }
    /**
     * Get rebalance statistics
     */
    getRebalanceStats() {
        const now = Date.now();
        const hoursSinceLastRebalance = this.lastRebalanceTime > 0
            ? (now - this.lastRebalanceTime) / (1000 * 60 * 60)
            : 0;
        return {
            lastRebalanceTime: this.lastRebalanceTime,
            rebalanceCount: this.rebalanceCount,
            hoursSinceLastRebalance
        };
    }
    /**
     * Batch analyze multiple positions
     */
    async batchAnalyze(positions) {
        logger_1.logger.info(`Batch analyzing ${positions.length} positions...`);
        const results = [];
        for (let i = 0; i < positions.length; i++) {
            try {
                const analysis = await this.analyzePosition(positions[i]);
                results.push(analysis);
                logger_1.logger.debug(`Analyzed ${i + 1}/${positions.length}`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to analyze position ${i + 1}:`, error);
                results.push({
                    action: "none",
                    urgency: "low",
                    newRange: [0, 0],
                    expectedGain: 0,
                    gasCost: 0,
                    netBenefit: 0,
                    reasoning: "Analysis failed",
                    confidence: 0.0
                });
            }
        }
        logger_1.logger.info(`Batch analysis complete: ${results.length}/${positions.length} successful`);
        return results;
    }
}
exports.YieldAgent = YieldAgent;
//# sourceMappingURL=yield-agent.js.map