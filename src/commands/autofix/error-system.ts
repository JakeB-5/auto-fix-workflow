/**
 * @module commands/autofix/error-system
 * @description Error handling system for autofix
 */

import type { PipelineStage } from './types.js';

/**
 * Base autofix error
 */
export class AutofixError extends Error {
  readonly code: AutofixErrorCode;
  readonly recoverable: boolean;
  readonly context?: Record<string, unknown> | undefined;

  constructor(
    code: AutofixErrorCode,
    message: string,
    options?: AutofixErrorOptions
  ) {
    super(message);
    this.name = 'AutofixError';
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
    this.context = options?.context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AutofixError);
    }
  }

  /**
   * Create from unknown error
   */
  static from(error: unknown, code?: AutofixErrorCode): AutofixError {
    if (error instanceof AutofixError) {
      return error;
    }

    if (error instanceof Error) {
      return new AutofixError(
        code ?? 'UNKNOWN_ERROR',
        error.message,
        { context: { originalError: error.name } }
      );
    }

    return new AutofixError(
      code ?? 'UNKNOWN_ERROR',
      String(error)
    );
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    const messages: Record<AutofixErrorCode, string> = {
      CONFIG_INVALID: 'Configuration is invalid or missing required values.',
      CONFIG_MISSING: 'Configuration file not found.',
      GITHUB_AUTH_FAILED: 'GitHub authentication failed. Check your token.',
      GITHUB_RATE_LIMITED: 'GitHub API rate limit exceeded. Please wait.',
      GITHUB_API_ERROR: 'GitHub API error occurred.',
      ISSUE_NOT_FOUND: 'One or more issues could not be found.',
      NO_ISSUES_FOUND: 'No issues found matching the criteria.',
      WORKTREE_ERROR: 'Git worktree operation failed.',
      WORKTREE_CREATE_FAILED: 'Failed to create worktree.',
      WORKTREE_CLEANUP_FAILED: 'Failed to cleanup worktree.',
      BRANCH_EXISTS: 'Branch already exists.',
      CHECK_FAILED: 'One or more checks failed.',
      TEST_FAILED: 'Tests failed.',
      LINT_FAILED: 'Linting failed.',
      TYPECHECK_FAILED: 'Type checking failed.',
      AI_ANALYSIS_FAILED: 'AI analysis failed.',
      AI_FIX_FAILED: 'AI fix generation failed.',
      PR_CREATE_FAILED: 'Failed to create pull request.',
      PR_EXISTS: 'A pull request already exists for this branch.',
      ISSUE_UPDATE_FAILED: 'Failed to update issue.',
      PIPELINE_FAILED: 'Pipeline processing failed.',
      INTERRUPTED: 'Operation was interrupted.',
      TIMEOUT: 'Operation timed out.',
      UNKNOWN_ERROR: 'An unexpected error occurred.',
    };

    return messages[this.code] ?? this.message;
  }

  /**
   * Check if error should trigger retry
   */
  shouldRetry(): boolean {
    const retryableCodes: AutofixErrorCode[] = [
      'GITHUB_RATE_LIMITED',
      'GITHUB_API_ERROR',
      'WORKTREE_ERROR',
      'CHECK_FAILED',
      'AI_FIX_FAILED',
      'TIMEOUT',
    ];

    return this.recoverable || retryableCodes.includes(this.code);
  }

  /**
   * Get suggested action
   */
  getSuggestedAction(): string {
    const actions: Record<AutofixErrorCode, string> = {
      CONFIG_INVALID: 'Check your configuration file and environment variables.',
      CONFIG_MISSING: 'Create a configuration file or set environment variables.',
      GITHUB_AUTH_FAILED: 'Verify your GITHUB_TOKEN is valid and has required permissions.',
      GITHUB_RATE_LIMITED: 'Wait for rate limit to reset or use a different token.',
      GITHUB_API_ERROR: 'Check GitHub status and try again.',
      ISSUE_NOT_FOUND: 'Verify the issue numbers exist and are accessible.',
      NO_ISSUES_FOUND: 'Check your label filters or specify issue numbers directly.',
      WORKTREE_ERROR: 'Check git repository state and permissions.',
      WORKTREE_CREATE_FAILED: 'Ensure the branch name is valid and does not conflict.',
      WORKTREE_CLEANUP_FAILED: 'Manually remove the worktree directory.',
      BRANCH_EXISTS: 'Delete the existing branch or use a different name.',
      CHECK_FAILED: 'Review the check output and fix issues manually.',
      TEST_FAILED: 'Review test failures and fix the code.',
      LINT_FAILED: 'Run linter with --fix or fix issues manually.',
      TYPECHECK_FAILED: 'Fix type errors in the code.',
      AI_ANALYSIS_FAILED: 'Try with simpler issues or provide more context.',
      AI_FIX_FAILED: 'The AI could not generate a fix. Manual intervention needed.',
      PR_CREATE_FAILED: 'Check branch permissions and try again.',
      PR_EXISTS: 'Close the existing PR or use a different branch.',
      ISSUE_UPDATE_FAILED: 'Check issue permissions and try again.',
      PIPELINE_FAILED: 'Review the error details and try again.',
      INTERRUPTED: 'Run the command again to resume.',
      TIMEOUT: 'Increase timeout or try with fewer issues.',
      UNKNOWN_ERROR: 'Check logs for more details.',
    };

    return actions[this.code] ?? 'Check the error message for details.';
  }

  /**
   * Format error for logging
   */
  toLogFormat(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error codes
 */
export type AutofixErrorCode =
  | 'CONFIG_INVALID'
  | 'CONFIG_MISSING'
  | 'GITHUB_AUTH_FAILED'
  | 'GITHUB_RATE_LIMITED'
  | 'GITHUB_API_ERROR'
  | 'ISSUE_NOT_FOUND'
  | 'NO_ISSUES_FOUND'
  | 'WORKTREE_ERROR'
  | 'WORKTREE_CREATE_FAILED'
  | 'WORKTREE_CLEANUP_FAILED'
  | 'BRANCH_EXISTS'
  | 'CHECK_FAILED'
  | 'TEST_FAILED'
  | 'LINT_FAILED'
  | 'TYPECHECK_FAILED'
  | 'AI_ANALYSIS_FAILED'
  | 'AI_FIX_FAILED'
  | 'PR_CREATE_FAILED'
  | 'PR_EXISTS'
  | 'ISSUE_UPDATE_FAILED'
  | 'PIPELINE_FAILED'
  | 'INTERRUPTED'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * Error options
 */
export interface AutofixErrorOptions {
  readonly recoverable?: boolean;
  readonly context?: Record<string, unknown>;
}

/**
 * Error aggregator for collecting multiple errors
 */
export class ErrorAggregator {
  private readonly errors: AutofixError[] = [];
  private readonly warnings: string[] = [];

  /**
   * Add an error
   */
  addError(error: AutofixError | Error | string): void {
    if (error instanceof AutofixError) {
      this.errors.push(error);
    } else if (error instanceof Error) {
      this.errors.push(AutofixError.from(error));
    } else {
      this.errors.push(new AutofixError('UNKNOWN_ERROR', error));
    }
  }

  /**
   * Add a warning
   */
  addWarning(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Get all errors
   */
  getErrors(): readonly AutofixError[] {
    return this.errors;
  }

  /**
   * Get all warnings
   */
  getWarnings(): readonly string[] {
    return this.warnings;
  }

  /**
   * Get summary of all errors
   */
  getSummary(): string {
    if (this.errors.length === 0) {
      return 'No errors';
    }

    const lines = [`${this.errors.length} error(s) occurred:`];
    for (const error of this.errors) {
      lines.push(`  - [${error.code}] ${error.message}`);
    }

    return lines.join('\n');
  }

  /**
   * Throw if there are any errors
   */
  throwIfErrors(): void {
    if (this.errors.length === 1) {
      throw this.errors[0];
    }

    if (this.errors.length > 1) {
      throw new AutofixError(
        'PIPELINE_FAILED',
        this.getSummary(),
        { context: { errorCount: this.errors.length } }
      );
    }
  }

  /**
   * Clear all errors and warnings
   */
  clear(): void {
    this.errors.length = 0;
    this.warnings.length = 0;
  }
}

/**
 * Map pipeline stage to error code
 */
export function stageToErrorCode(stage: PipelineStage): AutofixErrorCode {
  const mapping: Record<PipelineStage, AutofixErrorCode> = {
    init: 'PIPELINE_FAILED',
    worktree_create: 'WORKTREE_CREATE_FAILED',
    ai_analysis: 'AI_ANALYSIS_FAILED',
    ai_fix: 'AI_FIX_FAILED',
    install_deps: 'PIPELINE_FAILED',
    checks: 'CHECK_FAILED',
    commit: 'WORKTREE_ERROR',
    pr_create: 'PR_CREATE_FAILED',
    issue_update: 'ISSUE_UPDATE_FAILED',
    cleanup: 'WORKTREE_CLEANUP_FAILED',
    done: 'UNKNOWN_ERROR',
  };

  return mapping[stage];
}

/**
 * Create error from API response
 */
export function createApiError(
  status: number,
  message?: string
): AutofixError {
  if (status === 401) {
    return new AutofixError('GITHUB_AUTH_FAILED', message ?? 'Authentication failed');
  }
  if (status === 403) {
    return new AutofixError('GITHUB_RATE_LIMITED', message ?? 'Rate limit exceeded');
  }
  if (status === 404) {
    return new AutofixError('ISSUE_NOT_FOUND', message ?? 'Resource not found');
  }
  if (status === 422) {
    return new AutofixError('GITHUB_API_ERROR', message ?? 'Validation failed');
  }

  return new AutofixError('GITHUB_API_ERROR', message ?? `API error: ${status}`);
}
