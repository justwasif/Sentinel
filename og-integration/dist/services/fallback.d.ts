/**
 * Fallback Service
 * Provides backup systems when 0G services are unavailable
 */
import { ComputeRequest, ComputeResponse } from "../types";
export declare class FallbackService {
    private enabled;
    constructor(enabled?: boolean);
    /**
     * Fallback compute using OpenAI or similar
     */
    fallbackCompute(request: ComputeRequest): Promise<ComputeResponse>;
    /**
     * Get fallback response
     */
    private getFallbackResponse;
    /**
     * Check if fallback should be used
     */
    shouldUseFallback(error: any): boolean;
    /**
     * Enable or disable fallback
     */
    setEnabled(enabled: boolean): void;
}
//# sourceMappingURL=fallback.d.ts.map