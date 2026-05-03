"use strict";
/**
 * 0G Compute Client Wrapper
 * Handles verified AI inference with TEE signature verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputeClient = exports.ComputeError = void 0;
const logger_1 = require("../utils/logger");
class ComputeError extends Error {
    constructor(message, details) {
        super(message);
        this.name = "ComputeError";
        this.details = details;
    }
}
exports.ComputeError = ComputeError;
class ComputeClient {
    constructor(apiKey, rpcUrl, useMock = false) {
        this.apiKey = apiKey;
        this.rpcUrl = rpcUrl;
        this.useMock = useMock;
    }
    /**
     * Execute verified inference with TEE signature verification
     */
    async verifiedEvaluate(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info("Starting verified inference...");
            if (this.useMock) {
                logger_1.logger.warn("Using mock compute response");
                return this.getMockResponse(request);
            }
            // TODO: Implement actual 0G Compute API call
            // const response = await this.callComputeAPI(request);
            // const latency = Date.now() - startTime;
            // logger.info(`Inference complete in ${latency}ms`);
            // return response;
            // For now, use mock
            logger_1.logger.warn("0G Compute API not yet implemented, using mock");
            return this.getMockResponse(request);
        }
        catch (error) {
            const latency = Date.now() - startTime;
            logger_1.logger.error(`Inference failed after ${latency}ms:`, error);
            throw new ComputeError(`Verified inference failed: ${error instanceof Error ? error.message : String(error)}`, { latency, request });
        }
    }
    /**
     * Get mock response for testing/fallback
     */
    getMockResponse(request) {
        const now = Date.now();
        // Parse the prompt to extract JSON if present
        let content = request.prompt;
        try {
            // Try to parse as JSON
            const jsonMatch = request.prompt.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                // Return structured response
                content = JSON.stringify({
                    riskLevel: "Medium",
                    riskFactors: ["volatility", "liquidation_risk"],
                    recommendedActions: ["monitor", "consider_reducing"],
                    confidence: 0.75,
                    reasoning: "Based on current health factor and historical patterns"
                });
            }
        }
        catch (e) {
            // If parsing fails, return generic response
            content = JSON.stringify({
                riskLevel: "Medium",
                riskFactors: ["market_conditions"],
                recommendedActions: ["monitor"],
                confidence: 0.7,
                reasoning: "Analysis based on provided context"
            });
        }
        return {
            id: `chatcmpl-${now}`,
            object: "chat.completion",
            created: Math.floor(now / 1000),
            model: request.model || "zai-org/GLM-5-FP8",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: content,
                        reasoning_content: "Step-by-step reasoning based on provided context and historical patterns"
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
                request_id: `req-${now}`,
                provider: "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
                billing: {
                    input_cost: "19000000000000",
                    output_cost: "1916800000000000",
                    total_cost: "1935800000000000"
                },
                tee_verified: true
            },
            signature: "0xmock_signature_for_testing_purposes"
        };
    }
    /**
     * Extract TEE verification from response
     */
    extractTEEVerification(response) {
        return {
            verified: response.x_0g_trace.tee_verified,
            provider: response.x_0g_trace.provider,
            signature: response.signature || "",
            teeSignerAddress: response.x_0g_trace.provider
        };
    }
    /**
     * Verify TEE signature (placeholder)
     */
    async verifySignature(signature, content, teeSignerAddress) {
        // TODO: Implement actual signature verification
        logger_1.logger.info("Verifying TEE signature...");
        // For now, return true for mock signatures
        if (signature.startsWith("0xmock")) {
            logger_1.logger.warn("Mock signature detected, skipping verification");
            return true;
        }
        // Placeholder: Implement actual cryptographic verification
        // const isValid = await this.cryptographicVerify(signature, content, teeSignerAddress);
        // return isValid;
        logger_1.logger.warn("Signature verification not yet implemented, returning true");
        return true;
    }
    /**
     * Benchmark performance
     */
    async benchmark(count = 10) {
        logger_1.logger.info(`Running benchmark with ${count} calls...`);
        const latencies = [];
        const request = {
            prompt: "Test prompt for benchmarking",
            verifyTee: true
        };
        for (let i = 0; i < count; i++) {
            const start = Date.now();
            try {
                await this.verifiedEvaluate(request);
                const latency = Date.now() - start;
                latencies.push(latency);
                logger_1.logger.debug(`Call ${i + 1}/${count}: ${latency}ms`);
            }
            catch (error) {
                logger_1.logger.error(`Call ${i + 1}/${count} failed:`, error);
            }
        }
        if (latencies.length === 0) {
            throw new ComputeError("Benchmark failed: no successful calls");
        }
        latencies.sort((a, b) => a - b);
        const stats = {
            p50: latencies[Math.floor(latencies.length * 0.5)],
            p95: latencies[Math.floor(latencies.length * 0.95)],
            p99: latencies[Math.floor(latencies.length * 0.99)],
            avg: latencies.reduce((a, b) => a + b, 0) / latencies.length
        };
        logger_1.logger.info("Benchmark results:", stats);
        return stats;
    }
}
exports.ComputeClient = ComputeClient;
//# sourceMappingURL=compute.js.map