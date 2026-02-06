/**
 * @module commands/autofix/__tests__/error-utils.test
 * @description Tests for error-utils module
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorAggregator,
  stageToErrorCode,
  createApiError,
  createStageError,
} from '../error-utils.js';
import {
  AutofixError,
  PipelineError,
  WorktreeError,
  CheckExecutionError,
  IssueError,
  GitHubApiError,
} from '../../../common/error-handler/index.js';
import type { PipelineStage } from '../types.js';

// Helper to create a basic PipelineError for testing
function makePipelineError(msg: string): PipelineError {
  return PipelineError.failed(msg);
}

describe('ErrorAggregator', () => {
  describe('addError', () => {
    it('should add an AutofixError directly', () => {
      const agg = new ErrorAggregator();
      const error = makePipelineError('test error');
      agg.addError(error);

      expect(agg.hasErrors()).toBe(true);
      expect(agg.getErrors()).toHaveLength(1);
      expect(agg.getErrors()[0]).toBe(error);
    });

    it('should wrap a generic Error as PipelineError', () => {
      const agg = new ErrorAggregator();
      agg.addError(new Error('generic error'));

      expect(agg.hasErrors()).toBe(true);
      expect(agg.getErrors()).toHaveLength(1);
      const stored = agg.getErrors()[0]!;
      expect(stored).toBeInstanceOf(AutofixError);
      expect(stored.message).toBe('generic error');
    });

    it('should wrap a string as PipelineError', () => {
      const agg = new ErrorAggregator();
      agg.addError('string error');

      expect(agg.hasErrors()).toBe(true);
      expect(agg.getErrors()).toHaveLength(1);
      const stored = agg.getErrors()[0]!;
      expect(stored).toBeInstanceOf(AutofixError);
      expect(stored.message).toBe('string error');
    });

    it('should accumulate multiple errors', () => {
      const agg = new ErrorAggregator();
      agg.addError(makePipelineError('error 1'));
      agg.addError(new Error('error 2'));
      agg.addError('error 3');

      expect(agg.getErrors()).toHaveLength(3);
    });
  });

  describe('addWarning', () => {
    it('should add a warning string', () => {
      const agg = new ErrorAggregator();
      agg.addWarning('watch out');

      expect(agg.hasWarnings()).toBe(true);
      expect(agg.getWarnings()).toEqual(['watch out']);
    });

    it('should accumulate multiple warnings', () => {
      const agg = new ErrorAggregator();
      agg.addWarning('warning 1');
      agg.addWarning('warning 2');

      expect(agg.getWarnings()).toHaveLength(2);
    });
  });

  describe('hasErrors / hasWarnings', () => {
    it('should return false when empty', () => {
      const agg = new ErrorAggregator();
      expect(agg.hasErrors()).toBe(false);
      expect(agg.hasWarnings()).toBe(false);
    });

    it('should return true after adding respective items', () => {
      const agg = new ErrorAggregator();
      agg.addError('err');
      agg.addWarning('warn');
      expect(agg.hasErrors()).toBe(true);
      expect(agg.hasWarnings()).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return "No errors" when empty', () => {
      const agg = new ErrorAggregator();
      expect(agg.getSummary()).toBe('No errors');
    });

    it('should format a single error summary', () => {
      const agg = new ErrorAggregator();
      agg.addError(makePipelineError('some failure'));

      const summary = agg.getSummary();
      expect(summary).toContain('1 error(s) occurred:');
      expect(summary).toContain('PIPELINE_FAILED');
      expect(summary).toContain('some failure');
    });

    it('should format multiple errors in summary', () => {
      const agg = new ErrorAggregator();
      agg.addError(makePipelineError('failure 1'));
      agg.addError(makePipelineError('failure 2'));

      const summary = agg.getSummary();
      expect(summary).toContain('2 error(s) occurred:');
      expect(summary).toContain('failure 1');
      expect(summary).toContain('failure 2');
    });
  });

  describe('throwIfErrors', () => {
    it('should not throw when no errors', () => {
      const agg = new ErrorAggregator();
      expect(() => agg.throwIfErrors()).not.toThrow();
    });

    it('should throw the single error directly', () => {
      const agg = new ErrorAggregator();
      const error = makePipelineError('single error');
      agg.addError(error);

      expect(() => agg.throwIfErrors()).toThrow(error);
    });

    it('should throw a combined PipelineError for multiple errors', () => {
      const agg = new ErrorAggregator();
      agg.addError(makePipelineError('err1'));
      agg.addError(makePipelineError('err2'));

      try {
        agg.throwIfErrors();
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PipelineError);
        const pe = e as PipelineError;
        expect(pe.message).toContain('2 error(s) occurred:');
        // PipelineError wraps context as PipelineErrorContext; the errorCount is nested
        expect((pe.context as any).context).toEqual({ errorCount: 2 });
      }
    });
  });

  describe('clear', () => {
    it('should clear all errors and warnings', () => {
      const agg = new ErrorAggregator();
      agg.addError('err');
      agg.addWarning('warn');

      agg.clear();

      expect(agg.hasErrors()).toBe(false);
      expect(agg.hasWarnings()).toBe(false);
      expect(agg.getErrors()).toHaveLength(0);
      expect(agg.getWarnings()).toHaveLength(0);
    });
  });
});

describe('stageToErrorCode', () => {
  it('should map all pipeline stages to error codes', () => {
    const stages: PipelineStage[] = [
      'init', 'worktree_create', 'ai_analysis', 'ai_fix',
      'install_deps', 'checks', 'commit', 'pr_create',
      'issue_update', 'cleanup', 'done',
    ];

    for (const stage of stages) {
      const code = stageToErrorCode(stage);
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
    }
  });

  it('should map specific stages correctly', () => {
    expect(stageToErrorCode('init')).toBe('PIPELINE_INIT_FAILED');
    expect(stageToErrorCode('worktree_create')).toBe('WORKTREE_CREATE_FAILED');
    expect(stageToErrorCode('ai_analysis')).toBe('AI_ANALYSIS_FAILED');
    expect(stageToErrorCode('ai_fix')).toBe('AI_FIX_FAILED');
    expect(stageToErrorCode('install_deps')).toBe('INSTALL_DEPS_FAILED');
    expect(stageToErrorCode('checks')).toBe('CHECK_FAILED');
    expect(stageToErrorCode('commit')).toBe('WORKTREE_GIT_ERROR');
    expect(stageToErrorCode('pr_create')).toBe('PR_CREATE_FAILED');
    expect(stageToErrorCode('issue_update')).toBe('ISSUE_UPDATE_FAILED');
    expect(stageToErrorCode('cleanup')).toBe('WORKTREE_REMOVE_FAILED');
    expect(stageToErrorCode('done')).toBe('PIPELINE_FAILED');
  });
});

describe('createApiError', () => {
  it('should create a GitHubApiError from status code', () => {
    const error = createApiError(500);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error.message).toContain('500');
  });

  it('should use custom message when provided', () => {
    const error = createApiError(404, 'Not found');
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error.message).toBe('Not found');
  });

  it('should generate default message when not provided', () => {
    const error = createApiError(503);
    expect(error.message).toBe('API error: 503');
  });
});

describe('createStageError', () => {
  it('should create WorktreeError for worktree_create stage', () => {
    const error = createStageError('worktree_create', 'worktree failed');
    expect(error).toBeInstanceOf(WorktreeError);
    expect(error.message).toBe('worktree failed');
  });

  it('should create WorktreeError for cleanup stage', () => {
    const error = createStageError('cleanup', 'cleanup failed');
    expect(error).toBeInstanceOf(WorktreeError);
  });

  it('should create PipelineError with analysisFailed for ai_analysis', () => {
    const error = createStageError('ai_analysis', 'analysis failed');
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.code).toBe('AI_ANALYSIS_FAILED');
  });

  it('should create PipelineError with fixFailed for ai_fix', () => {
    const error = createStageError('ai_fix', 'fix failed');
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.code).toBe('AI_FIX_FAILED');
  });

  it('should create PipelineError with installDepsFailed for install_deps', () => {
    const error = createStageError('install_deps', 'install failed');
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.code).toBe('INSTALL_DEPS_FAILED');
  });

  it('should create CheckExecutionError for checks stage', () => {
    const error = createStageError('checks', 'check failed');
    expect(error).toBeInstanceOf(CheckExecutionError);
    expect(error.message).toBe('check failed');
  });

  it('should create IssueError for pr_create stage', () => {
    const error = createStageError('pr_create', 'pr failed');
    expect(error).toBeInstanceOf(IssueError);
    expect(error.code).toBe('PR_CREATE_FAILED');
  });

  it('should create IssueError for issue_update stage', () => {
    const error = createStageError('issue_update', 'update failed');
    expect(error).toBeInstanceOf(IssueError);
    expect(error.code).toBe('ISSUE_UPDATE_FAILED');
  });

  it('should create PipelineError for default/unknown stages', () => {
    const error = createStageError('init', 'init failed');
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.code).toBe('PIPELINE_FAILED');
  });

  it('should create PipelineError for done stage (default case)', () => {
    const error = createStageError('done', 'done failed');
    expect(error).toBeInstanceOf(PipelineError);
    expect(error.code).toBe('PIPELINE_FAILED');
  });

  it('should pass context to the created error', () => {
    const error = createStageError('ai_analysis', 'failed', { extra: 'data' });
    expect(error).toBeInstanceOf(PipelineError);
    // Context is passed through
    const pe = error as PipelineError;
    expect(pe.context).toBeDefined();
  });

  it('should default context to empty object for worktree errors', () => {
    const error = createStageError('worktree_create', 'failed');
    expect(error).toBeInstanceOf(WorktreeError);
  });

  it('should default context to empty object for check errors', () => {
    const error = createStageError('checks', 'failed');
    expect(error).toBeInstanceOf(CheckExecutionError);
  });
});
