/**
 * iNFT Metadata Management
 * Handles iNFT metadata storage, encryption, and evolution
 */
import { INFTMetadata, SwarmDecision } from "../types";
import { StorageClient } from "../services/storage";
export declare class INFTManager {
    private storageClient;
    private metadata;
    private encryptionKey;
    constructor(storageClient: StorageClient, encryptionKey?: string);
    /**
     * Initialize iNFT metadata
     */
    private initializeMetadata;
    /**
     * Generate strategy fingerprint
     */
    private generateStrategyFingerprint;
    /**
     * Get current metadata
     */
    getMetadata(): INFTMetadata;
    /**
     * Update metadata
     */
    updateMetadata(update: Partial<INFTMetadata>): void;
    /**
     * Encrypt metadata
     */
    private encryptMetadata;
    /**
     * Decrypt metadata
     */
    private decryptMetadata;
    /**
     * Simple encryption (XOR-based, for demo purposes)
     * In production, use AES-256-GCM
     */
    private simpleEncrypt;
    /**
     * Simple decryption (XOR-based, for demo purposes)
     * In production, use AES-256-GCM
     */
    private simpleDecrypt;
    /**
     * Save metadata to storage
     */
    saveMetadata(): Promise<void>;
    /**
     * Load metadata from storage
     */
    loadMetadata(rootHash: string): Promise<void>;
    /**
     * Evolve iNFT based on decision outcome
     */
    evolveINFT(decision: SwarmDecision, success: boolean): Promise<void>;
    /**
     * Get evolution statistics
     */
    getEvolutionStats(): {
        totalCycles: number;
        successRate: number;
        avgQuality: number;
        riskTolerance: string;
        strategyFingerprint: string;
    };
    /**
     * Reset iNFT to initial state
     */
    reset(): void;
    /**
     * Export metadata for backup
     */
    export(): string;
    /**
     * Import metadata from backup
     */
    import(jsonString: string): void;
}
//# sourceMappingURL=metadata.d.ts.map