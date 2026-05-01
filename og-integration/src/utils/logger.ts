/**
 * Simple logger utility for Sentinel 0G Integration
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = "Sentinel", level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.level = level;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.prefix}] [${level}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage("DEBUG", message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage("INFO", message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage("ERROR", message), ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Create default logger instance
export const logger = new Logger("Sentinel", LogLevel.INFO);
