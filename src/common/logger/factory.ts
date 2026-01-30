/**
 * @module common/logger/factory
 * @description Logger factory for creating logger instances
 */

import type { Logger, LoggerOptions } from './types.js';
import { createPinoLogger } from './pino-logger.js';
import { createMemoryLogger, MemoryLogger } from './memory-logger.js';

/**
 * Logger type selection
 */
export type LoggerType = 'pino' | 'memory' | 'noop';

/**
 * Extended options for factory
 */
export interface FactoryOptions extends LoggerOptions {
  /** Logger implementation type */
  readonly type?: LoggerType;
}

/**
 * No-op logger that discards all logs
 */
class NoopLogger implements Logger {
  trace(): void { /* noop */ }
  debug(): void { /* noop */ }
  info(): void { /* noop */ }
  warn(): void { /* noop */ }
  error(): void { /* noop */ }
  fatal(): void { /* noop */ }
  child(): Logger { return this; }
  flush(): void { /* noop */ }
}

const noopLogger = new NoopLogger();

/**
 * Create a logger instance
 *
 * @param options - Logger configuration options
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * // Default pino logger
 * const logger = createLogger();
 *
 * // Memory logger for testing
 * const testLogger = createLogger({ type: 'memory' });
 *
 * // Custom configuration
 * const customLogger = createLogger({
 *   level: 'debug',
 *   name: 'my-service',
 *   pretty: true,
 * });
 * ```
 */
export function createLogger(options?: FactoryOptions): Logger {
  const type = options?.type ?? getDefaultLoggerType();

  switch (type) {
    case 'memory':
      return createMemoryLogger(options);
    case 'noop':
      return noopLogger;
    case 'pino':
    default:
      return createPinoLogger(options);
  }
}

/**
 * Create a logger specifically for testing
 */
export function createTestLogger(options?: LoggerOptions): MemoryLogger {
  return createMemoryLogger({
    level: 'trace', // Capture all logs in tests
    ...options,
  });
}

/**
 * Get the no-op logger (singleton)
 */
export function getNoopLogger(): Logger {
  return noopLogger;
}

/**
 * Determine the default logger type based on environment
 */
function getDefaultLoggerType(): LoggerType {
  // Use memory logger in test environment if explicitly requested
  if (process.env['LOG_TYPE'] === 'memory') return 'memory';
  if (process.env['LOG_TYPE'] === 'noop') return 'noop';

  // Default to pino
  return 'pino';
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(parent: Logger, bindings: Record<string, unknown>): Logger {
  return parent.child(bindings);
}

/**
 * Create a scoped logger for a specific module/component
 */
export function createScopedLogger(scope: string, options?: FactoryOptions): Logger {
  const logger = createLogger(options);
  return logger.child({ scope });
}
