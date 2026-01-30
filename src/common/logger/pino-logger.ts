/**
 * @module common/logger/pino-logger
 * @description Pino-based Logger implementation
 */

import { pino } from 'pino';
import type { Logger as PinoLogger, LoggerOptions as PinoLoggerOptions } from 'pino';
import type { Logger, LogContext, LoggerOptions } from './types.js';
import { resolveLoggerOptions } from './config.js';
import { defaultSerializers } from './serializers.js';
import { getPinoRedactConfig } from './masking.js';
import { DEFAULT_MASKING_CONFIG } from './config.js';
import { getPrettyTransport, getPinoFormatters, shouldUsePretty } from './formatters.js';

/**
 * Pino-based logger implementation
 */
export class PinoLoggerImpl implements Logger {
  private readonly pino: PinoLogger;

  constructor(options?: LoggerOptions) {
    const resolved = resolveLoggerOptions(options);
    const usePretty = resolved.pretty && shouldUsePretty();

    const pinoOptions: PinoLoggerOptions = {
      name: resolved.name,
      level: resolved.level,
      serializers: defaultSerializers,
      formatters: getPinoFormatters(),
      timestamp: pino.stdTimeFunctions.isoTime,
      base: resolved.base ?? {},
    };

    // Add redaction if enabled
    if (resolved.redact) {
      const redactConfig = getPinoRedactConfig({
        ...DEFAULT_MASKING_CONFIG,
        paths: resolved.redactPaths,
      });
      pinoOptions.redact = redactConfig;
    }

    // Configure transport for pretty printing
    if (usePretty) {
      pinoOptions.transport = getPrettyTransport();
    }

    // Create pino instance
    if (resolved.destination && !usePretty) {
      this.pino = pino(pinoOptions, resolved.destination);
    } else {
      this.pino = pino(pinoOptions);
    }
  }

  /**
   * Create from an existing pino instance (for child loggers)
   */
  private static fromPino(pinoInstance: PinoLogger): PinoLoggerImpl {
    const logger = Object.create(PinoLoggerImpl.prototype) as PinoLoggerImpl;
    (logger as unknown as { pino: PinoLogger }).pino = pinoInstance;
    return logger;
  }

  trace(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.pino.trace(ctx, msg);
    } else {
      this.pino.trace(msg);
    }
  }

  debug(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.pino.debug(ctx, msg);
    } else {
      this.pino.debug(msg);
    }
  }

  info(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.pino.info(ctx, msg);
    } else {
      this.pino.info(msg);
    }
  }

  warn(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.pino.warn(ctx, msg);
    } else {
      this.pino.warn(msg);
    }
  }

  error(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.pino.error(ctx, msg);
    } else {
      this.pino.error(msg);
    }
  }

  fatal(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.pino.fatal(ctx, msg);
    } else {
      this.pino.fatal(msg);
    }
  }

  child(bindings: LogContext): Logger {
    const childPino = this.pino.child(bindings);
    return PinoLoggerImpl.fromPino(childPino);
  }

  flush(): void {
    this.pino.flush();
  }

  /**
   * Get the underlying pino instance (for advanced use cases)
   */
  getPino(): PinoLogger {
    return this.pino;
  }
}

/**
 * Create a pino-based logger
 */
export function createPinoLogger(options?: LoggerOptions): Logger {
  return new PinoLoggerImpl(options);
}
