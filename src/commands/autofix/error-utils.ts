/**
 * @module commands/autofix/error-utils
 * @description Error utilities for autofix command - bridges local and common error systems
 */

import {
  AutofixError,
  PipelineError,
  IssueError,
  WorktreeError,
  CheckExecutionError,
  GitHubApiError,
  type ErrorCode,
  type PipelineErrorCode,
} from '../../common/error-handler/index.js';
import type { PipelineStage } from './types.js';

/**
 * Error aggregator for collecting multiple errors
 *
 * Collects and manages multiple errors during pipeline execution.
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
      // Convert generic Error to PipelineError
      this.errors.push(PipelineError.failed(error.message));
    } else {
      this.errors.push(PipelineError.failed(error));
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
      throw PipelineError.failed(this.getSummary(), {
        context: { errorCount: this.errors.length }
      });
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
export function stageToErrorCode(stage: PipelineStage): ErrorCode {
  const mapping: Record<PipelineStage, ErrorCode> = {
    init: 'PIPELINE_INIT_FAILED',
    worktree_create: 'WORKTREE_CREATE_FAILED',
    ai_analysis: 'AI_ANALYSIS_FAILED',
    ai_fix: 'AI_FIX_FAILED',
    install_deps: 'INSTALL_DEPS_FAILED',
    checks: 'CHECK_FAILED',
    commit: 'WORKTREE_GIT_ERROR',
    pr_create: 'PR_CREATE_FAILED',
    issue_update: 'ISSUE_UPDATE_FAILED',
    cleanup: 'WORKTREE_REMOVE_FAILED',
    done: 'PIPELINE_FAILED',
  };

  return mapping[stage];
}

/**
 * Create error from API response
 */
export function createApiError(
  status: number,
  message?: string
): GitHubApiError {
  const msg = message ?? `API error: ${status}`;

  // Use fromResponse factory method
  return GitHubApiError.fromResponse(status, msg);
}

/**
 * Create error from pipeline stage failure
 */
export function createStageError(
  stage: PipelineStage,
  message: string,
  context?: Record<string, unknown>
): AutofixError {
  const errorCode = stageToErrorCode(stage);

  switch (stage) {
    case 'worktree_create':
    case 'cleanup':
      return new WorktreeError(errorCode as any, message, context ?? {});
    case 'ai_analysis':
      return PipelineError.analysisFailed(message, { ...context, stage });
    case 'ai_fix':
      return PipelineError.fixFailed(message, { ...context, stage });
    case 'install_deps':
      return PipelineError.installDepsFailed(message, { ...context, stage });
    case 'checks':
      return new CheckExecutionError(errorCode as any, message, context ?? {});
    case 'pr_create':
      return IssueError.prCreateFailed(message, context);
    case 'issue_update':
      return IssueError.updateFailed(0, message, context);
    default:
      return PipelineError.failed(message, { ...context, stage });
  }
}
