"use strict";
/**
 * iNFT Metadata Management
 * Handles iNFT metadata storage, encryption, and evolution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.INFTManager = void 0;
const logger_1 = require("../utils/logger");
class INFTManager {
    constructor(storageClient, encryptionKey = "default-encryption-key") {
        this.storageClient = storageClient;
        this.encryptionKey = encryptionKey;
        this.metadata = this.initializeMetadata();
    }
    /**
     * Initialize iNFT metadata
     */
    initializeMetadata() {
        const metadata = {
            id: `inft-${Date.now()}`,
            riskTolerance: 'moderate',
            maxActionsPerCycle: 2,
            availableCapital: 100000,
            totalCycles: 0,
            successCount: 0,
            failureCount: 0,
            avgQuality: 0.5,
            strategyFingerprint: '',
            lastUpdated: Date.now(),
            encrypted: false
        };
        metadata.strategyFingerprint = this.generateStrategyFingerprint(metadata);
        return metadata;
    }
    /**
     * Generate strategy fingerprint
     */
    generateStrategyFingerprint(metadata) {
        const data = {
            riskTolerance: metadata.riskTolerance,
            maxActions: metadata.maxActionsPerCycle,
            timestamp: Date.now()
        };
        return `0x${Buffer.from(JSON.stringify(data)).toString('hex').substring(0, 64)}`;
    }
    /**
     * Get current metadata
     */
    getMetadata() {
        return { ...this.metadata };
    }
    /**
     * Update metadata
     */
    updateMetadata(update) {
        this.metadata = {
            ...this.metadata,
            ...update,
            lastUpdated: Date.now(),
            strategyFingerprint: this.generateStrategyFingerprint(this.metadata)
        };
        logger_1.logger.info("iNFT metadata updated");
    }
    /**
     * Encrypt metadata
     */
    encryptMetadata(data) {
        logger_1.logger.info("Encrypting iNFT metadata...");
        try {
            const jsonString = JSON.stringify(data);
            const encrypted = this.simpleEncrypt(jsonString, this.encryptionKey);
            return encrypted;
        }
        catch (error) {
            logger_1.logger.error("Failed to encrypt metadata:", error);
            throw error;
        }
    }
    /**
     * Decrypt metadata
     */
    decryptMetadata(encrypted) {
        logger_1.logger.info("Decrypting iNFT metadata...");
        try {
            const decrypted = this.simpleDecrypt(encrypted, this.encryptionKey);
            return JSON.parse(decrypted);
        }
        catch (error) {
            logger_1.logger.error("Failed to decrypt metadata:", error);
            throw error;
        }
    }
    /**
     * Simple encryption (XOR-based, for demo purposes)
     * In production, use AES-256-GCM
     */
    simpleEncrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return Buffer.from(result).toString('base64');
    }
    /**
     * Simple decryption (XOR-based, for demo purposes)
     * In production, use AES-256-GCM
     */
    simpleDecrypt(encrypted, key) {
        const text = Buffer.from(encrypted, 'base64').toString('utf-8');
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }
    /**
     * Save metadata to storage
     */
    async saveMetadata() {
        logger_1.logger.info("Saving iNFT metadata to storage...");
        try {
            const encrypted = this.encryptMetadata(this.metadata);
            const node = {
                id: "",
                type: "inft_metadata",
                timestamp: Date.now(),
                data: {
                    encrypted,
                    metadataId: this.metadata.id,
                    strategyFingerprint: this.metadata.strategyFingerprint
                },
                parents: [],
                metadata: {
                    cycle: this.metadata.totalCycles,
                    agentId: "inft",
                    size: encrypted.length
                }
            };
            const result = await this.storageClient.uploadNode(node);
            logger_1.logger.info(`iNFT metadata saved: ${result.rootHash}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to save metadata:", error);
            throw error;
        }
    }
    /**
     * Load metadata from storage
     */
    async loadMetadata(rootHash) {
        logger_1.logger.info("Loading iNFT metadata from storage...");
        try {
            const result = await this.storageClient.downloadNode(rootHash);
            const encrypted = result.data.encrypted;
            const decrypted = this.decryptMetadata(encrypted);
            this.metadata = decrypted;
            logger_1.logger.info(`iNFT metadata loaded: ${this.metadata.id}`);
        }
        catch (error) {
            logger_1.logger.error("Failed to load metadata:", error);
            throw error;
        }
    }
    /**
     * Evolve iNFT based on decision outcome
     */
    async evolveINFT(decision, success) {
        logger_1.logger.info(`Evolving iNFT (success: ${success})...`);
        this.metadata.totalCycles++;
        if (success) {
            this.metadata.successCount++;
            if (this.metadata.successCount % 5 === 0) {
                logger_1.logger.info("5 consecutive successes - becoming more aggressive");
                if (this.metadata.riskTolerance === 'conservative') {
                    this.metadata.riskTolerance = 'moderate';
                }
                else if (this.metadata.riskTolerance === 'moderate') {
                    this.metadata.riskTolerance = 'aggressive';
                }
            }
        }
        else {
            this.metadata.failureCount++;
            if (this.metadata.failureCount % 3 === 0) {
                logger_1.logger.info("3 consecutive failures - becoming more conservative");
                if (this.metadata.riskTolerance === 'aggressive') {
                    this.metadata.riskTolerance = 'moderate';
                }
                else if (this.metadata.riskTolerance === 'moderate') {
                    this.metadata.riskTolerance = 'conservative';
                }
            }
        }
        this.metadata.avgQuality =
            (this.metadata.successCount / this.metadata.totalCycles);
        this.metadata.strategyFingerprint = this.generateStrategyFingerprint(this.metadata);
        this.metadata.lastUpdated = Date.now();
        logger_1.logger.info(`iNFT evolved: ${this.metadata.totalCycles} cycles, ${this.metadata.avgQuality.toFixed(2)} quality`);
        await this.saveMetadata();
    }
    /**
     * Get evolution statistics
     */
    getEvolutionStats() {
        return {
            totalCycles: this.metadata.totalCycles,
            successRate: this.metadata.totalCycles > 0
                ? this.metadata.successCount / this.metadata.totalCycles
                : 0,
            avgQuality: this.metadata.avgQuality,
            riskTolerance: this.metadata.riskTolerance,
            strategyFingerprint: this.metadata.strategyFingerprint
        };
    }
    /**
     * Reset iNFT to initial state
     */
    reset() {
        logger_1.logger.info("Resetting iNFT to initial state...");
        this.metadata = this.initializeMetadata();
    }
    /**
     * Export metadata for backup
     */
    export() {
        return JSON.stringify(this.metadata, null, 2);
    }
    /**
     * Import metadata from backup
     */
    import(jsonString) {
        logger_1.logger.info("Importing iNFT metadata from backup...");
        const imported = JSON.parse(jsonString);
        this.metadata = imported;
        logger_1.logger.info("iNFT metadata imported successfully");
    }
}
exports.INFTManager = INFTManager;
//# sourceMappingURL=metadata.js.map