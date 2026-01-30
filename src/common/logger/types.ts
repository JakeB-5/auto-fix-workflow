/**
 * @module common/logger/types
 * @description Logger interfaces and type definitions
 */

/**
 * Log levels supported by the logger
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric log level values (pino compatible)
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

/**
 * Context object for structured logging
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * A single log entry (used for testing/memory logger)
 */
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context: LogContext;
  readonly timestamp: Date;
}

/**
 * Logger interface - all logger implementations must conform to this
 */
export interface Logger {
  /**
   * Log a trace-level message
   */
  trace(msg: string, ctx?: LogContext): void;

  /**
   * Log a debug-level message
   */
  debug(msg: string, ctx?: LogContext): void;

  /**
   * Log an info-level message
   */
  info(msg: string, ctx?: LogContext): void;

  /**
   * Log a warning-level message
   */
  warn(msg: string, ctx?: LogContext): void;

  /**
   * Log an error-level message
   */
  error(msg: string, ctx?: LogContext): void;

  /**
   * Log a fatal-level message
   */
  fatal(msg: string, ctx?: LogContext): void;

  /**
   * Create a child logger with bound context
   */
  child(bindings: LogContext): Logger;

  /**
   * Flush any buffered logs
   */
  flush(): void;
}

/**
 * Options for creating a logger
 */
export interface LoggerOptions {
  /** Log level threshold */
  readonly level?: LogLevel;
  /** Name/context for this logger */
  readonly name?: string;
  /** Enable pretty printing (development mode) */
  readonly pretty?: boolean;
  /** Enable redaction of sensitive data */
  readonly redact?: boolean;
  /** Custom redaction paths */
  readonly redactPaths?: readonly string[];
  /** Output destination (defaults to stdout) */
  readonly destination?: NodeJS.WritableStream;
  /** Base context to include in all logs */
  readonly base?: LogContext;
}

/**
 * Configuration for masking sensitive data
 */
export interface MaskingConfig {
  /** Paths to redact (e.g., 'password', 'token', 'secret') */
  readonly paths: readonly string[];
  /** Replacement string for redacted values */
  readonly censor?: string;
  /** Whether to remove the key entirely instead of masking */
  readonly remove?: boolean;
}

/**
 * Serializer function type
 */
export type Serializer<T = unknown> = (value: T) => unknown;

/**
 * Map of serializers by property name
 */
export interface Serializers {
  readonly [key: string]: Serializer;
}
