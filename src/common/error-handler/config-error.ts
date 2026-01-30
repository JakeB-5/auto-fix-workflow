/**
 * @module common/error-handler/config-error
 * @description Configuration-related error class
 */

import { AutofixError } from './base.js';
import type { ConfigErrorCode } from './codes.js';

/**
 * Context for configuration errors
 */
export interface ConfigErrorContext {
  /** Path to the configuration file (if applicable) */
  readonly path?: string | undefined;
  /** The invalid value (if applicable) */
  readonly value?: unknown;
  /** Expected type or format */
  readonly expected?: string | undefined;
  /** Actual type or format received */
  readonly actual?: string | undefined;
  /** Field name that caused the error */
  readonly field?: string | undefined;
  /** Validation errors */
  readonly validationErrors?: readonly string[] | undefined;
}

/**
 * Error class for configuration-related errors
 *
 * @example
 * ```typescript
 * throw new ConfigError(
 *   'CONFIG_NOT_FOUND',
 *   'Configuration file not found',
 *   { path: '/path/to/config.yaml' }
 * );
 * ```
 */
export class ConfigError extends AutofixError {
  readonly code: ConfigErrorCode;
  readonly context: Readonly<ConfigErrorContext>;

  constructor(
    code: ConfigErrorCode,
    message: string,
    context: ConfigErrorContext = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code;
    this.context = Object.freeze({ ...context });
    Object.freeze(this);
  }

  /**
   * Create a ConfigError for missing configuration file
   */
  static notFound(path: string): ConfigError {
    return new ConfigError(
      'CONFIG_NOT_FOUND',
      `Configuration file not found: ${path}`,
      { path }
    );
  }

  /**
   * Create a ConfigError for invalid format
   */
  static invalidFormat(path: string, expected: string, actual?: string): ConfigError {
    const message = actual
      ? `Invalid configuration format in ${path}: expected ${expected}, got ${actual}`
      : `Invalid configuration format in ${path}: expected ${expected}`;

    return new ConfigError(
      'CONFIG_INVALID_FORMAT',
      message,
      { path, expected, actual }
    );
  }

  /**
   * Create a ConfigError for parse errors
   */
  static parseError(path: string, cause: unknown): ConfigError {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    return new ConfigError(
      'CONFIG_PARSE_ERROR',
      `Failed to parse configuration file ${path}: ${causeMessage}`,
      { path },
      { cause }
    );
  }

  /**
   * Create a ConfigError for validation failures
   */
  static validationError(
    message: string,
    validationErrors: readonly string[],
    path?: string
  ): ConfigError {
    return new ConfigError(
      'CONFIG_VALIDATION_ERROR',
      message,
      { path, validationErrors }
    );
  }

  /**
   * Create a ConfigError for missing required fields
   */
  static missingRequired(field: string, path?: string): ConfigError {
    return new ConfigError(
      'CONFIG_MISSING_REQUIRED',
      `Missing required configuration field: ${field}`,
      { field, path }
    );
  }

  /**
   * Create a ConfigError for type mismatches
   */
  static typeMismatch(
    field: string,
    expected: string,
    actual: string,
    value?: unknown
  ): ConfigError {
    return new ConfigError(
      'CONFIG_TYPE_MISMATCH',
      `Type mismatch for field '${field}': expected ${expected}, got ${actual}`,
      { field, expected, actual, value }
    );
  }
}
