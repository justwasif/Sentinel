/**
 * Risk Agent
 * Handles risk evaluation logic and prompt engineering
 */

import { Position, RiskAnalysis, Decision, ComputeRequest } from "../types";
import { ComputeClient } from "../services/compute";
import { logger } from "../utils/logger";

export class RiskAgent {
  private computeClient: ComputeClient;
  private agentId: string;

  constructor(computeClient: ComputeClient, agentId: string = "agent-1") {
    this.computeClient = computeClient;
    this.agentId = agentId;
  }

  /**
   * Analyze risk for a given position
   */
  async analyzeRisk(position: Position, context?: any[]): Promise<RiskAnalysis> {
    logger.info(`Analyzing risk for position: ${position.protocol}`);

    try {
      // Build prompt
      const prompt = this.buildRiskPrompt(position, context);

      // Execute inference
      const request: ComputeRequest = {
        prompt,
        model: "zai-org/GLM-5-FP8",
        temperature: 0.3,
        maxTokens: 2048,
        verifyTee: true
      };

      const response = await this.computeClient.verifiedEvaluate(request);

      // Parse response
      const analysis = this.parseRiskAnalysis(response.choices[0].message.content);

      logger.info(`Risk analysis complete: ${analysis.riskLevel} (${analysis.confidence})`);
      return analysis;

    } catch (error) {
      logger.error("Risk analysis failed:", error);
      throw error;
    }
  }

  /**
   * Build risk evaluation prompt
   */
  private buildRiskPrompt(position: Position, context?: any[]): string {
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
  private parseRiskAnalysis(content: string): RiskAnalysis {
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

    } catch (error) {
      logger.error("Failed to parse risk analysis:", error);
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
  makeDecision(analysis: RiskAnalysis): Decision {
    logger.info(`Making decision based on risk level: ${analysis.riskLevel}`);

    let action: Decision["action"];
    let reason: string;

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

    const decision: Decision = {
      action,
      reason,
      confidence: analysis.confidence
    };

    logger.info(`Decision: ${action} (${reason})`);
    return decision;
  }

  /**
   * Batch analyze multiple positions
   */
  async batchAnalyze(positions: Position[]): Promise<RiskAnalysis[]> {
    logger.info(`Batch analyzing ${positions.length} positions...`);

    const results: RiskAnalysis[] = [];

    for (let i = 0; i < positions.length; i++) {
      try {
        const analysis = await this.analyzeRisk(positions[i]);
        results.push(analysis);
        logger.debug(`Analyzed ${i + 1}/${positions.length}`);
      } catch (error) {
        logger.error(`Failed to analyze position ${i + 1}:`, error);
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

    logger.info(`Batch analysis complete: ${results.length}/${positions.length} successful`);
    return results;
  }
}
