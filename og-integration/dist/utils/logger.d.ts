/**
 * Simple logger utility for Sentinel 0G Integration
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare class Logger {
    private level;
    private prefix;
    constructor(prefix?: string, level?: LogLevel);
    private formatMessage;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    setLevel(level: LogLevel): void;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map