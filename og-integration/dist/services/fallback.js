"use strict";
/**
 * Fallback Service
 * Provides backup systems when 0G services are unavailable
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackService = void 0;
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
class FallbackService {
    constructor(enabled = true) {
        this.enabled = enabled;
    }
    /**
     * Fallback compute using OpenAI or similar
     */
    async fallbackCompute(request) {
        if (!this.enabled) {
            throw new types_1.ComputeError("Fallback service is disabled");
        }
        logger_1.logger.warn("Using fallback compute service");
        // TODO: Implement actual fallback (e.g., OpenAI API)
        // For now, return a mock response
        return this.getFallbackResponse(request);
    }
    /**
     * Get fallback response
     */
    getFallbackResponse(request) {
        const now = Date.now();
        // Try to parse JSON from prompt
        let content = request.prompt;
        try {
            const jsonMatch = request.prompt.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                content = JSON.stringify({
                    riskLevel: "Medium",
                    riskFactors: ["fallback_mode", "limited_analysis"],
                    recommendedActions: ["manual_review"],
                    confidence: 0.5,
                    reasoning: "Analysis performed in fallback mode with limited capabilities"
                });
            }
        }
        catch (e) {
            content = JSON.stringify({
                riskLevel: "Medium",
                riskFactors: ["fallback_mode"],
                recommendedActions: ["manual_review"],
                confidence: 0.5,
                reasoning: "Fallback mode - limited analysis"
            });
        }
        return {
            id: `fallback-${now}`,
            object: "chat.completion",
            created: Math.floor(now / 1000),
            model: "fallback-model",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: content,
                        reasoning_content: "Fallback analysis - primary service unavailable"
                    },
                    finish_reason: "stop"
                }
            ],
            usage: {
                prompt_tokens: 256,
                completion_tokens: 512,
                total_tokens: 768
            },
            x_0g_trace: {
                request_id: `fallback-${now}`,
                provider: "fallback-service",
                billing: {
                    input_cost: "0",
                    output_cost: "0",
                    total_cost: "0"
                },
                tee_verified: false // Fallback doesn't provide TEE verification
            },
            signature: "0xfallback_signature"
        };
    }
    /**
     * Check if fallback should be used
     */
    shouldUseFallback(error) {
        // Use fallback for network errors, timeouts, or service unavailability
        if (error instanceof types_1.ComputeError) {
            return true;
        }
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (message.includes("timeout") ||
                message.includes("network") ||
                message.includes("unavailable") ||
                message.includes("connection"));
        }
        return false;
    }
    /**
     * Enable or disable fallback
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        logger_1.logger.info(`Fallback service ${enabled ? "enabled" : "disabled"}`);
    }
}
exports.FallbackService = FallbackService;
//# sourceMappingURL=fallback.js.map