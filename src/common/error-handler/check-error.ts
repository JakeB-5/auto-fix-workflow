/**
 * @module common/error-handler/check-error
 * @description Check execution error class
 */

import { AutofixError } from './base.js';
import type { CheckErrorCode } from './codes.js';

/**
 * Context for check execution errors
 */
export interface CheckExecutionErrorContext {
  /** Check type (lint, type-check, test, build) */
  readonly checkType?: string | undefined;
  /** Command that was executed */
  readonly command?: string | undefined;
  /** Working directory */
  readonly cwd?: string | undefined;
  /** Exit code */
  readonly exitCode?: number | undefined;
  /** Standard output */
  readonly stdout?: string | undefined;
  /** Standard error */
  readonly stderr?: string | undefined;
  /** Timeout value in ms */
  readonly timeout?: number | undefined;
  /** Duration in ms */
  readonly duration?: number | undefined;
  /** Missing dependency */
  readonly missingDependency?: string | undefined;
  /** Check configuration file */
  readonly configFile?: string | undefined;
}

/**
 * Error class for check execution errors
 *
 * @example
 * ```typescript
 * throw new CheckExecutionError(
 *   'CHECK_FAILED',
 *   'TypeScript compilation failed',
 *   { checkType: 'type-check', command: 'tsc', exitCode: 1 }
 * );
 * ```
 */
export class CheckExecutionError extends AutofixError {
  readonly code: CheckErrorCode;
  readonly context: Readonly<CheckExecutionErrorContext>;

  constructor(
    code: CheckErrorCode,
    message: string,
    context: CheckExecutionErrorContext = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code;
    this.context = Object.freeze({ ...context });
    Object.freeze(this);
  }

  /**
   * Create a CheckExecutionError for timeouts
   */
  static timeout(
    checkType: string,
    command: string,
    timeout: number,
    duration?: number
  ): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_TIMEOUT',
      `Check '${checkType}' timed out after ${timeout}ms`,
      { checkType, command, timeout, duration }
    );
  }

  /**
   * Create a CheckExecutionError for check failures
   */
  static failed(
    checkType: string,
    command: string,
    exitCode: number,
    stderr?: string,
    stdout?: string
  ): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_FAILED',
      `Check '${checkType}' failed with exit code ${exitCode}`,
      { checkType, command, exitCode, stderr, stdout }
    );
  }

  /**
   * Create a CheckExecutionError for missing check commands
   */
  static notFound(checkType: string, command: string): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_NOT_FOUND',
      `Check command not found: ${command}`,
      { checkType, command }
    );
  }

  /**
   * Create a CheckExecutionError for invalid configurations
   */
  static invalidConfig(
    checkType: string,
    configFile: string,
    reason: string
  ): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_INVALID_CONFIG',
      `Invalid configuration for '${checkType}' in ${configFile}: ${reason}`,
      { checkType, configFile }
    );
  }

  /**
   * Create a CheckExecutionError for dependency errors
   */
  static dependencyError(
    checkType: string,
    missingDependency: string,
    cause?: unknown
  ): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_DEPENDENCY_ERROR',
      `Missing dependency '${missingDependency}' required for '${checkType}'`,
      { checkType, missingDependency },
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a CheckExecutionError for permission denied
   */
  static permissionDenied(
    checkType: string,
    command: string,
    cwd?: string
  ): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_PERMISSION_DENIED',
      `Permission denied executing '${command}' for check '${checkType}'`,
      { checkType, command, cwd }
    );
  }

  /**
   * Create a CheckExecutionError for unknown errors
   */
  static unknown(
    checkType: string,
    message: string,
    cause?: unknown
  ): CheckExecutionError {
    return new CheckExecutionError(
      'CHECK_UNKNOWN',
      `Unknown error in check '${checkType}': ${message}`,
      { checkType },
      cause ? { cause } : undefined
    );
  }

  /**
   * Check if the error is a timeout
   */
  get isTimeout(): boolean {
    return this.code === 'CHECK_TIMEOUT';
  }

  /**
   * Check if the error might be resolved by installing dependencies
   */
  get needsDependencies(): boolean {
    return this.code === 'CHECK_DEPENDENCY_ERROR' || this.code === 'CHECK_NOT_FOUND';
  }

  /**
   * Get a summary suitable for display
   */
  get summary(): string {
    const parts = [`Check failed: ${this.context.checkType ?? 'unknown'}`];

    if (this.context.exitCode !== undefined) {
      parts.push(`exit code ${this.context.exitCode}`);
    }

    if (this.context.duration !== undefined) {
      parts.push(`duration ${this.context.duration}ms`);
    }

    return parts.join(' - ');
  }
}
