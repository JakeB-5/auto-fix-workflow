/**
 * @module common/config-loader/errors
 * @description Custom error class for configuration errors
 */

/**
 * Error codes for configuration errors
 */
export type ConfigErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_PARSE_ERROR'
  | 'CONFIG_VALIDATION_ERROR'
  | 'CONFIG_READ_ERROR'
  | 'ENV_OVERRIDE_ERROR';

/**
 * Custom error class for configuration-related errors
 */
export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly path?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ConfigErrorCode,
    message: string,
    options?: {
      path?: string | undefined;
      details?: Record<string, unknown> | undefined;
      cause?: Error | undefined;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ConfigError';
    this.code = code;
    if (options?.path !== undefined) {
      this.path = options.path;
    }
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }

  /**
   * Create a "config not found" error
   */
  static notFound(searchedPaths: string[]): ConfigError {
    return new ConfigError(
      'CONFIG_NOT_FOUND',
      `Configuration file not found. Searched paths: ${searchedPaths.join(', ')}`,
      { details: { searchedPaths } }
    );
  }

  /**
   * Create a "config parse error"
   */
  static parseError(path: string, cause: Error): ConfigError {
    return new ConfigError(
      'CONFIG_PARSE_ERROR',
      `Failed to parse configuration file: ${cause.message}`,
      { path, cause }
    );
  }

  /**
   * Create a "config validation error"
   */
  static validationError(
    path: string,
    issues: Array<{ path: string; message: string }>
  ): ConfigError {
    const issueMessages = issues
      .map((i) => `  - ${i.path}: ${i.message}`)
      .join('\n');
    return new ConfigError(
      'CONFIG_VALIDATION_ERROR',
      `Configuration validation failed:\n${issueMessages}`,
      { path, details: { issues } }
    );
  }

  /**
   * Create a "config read error"
   */
  static readError(path: string, cause: Error): ConfigError {
    return new ConfigError(
      'CONFIG_READ_ERROR',
      `Failed to read configuration file: ${cause.message}`,
      { path, cause }
    );
  }

  /**
   * Create an "env override error"
   */
  static envOverrideError(envVar: string, cause: Error): ConfigError {
    return new ConfigError(
      'ENV_OVERRIDE_ERROR',
      `Failed to apply environment variable override for ${envVar}: ${cause.message}`,
      { details: { envVar }, cause }
    );
  }
}
