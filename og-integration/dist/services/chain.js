"use strict";
/**
 * 0G Chain Contract Interface
 * Handles interaction with InferenceGuard contract for proof validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockChainClient = exports.ChainClient = void 0;
const ethers_1 = require("ethers");
const logger_1 = require("../utils/logger");
class ChainClient {
    constructor(config) {
        this.contractAddress = config.contractAddress;
        this.provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers_1.ethers.Wallet(config.privateKey, this.provider);
        this.contract = new ethers_1.ethers.Contract(config.contractAddress, [
            "function submitProof(bytes32 dataRoot, bytes32 proofHash, uint256 epoch, uint256 quorumId) external returns (bool)",
            "function verifyProof(bytes32 dataRoot, bytes32 proofHash, uint256 epoch, uint256 quorumId) external view returns (bool)",
            "function getProofStatus(bytes32 dataRoot) external view returns (bool verified, uint256 timestamp)",
            "function getLastVerifiedProof() external view returns (bytes32 dataRoot, bytes32 proofHash, uint256 epoch, uint256 quorumId, uint256 timestamp)"
        ], this.wallet);
    }
    /**
     * Submit proof to InferenceGuard contract
     */
    async submitProof(submission) {
        logger_1.logger.info(`Submitting proof to InferenceGuard: ${submission.dataRoot}`);
        try {
            const tx = await this.contract.submitProof(submission.dataRoot, submission.proofHash, submission.epoch, submission.quorumId);
            logger_1.logger.info(`Proof submission transaction: ${tx.hash}`);
            const receipt = await tx.wait();
            logger_1.logger.info(`Proof submitted successfully in block ${receipt.blockNumber}`);
            return tx.hash;
        }
        catch (error) {
            logger_1.logger.error("Failed to submit proof:", error);
            throw error;
        }
    }
    /**
     * Verify proof on-chain
     */
    async verifyProof(submission) {
        logger_1.logger.info(`Verifying proof on-chain: ${submission.dataRoot}`);
        try {
            const isValid = await this.contract.verifyProof(submission.dataRoot, submission.proofHash, submission.epoch, submission.quorumId);
            const verification = {
                isValid,
                epoch: submission.epoch,
                quorumId: submission.quorumId,
                timestamp: Date.now()
            };
            logger_1.logger.info(`Proof verification: ${isValid ? "valid" : "invalid"}`);
            return verification;
        }
        catch (error) {
            logger_1.logger.error("Failed to verify proof:", error);
            throw error;
        }
    }
    /**
     * Get proof status
     */
    async getProofStatus(dataRoot) {
        logger_1.logger.info(`Getting proof status: ${dataRoot}`);
        try {
            const status = await this.contract.getProofStatus(dataRoot);
            logger_1.logger.info(`Proof status: verified=${status.verified}, timestamp=${status.timestamp}`);
            return {
                verified: status.verified,
                timestamp: Number(status.timestamp)
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to get proof status:", error);
            throw error;
        }
    }
    /**
     * Get last verified proof
     */
    async getLastVerifiedProof() {
        logger_1.logger.info("Getting last verified proof...");
        try {
            const proof = await this.contract.getLastVerifiedProof();
            logger_1.logger.info(`Last verified proof: ${proof.dataRoot}`);
            return {
                dataRoot: proof.dataRoot,
                proofHash: proof.proofHash,
                epoch: Number(proof.epoch),
                quorumId: Number(proof.quorumId),
                timestamp: Number(proof.timestamp)
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to get last verified proof:", error);
            throw error;
        }
    }
    /**
     * Get contract balance
     */
    async getBalance() {
        try {
            const balance = await this.provider.getBalance(this.contractAddress);
            logger_1.logger.info(`Contract balance: ${ethers_1.ethers.formatEther(balance)} ETH`);
            return balance;
        }
        catch (error) {
            logger_1.logger.error("Failed to get contract balance:", error);
            throw error;
        }
    }
    /**
     * Get wallet balance
     */
    async getWalletBalance() {
        try {
            const balance = await this.provider.getBalance(this.wallet.address);
            logger_1.logger.info(`Wallet balance: ${ethers_1.ethers.formatEther(balance)} ETH`);
            return balance;
        }
        catch (error) {
            logger_1.logger.error("Failed to get wallet balance:", error);
            throw error;
        }
    }
    /**
     * Get current block number
     */
    async getBlockNumber() {
        try {
            const blockNumber = await this.provider.getBlockNumber();
            logger_1.logger.info(`Current block: ${blockNumber}`);
            return blockNumber;
        }
        catch (error) {
            logger_1.logger.error("Failed to get block number:", error);
            throw error;
        }
    }
    /**
     * Get gas price
     */
    async getGasPrice() {
        try {
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || BigInt(0);
            logger_1.logger.info(`Gas price: ${ethers_1.ethers.formatUnits(gasPrice, "gwei")} gwei`);
            return gasPrice;
        }
        catch (error) {
            logger_1.logger.error("Failed to get gas price:", error);
            throw error;
        }
    }
    /**
     * Estimate gas for proof submission
     */
    async estimateGas(submission) {
        try {
            const gasEstimate = await this.contract.submitProof.estimateGas(submission.dataRoot, submission.proofHash, submission.epoch, submission.quorumId);
            logger_1.logger.info(`Estimated gas: ${gasEstimate.toString()}`);
            return gasEstimate;
        }
        catch (error) {
            logger_1.logger.error("Failed to estimate gas:", error);
            throw error;
        }
    }
    /**
     * Get contract address
     */
    getContractAddress() {
        return this.contractAddress;
    }
    /**
     * Get wallet address
     */
    getWalletAddress() {
        return this.wallet.address;
    }
}
exports.ChainClient = ChainClient;
class MockChainClient {
    constructor() {
        this.proofs = new Map();
    }
    /**
     * Submit proof (mock)
     */
    async submitProof(submission) {
        logger_1.logger.info(`[MOCK] Submitting proof: ${submission.dataRoot}`);
        const verification = {
            isValid: true,
            epoch: submission.epoch,
            quorumId: submission.quorumId,
            timestamp: Date.now()
        };
        this.proofs.set(submission.dataRoot, verification);
        const txHash = `0xtx${Date.now()}`;
        logger_1.logger.info(`[MOCK] Proof submitted: ${txHash}`);
        return txHash;
    }
    /**
     * Verify proof (mock)
     */
    async verifyProof(submission) {
        logger_1.logger.info(`[MOCK] Verifying proof: ${submission.dataRoot}`);
        const verification = this.proofs.get(submission.dataRoot);
        if (verification) {
            return verification;
        }
        return {
            isValid: false,
            epoch: submission.epoch,
            quorumId: submission.quorumId,
            timestamp: Date.now()
        };
    }
    /**
     * Get proof status (mock)
     */
    async getProofStatus(dataRoot) {
        logger_1.logger.info(`[MOCK] Getting proof status: ${dataRoot}`);
        const verification = this.proofs.get(dataRoot);
        if (verification) {
            return {
                verified: verification.isValid,
                timestamp: verification.timestamp
            };
        }
        return {
            verified: false,
            timestamp: 0
        };
    }
    /**
     * Get last verified proof (mock)
     */
    async getLastVerifiedProof() {
        logger_1.logger.info("[MOCK] Getting last verified proof");
        const entries = Array.from(this.proofs.entries());
        if (entries.length === 0) {
            return {
                dataRoot: "0x0",
                proofHash: "0x0",
                epoch: 0,
                quorumId: 0,
                timestamp: 0
            };
        }
        const [dataRoot, verification] = entries[entries.length - 1];
        return {
            dataRoot,
            proofHash: "0xmock",
            epoch: verification.epoch,
            quorumId: verification.quorumId,
            timestamp: verification.timestamp
        };
    }
    /**
     * Get contract balance (mock)
     */
    async getBalance() {
        logger_1.logger.info("[MOCK] Getting contract balance");
        return BigInt(ethers_1.ethers.parseEther("1.0"));
    }
    /**
     * Get wallet balance (mock)
     */
    async getWalletBalance() {
        logger_1.logger.info("[MOCK] Getting wallet balance");
        return BigInt(ethers_1.ethers.parseEther("10.0"));
    }
    /**
     * Get current block number (mock)
     */
    async getBlockNumber() {
        logger_1.logger.info("[MOCK] Getting block number");
        return Math.floor(Date.now() / 12000); // ~12s per block
    }
    /**
     * Get gas price (mock)
     */
    async getGasPrice() {
        logger_1.logger.info("[MOCK] Getting gas price");
        return BigInt(ethers_1.ethers.parseUnits("20", "gwei"));
    }
    /**
     * Estimate gas (mock)
     */
    async estimateGas(submission) {
        logger_1.logger.info("[MOCK] Estimating gas");
        return BigInt(100000);
    }
    /**
     * Get contract address (mock)
     */
    getContractAddress() {
        return "0xmock-contract-address";
    }
    /**
     * Get wallet address (mock)
     */
    getWalletAddress() {
        return "0xmock-wallet-address";
    }
}
exports.MockChainClient = MockChainClient;
//# sourceMappingURL=chain.js.map