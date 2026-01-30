/**
 * @module common/error-handler/serializer
 * @description Error serialization utilities
 */

import { maskSensitiveData } from './masking.js';
import type { ErrorCode } from './codes.js';

/**
 * Serialized error structure
 */
export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly code?: ErrorCode | undefined;
  readonly context?: Record<string, unknown> | undefined;
  readonly stack?: string | undefined;
  readonly cause?: SerializedError | undefined;
  readonly timestamp: string;
}

/**
 * Options for error serialization
 */
export interface SerializeOptions {
  /** Include stack trace (default: true in development) */
  readonly includeStack?: boolean | undefined;
  /** Mask sensitive data (default: true) */
  readonly maskSensitive?: boolean | undefined;
  /** Additional patterns to mask */
  readonly maskPatterns?: string[] | undefined;
  /** Maximum depth for nested errors (default: 5) */
  readonly maxDepth?: number | undefined;
}

const DEFAULT_OPTIONS: Required<SerializeOptions> = {
  includeStack: process.env['NODE_ENV'] !== 'production',
  maskSensitive: true,
  maskPatterns: [],
  maxDepth: 5,
};

/**
 * Interface for errors with code and context
 */
interface AutofixErrorLike {
  readonly name: string;
  readonly message: string;
  readonly code?: ErrorCode | undefined;
  readonly context?: Record<string, unknown> | undefined;
  readonly stack?: string | undefined;
  readonly cause?: unknown;
}

/**
 * Check if an error has autofix error properties
 */
function isAutofixErrorLike(error: unknown): error is AutofixErrorLike {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    'message' in error
  );
}

/**
 * Serialize an error to a plain object
 *
 * @param error - Error to serialize
 * @param options - Serialization options
 * @returns Serialized error object
 */
export function serializeError(
  error: unknown,
  options: SerializeOptions = {}
): SerializedError {
  return serializeErrorInternal(error, { ...DEFAULT_OPTIONS, ...options }, 0);
}

function serializeErrorInternal(
  error: unknown,
  options: Required<SerializeOptions>,
  depth: number
): SerializedError {
  const timestamp = new Date().toISOString();

  // Handle null/undefined
  if (error === null || error === undefined) {
    return {
      name: 'UnknownError',
      message: String(error),
      timestamp,
    };
  }

  // Handle non-object errors
  if (typeof error !== 'object') {
    return {
      name: 'UnknownError',
      message: String(error),
      timestamp,
    };
  }

  // Handle Error-like objects
  if (isAutofixErrorLike(error)) {
    const result: SerializedError = {
      name: error.name,
      message: options.maskSensitive
        ? String(maskSensitiveData(error.message, options.maskPatterns))
        : error.message,
      timestamp,
    };

    // Add code if present
    if (error.code !== undefined) {
      (result as { code: ErrorCode }).code = error.code;
    }

    // Add context if present
    if (error.context !== undefined) {
      const context = options.maskSensitive
        ? maskSensitiveData(error.context, options.maskPatterns) as Record<string, unknown>
        : error.context;
      (result as { context: Record<string, unknown> }).context = context;
    }

    // Add stack if requested
    if (options.includeStack && error.stack) {
      (result as { stack: string }).stack = options.maskSensitive
        ? String(maskSensitiveData(error.stack, options.maskPatterns))
        : error.stack;
    }

    // Serialize cause if present and within depth limit
    if (error.cause !== undefined && depth < (options.maxDepth ?? 5)) {
      (result as { cause: SerializedError }).cause = serializeErrorInternal(
        error.cause,
        options,
        depth + 1
      );
    }

    return result;
  }

  // Handle plain objects
  return {
    name: 'UnknownError',
    message: JSON.stringify(
      options.maskSensitive
        ? maskSensitiveData(error, options.maskPatterns)
        : error
    ),
    timestamp,
  };
}

/**
 * Convert a serialized error back to JSON string
 *
 * @param error - Serialized error
 * @param pretty - Use pretty formatting (default: false)
 * @returns JSON string
 */
export function stringifyError(
  error: SerializedError,
  pretty = false
): string {
  return JSON.stringify(error, null, pretty ? 2 : undefined);
}

/**
 * Parse a JSON string to a serialized error
 *
 * @param json - JSON string
 * @returns Parsed serialized error or null if invalid
 */
export function parseSerializedError(json: string): SerializedError | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'name' in parsed &&
      'message' in parsed &&
      'timestamp' in parsed
    ) {
      return parsed as SerializedError;
    }
    return null;
  } catch {
    return null;
  }
}
