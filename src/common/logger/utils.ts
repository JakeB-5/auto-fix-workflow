/**
 * @module common/logger/utils
 * @description Logger utility functions
 */

import type { Logger, LogContext, LogLevel } from './types.js';
import { LOG_LEVELS } from './types.js';

/**
 * Safely stringify a value for logging
 */
export function safeStringify(value: unknown, maxLength = 1000): string {
  try {
    const str = JSON.stringify(value, (_, v) => {
      // Handle circular references
      if (typeof v === 'object' && v !== null) {
        const seen = new WeakSet();
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      // Handle BigInt
      if (typeof v === 'bigint') return v.toString();
      // Handle functions
      if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
      // Handle symbols
      if (typeof v === 'symbol') return v.toString();
      return v;
    });

    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '... [truncated]';
    }
    return str;
  } catch {
    return '[Unserializable]';
  }
}

/**
 * Create a context object from an error
 */
export function errorToContext(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(('code' in error) ? { code: error.code } : {}),
        ...(('cause' in error && error.cause) ? { cause: errorToContext(error.cause) } : {}),
      },
    };
  }

  if (typeof error === 'string') {
    return { error: { message: error } };
  }

  return { error: safeStringify(error) };
}

/**
 * Merge multiple context objects
 */
export function mergeContexts(...contexts: (LogContext | undefined)[]): LogContext {
  const result: LogContext = {};

  for (const ctx of contexts) {
    if (ctx) {
      Object.assign(result, ctx);
    }
  }

  return result;
}

/**
 * Create a timer for measuring operation duration
 */
export function createTimer(): { elapsed: () => number; elapsedMs: () => string } {
  const start = process.hrtime.bigint();

  return {
    elapsed(): number {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1_000_000; // Convert to milliseconds
    },
    elapsedMs(): string {
      return `${this.elapsed().toFixed(2)}ms`;
    },
  };
}

/**
 * Log the duration of an async operation
 */
export async function withTiming<T>(
  logger: Logger,
  message: string,
  fn: () => Promise<T>,
  ctx?: LogContext
): Promise<T> {
  const timer = createTimer();
  logger.debug(`${message} starting`, ctx);

  try {
    const result = await fn();
    logger.info(`${message} completed`, { ...ctx, duration: timer.elapsedMs() });
    return result;
  } catch (error) {
    logger.error(`${message} failed`, { ...ctx, duration: timer.elapsedMs(), ...errorToContext(error) });
    throw error;
  }
}

/**
 * Log the duration of a sync operation
 */
export function withTimingSync<T>(
  logger: Logger,
  message: string,
  fn: () => T,
  ctx?: LogContext
): T {
  const timer = createTimer();
  logger.debug(`${message} starting`, ctx);

  try {
    const result = fn();
    logger.info(`${message} completed`, { ...ctx, duration: timer.elapsedMs() });
    return result;
  } catch (error) {
    logger.error(`${message} failed`, { ...ctx, duration: timer.elapsedMs(), ...errorToContext(error) });
    throw error;
  }
}

/**
 * Create a logger that prefixes all messages
 */
export function createPrefixedLogger(logger: Logger, prefix: string): Logger {
  return {
    trace(msg: string, ctx?: LogContext): void {
      logger.trace(`${prefix} ${msg}`, ctx);
    },
    debug(msg: string, ctx?: LogContext): void {
      logger.debug(`${prefix} ${msg}`, ctx);
    },
    info(msg: string, ctx?: LogContext): void {
      logger.info(`${prefix} ${msg}`, ctx);
    },
    warn(msg: string, ctx?: LogContext): void {
      logger.warn(`${prefix} ${msg}`, ctx);
    },
    error(msg: string, ctx?: LogContext): void {
      logger.error(`${prefix} ${msg}`, ctx);
    },
    fatal(msg: string, ctx?: LogContext): void {
      logger.fatal(`${prefix} ${msg}`, ctx);
    },
    child(bindings: LogContext): Logger {
      return createPrefixedLogger(logger.child(bindings), prefix);
    },
    flush(): void {
      logger.flush();
    },
  };
}

/**
 * Create a rate-limited logger
 */
export function createRateLimitedLogger(
  logger: Logger,
  options: { windowMs?: number; maxLogs?: number } = {}
): Logger {
  const { windowMs = 1000, maxLogs = 10 } = options;
  const logTimes: number[] = [];

  function shouldLog(): boolean {
    const now = Date.now();
    // Remove old timestamps
    while (logTimes.length > 0 && logTimes[0]! < now - windowMs) {
      logTimes.shift();
    }
    if (logTimes.length >= maxLogs) {
      return false;
    }
    logTimes.push(now);
    return true;
  }

  return {
    trace(msg: string, ctx?: LogContext): void {
      if (shouldLog()) logger.trace(msg, ctx);
    },
    debug(msg: string, ctx?: LogContext): void {
      if (shouldLog()) logger.debug(msg, ctx);
    },
    info(msg: string, ctx?: LogContext): void {
      if (shouldLog()) logger.info(msg, ctx);
    },
    warn(msg: string, ctx?: LogContext): void {
      if (shouldLog()) logger.warn(msg, ctx);
    },
    error(msg: string, ctx?: LogContext): void {
      // Always log errors
      logger.error(msg, ctx);
    },
    fatal(msg: string, ctx?: LogContext): void {
      // Always log fatal
      logger.fatal(msg, ctx);
    },
    child(bindings: LogContext): Logger {
      return createRateLimitedLogger(logger.child(bindings), options);
    },
    flush(): void {
      logger.flush();
    },
  };
}

/**
 * Check if a level is enabled
 */
export function isLevelEnabled(currentLevel: LogLevel, checkLevel: LogLevel): boolean {
  return LOG_LEVELS[checkLevel] >= LOG_LEVELS[currentLevel];
}

/**
 * Parse a log level string safely
 */
export function parseLevel(level: string): LogLevel | undefined {
  const normalized = level.toLowerCase();
  if (normalized in LOG_LEVELS) {
    return normalized as LogLevel;
  }
  return undefined;
}

/**
 * Redact a URL, keeping the host but hiding auth and query params
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    if (parsed.search) parsed.search = '?[REDACTED]';
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Truncate a string for logging
 */
export function truncate(str: string, maxLength = 200): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Create a context object for HTTP request logging
 */
export function httpRequestContext(
  method: string,
  url: string,
  options?: { statusCode?: number; duration?: number; error?: unknown }
): LogContext {
  const ctx: LogContext = {
    http: {
      method,
      url: redactUrl(url),
    },
  };

  if (options?.statusCode !== undefined) {
    (ctx['http'] as Record<string, unknown>)['statusCode'] = options.statusCode;
  }
  if (options?.duration !== undefined) {
    (ctx['http'] as Record<string, unknown>)['duration'] = options.duration;
  }
  if (options?.error !== undefined) {
    Object.assign(ctx, errorToContext(options.error));
  }

  return ctx;
}
