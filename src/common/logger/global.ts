/**
 * @module common/logger/global
 * @description Global logger instance management
 */

import type { Logger, LoggerOptions } from './types.js';
import { createLogger } from './factory.js';

/**
 * Global logger instance (lazy initialized)
 */
let globalLogger: Logger | null = null;

/**
 * Configuration used for global logger
 */
let globalConfig: LoggerOptions | undefined;

/**
 * Get the global logger instance
 *
 * Creates a new logger with default settings if not already initialized.
 *
 * @returns The global logger instance
 *
 * @example
 * ```typescript
 * import { getLogger } from './logger';
 *
 * const logger = getLogger();
 * logger.info('Application started');
 * ```
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger(globalConfig);
  }
  return globalLogger;
}

/**
 * Initialize the global logger with custom options
 *
 * Should be called once at application startup. If called multiple times,
 * only the first call takes effect (unless reset is called).
 *
 * @param options - Logger configuration options
 * @returns The initialized logger instance
 *
 * @example
 * ```typescript
 * // In main.ts
 * initLogger({
 *   level: 'debug',
 *   name: 'my-app',
 *   pretty: process.env.NODE_ENV !== 'production',
 * });
 * ```
 */
export function initLogger(options?: LoggerOptions): Logger {
  if (!globalLogger) {
    globalConfig = options;
    globalLogger = createLogger(options);
  }
  return globalLogger;
}

/**
 * Reset the global logger
 *
 * Useful for testing or reconfiguring the logger at runtime.
 * After calling this, the next call to getLogger() will create a new instance.
 *
 * @example
 * ```typescript
 * // In test setup
 * resetLogger();
 * initLogger({ type: 'memory' });
 * ```
 */
export function resetLogger(): void {
  if (globalLogger) {
    globalLogger.flush();
  }
  globalLogger = null;
  globalConfig = undefined;
}

/**
 * Set the global logger instance directly
 *
 * Useful for testing with mock loggers or special configurations.
 *
 * @param logger - The logger instance to use globally
 *
 * @example
 * ```typescript
 * // In test
 * const mockLogger = createMemoryLogger();
 * setLogger(mockLogger);
 * ```
 */
export function setLogger(logger: Logger): void {
  if (globalLogger) {
    globalLogger.flush();
  }
  globalLogger = logger;
}

/**
 * Create a child logger from the global logger
 *
 * @param bindings - Context to bind to the child logger
 * @returns A child logger with the given bindings
 *
 * @example
 * ```typescript
 * const requestLogger = getChildLogger({ requestId: '123' });
 * requestLogger.info('Processing request');
 * ```
 */
export function getChildLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

/**
 * Log convenience functions using the global logger
 */
export const log = {
  trace(msg: string, ctx?: Record<string, unknown>): void {
    getLogger().trace(msg, ctx);
  },
  debug(msg: string, ctx?: Record<string, unknown>): void {
    getLogger().debug(msg, ctx);
  },
  info(msg: string, ctx?: Record<string, unknown>): void {
    getLogger().info(msg, ctx);
  },
  warn(msg: string, ctx?: Record<string, unknown>): void {
    getLogger().warn(msg, ctx);
  },
  error(msg: string, ctx?: Record<string, unknown>): void {
    getLogger().error(msg, ctx);
  },
  fatal(msg: string, ctx?: Record<string, unknown>): void {
    getLogger().fatal(msg, ctx);
  },
} as const;
