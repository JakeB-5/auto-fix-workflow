/**
 * @module common/error-handler/pipeline-error
 * @description Pipeline execution errors
 */

import { AutofixError } from './base.js';
import type { PipelineErrorCode } from './codes.js';
import type { BaseErrorContext } from './base.js';

/**
 * Pipeline error context
 */
export interface PipelineErrorContext extends BaseErrorContext {
  readonly stage?: string;
  readonly attempt?: number;
  readonly recoverable?: boolean;
  readonly group?: Record<string, unknown>;
  readonly durationMs?: number;
}

/**
 * Pipeline execution error
 *
 * Represents errors that occur during pipeline processing,
 * including AI analysis, fix generation, and orchestration.
 *
 * @example
 * ```typescript
 * const error = PipelineError.analysisFailed('AI service timeout', {
 *   stage: 'ai_analysis',
 *   attempt: 2,
 *   recoverable: true
 * });
 * ```
 */
export class PipelineError extends AutofixError {
  readonly code: PipelineErrorCode;
  readonly context: Readonly<PipelineErrorContext>;

  constructor(
    code: PipelineErrorCode,
    message: string,
    context: PipelineErrorContext = {}
  ) {
    super(message);
    this.code = code;
    this.context = Object.freeze({ ...context });
    this.name = 'PipelineError';
  }

  /**
   * Create error for pipeline initialization failure
   */
  static initFailed(message: string, context?: PipelineErrorContext): PipelineError {
    return new PipelineError('PIPELINE_INIT_FAILED', message, context);
  }

  /**
   * Create error for general pipeline failure
   */
  static failed(message: string, context?: PipelineErrorContext): PipelineError {
    return new PipelineError('PIPELINE_FAILED', message, context);
  }

  /**
   * Create error for pipeline interruption
   */
  static interrupted(message: string, context?: PipelineErrorContext): PipelineError {
    return new PipelineError('PIPELINE_INTERRUPTED', message, context);
  }

  /**
   * Create error for pipeline timeout
   */
  static timeout(stage: string, durationMs: number, context?: PipelineErrorContext): PipelineError {
    return new PipelineError(
      'PIPELINE_TIMEOUT',
      `Pipeline stage '${stage}' timed out after ${durationMs}ms`,
      { ...context, stage, durationMs }
    );
  }

  /**
   * Create error for AI analysis failure
   */
  static analysisFailed(message: string, context?: PipelineErrorContext): PipelineError {
    return new PipelineError('AI_ANALYSIS_FAILED', message, { ...context, recoverable: true });
  }

  /**
   * Create error for AI fix generation failure
   */
  static fixFailed(message: string, context?: PipelineErrorContext): PipelineError {
    return new PipelineError('AI_FIX_FAILED', message, { ...context, recoverable: true });
  }

  /**
   * Create error for dependency installation failure
   */
  static installDepsFailed(message: string, context?: PipelineErrorContext): PipelineError {
    return new PipelineError('INSTALL_DEPS_FAILED', message, context);
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.context.recoverable ?? false;
  }
}
