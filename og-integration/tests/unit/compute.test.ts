/**
 * Unit tests for ComputeClient
 */

import { ComputeClient } from "../../src/services/compute";
import { ComputeError } from "../../src/services/compute";

describe("ComputeClient", () => {
  let computeClient: ComputeClient;

  beforeEach(() => {
    computeClient = new ComputeClient("test-key", "https://test.rpc", true);
  });

  describe("verifiedEvaluate", () => {
    it("should return mock response when useMock is true", async () => {
      const request = {
        prompt: "Test prompt",
        verifyTee: true
      };

      const response = await computeClient.verifiedEvaluate(request);

      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.choices).toHaveLength(1);
      expect(response.x_0g_trace.tee_verified).toBe(true);
    });

    it("should parse JSON from prompt", async () => {
      const request = {
        prompt: JSON.stringify({
          protocol: "Aave",
          healthFactor: 1.8
        }),
        verifyTee: true
      };

      const response = await computeClient.verifiedEvaluate(request);

      expect(response).toBeDefined();
      expect(response.choices[0].message.content).toContain("riskLevel");
    });
  });

  describe("extractTEEVerification", () => {
    it("should extract TEE verification from response", () => {
      const mockResponse = {
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "test-model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: '{"riskLevel":"Medium"}'
            },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        },
        x_0g_trace: {
          request_id: "test-req",
          provider: "0xtest",
          billing: {
            input_cost: "100",
            output_cost: "200",
            total_cost: "300"
          },
          tee_verified: true
        },
        signature: "0xtestsig"
      };

      const verification = computeClient.extractTEEVerification(mockResponse);

      expect(verification.verified).toBe(true);
      expect(verification.provider).toBe("0xtest");
      expect(verification.signature).toBe("0xtestsig");
    });
  });

  describe("benchmark", () => {
    it("should run benchmark with specified count", async () => {
      const stats = await computeClient.benchmark(3);

      expect(stats).toBeDefined();
      expect(stats.p50).toBeDefined();
      expect(stats.p95).toBeDefined();
      expect(stats.p99).toBeDefined();
      expect(stats.avg).toBeDefined();
    });

    it("should throw error if all calls fail", async () => {
      const failingClient = new ComputeClient("test-key", "https://test.rpc", true);
      
      // Mock the verifiedEvaluate to always fail
      jest.spyOn(failingClient, "verifiedEvaluate").mockRejectedValue(
        new Error("Test error")
      );

      await expect(failingClient.benchmark(3)).rejects.toThrow(ComputeError);
    });
  });
});
