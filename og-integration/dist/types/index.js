"use strict";
/**
 * Shared type definitions for Sentinel 0G Integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationError = exports.DAError = exports.StorageError = exports.ComputeError = exports.SentinelError = void 0;
// ============================================================================
// Error Types
// ============================================================================
class SentinelError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "SentinelError";
    }
}
exports.SentinelError = SentinelError;
class ComputeError extends SentinelError {
    constructor(message, details) {
        super(message, "COMPUTE_ERROR", details);
        this.name = "ComputeError";
    }
}
exports.ComputeError = ComputeError;
class StorageError extends SentinelError {
    constructor(message, details) {
        super(message, "STORAGE_ERROR", details);
        this.name = "StorageError";
    }
}
exports.StorageError = StorageError;
class DAError extends SentinelError {
    constructor(message, details) {
        super(message, "DA_ERROR", details);
        this.name = "DAError";
    }
}
exports.DAError = DAError;
class VerificationError extends SentinelError {
    constructor(message, details) {
        super(message, "VERIFICATION_ERROR", details);
        this.name = "VerificationError";
    }
}
exports.VerificationError = VerificationError;
//# sourceMappingURL=index.js.map