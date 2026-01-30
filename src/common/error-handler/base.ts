/**
 * @module common/error-handler/base
 * @description Base error class for the autofix workflow
 */

import type { ErrorCode } from './codes.js';
import { serializeError, type SerializedError, type SerializeOptions } from './serializer.js';

/**
 * Base context type for all errors
 */
export interface BaseErrorContext {
  readonly [key: string]: unknown;
}

/**
 * Abstract base class for all autofix errors
 *
 * All domain-specific errors should extend this class.
 * Errors are immutable after construction.
 *
 * @example
 * ```typescript
 * class ConfigError extends AutofixError {
 *   readonly code = 'CONFIG_NOT_FOUND' as const;
 *   readonly context: ConfigErrorContext;
 *
 *   constructor(message: string, context: ConfigErrorContext) {
 *     super(message);
 *     this.context = Object.freeze(context);
 *   }
 * }
 * ```
 */
export abstract class AutofixError extends Error {
  /**
   * Error code for programmatic handling
   */
  abstract readonly code: ErrorCode;

  /**
   * Additional context about the error
   */
  abstract readonly context: Readonly<BaseErrorContext>;

  /**
   * Timestamp when the error was created
   */
  readonly timestamp: Date;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    this.timestamp = new Date();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace, excluding constructor
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Make instance immutable (shallow freeze)
    // Subclasses should freeze their context in constructor
  }

  /**
   * Convert error to a plain JSON-serializable object
   *
   * @param options - Serialization options
   * @returns Serialized error object
   */
  toJSON(options?: SerializeOptions): SerializedError {
    return serializeError(this, options);
  }

  /**
   * Convert error to string with context
   */
  override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }

  /**
   * Get a formatted string representation including context
   */
  toDetailedString(): string {
    const lines = [
      `${this.name} [${this.code}]: ${this.message}`,
      `Timestamp: ${this.timestamp.toISOString()}`,
    ];

    if (Object.keys(this.context).length > 0) {
      lines.push(`Context: ${JSON.stringify(this.context, null, 2)}`);
    }

    if (this.cause) {
      lines.push(`Cause: ${this.cause instanceof Error ? this.cause.message : String(this.cause)}`);
    }

    return lines.join('\n');
  }
}

/**
 * Type guard to check if an error is an AutofixError
 */
export function isAutofixError(error: unknown): error is AutofixError {
  return error instanceof AutofixError;
}

/**
 * Wrap an unknown error in an AutofixError if it isn't already
 *
 * @param error - Error to wrap
 * @param wrapper - Function to create the wrapper error
 * @returns The original AutofixError or a new wrapped error
 */
export function wrapError<T extends AutofixError>(
  error: unknown,
  wrapper: (message: string, cause: unknown) => T
): T {
  if (error instanceof AutofixError) {
    return error as T;
  }

  const message = error instanceof Error ? error.message : String(error);
  return wrapper(message, error);
}
