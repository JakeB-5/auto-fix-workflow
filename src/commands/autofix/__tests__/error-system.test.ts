/**
 * @module commands/autofix/__tests__/error-system.test
 * @description Tests for the local error-system module
 */

import { describe, it, expect } from 'vitest';
import {
  AutofixError,
  ErrorAggregator,
  stageToErrorCode,
  createApiError,
  type AutofixErrorCode,
} from '../error-system.js';
import type { PipelineStage } from '../types.js';

describe('AutofixError', () => {
  describe('constructor', () => {
    it('should create error with code, message, and defaults', () => {
      const err = new AutofixError('UNKNOWN_ERROR', 'something broke');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AutofixError);
      expect(err.name).toBe('AutofixError');
      expect(err.code).toBe('UNKNOWN_ERROR');
      expect(err.message).toBe('something broke');
      expect(err.recoverable).toBe(false);
      expect(err.context).toBeUndefined();
    });

    it('should accept recoverable option', () => {
      const err = new AutofixError('TIMEOUT', 'timed out', { recoverable: true });
      expect(err.recoverable).toBe(true);
    });

    it('should accept context option', () => {
      const ctx = { foo: 'bar' };
      const err = new AutofixError('GITHUB_API_ERROR', 'api error', { context: ctx });
      expect(err.context).toEqual(ctx);
    });

    it('should have a stack trace', () => {
      const err = new AutofixError('UNKNOWN_ERROR', 'test');
      expect(err.stack).toBeDefined();
    });
  });

  describe('from', () => {
    it('should return the same AutofixError if already an instance', () => {
      const original = new AutofixError('TIMEOUT', 'timeout');
      const result = AutofixError.from(original);
      expect(result).toBe(original);
    });

    it('should wrap a generic Error', () => {
      const generic = new TypeError('type issue');
      const result = AutofixError.from(generic);
      expect(result).toBeInstanceOf(AutofixError);
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('type issue');
      expect(result.context).toEqual({ originalError: 'TypeError' });
    });

    it('should wrap a generic Error with a custom code', () => {
      const generic = new Error('fail');
      const result = AutofixError.from(generic, 'CONFIG_INVALID');
      expect(result.code).toBe('CONFIG_INVALID');
    });

    it('should wrap a non-Error value (string)', () => {
      const result = AutofixError.from('string error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('string error');
    });

    it('should wrap a non-Error value (number)', () => {
      const result = AutofixError.from(42);
      expect(result.message).toBe('42');
    });
  });

  describe('getUserMessage', () => {
    it('should return user-friendly messages for all known codes', () => {
      const codes: AutofixErrorCode[] = [
        'CONFIG_INVALID', 'CONFIG_MISSING', 'GITHUB_AUTH_FAILED',
        'GITHUB_RATE_LIMITED', 'GITHUB_API_ERROR', 'ISSUE_NOT_FOUND',
        'NO_ISSUES_FOUND', 'WORKTREE_ERROR', 'WORKTREE_CREATE_FAILED',
        'WORKTREE_CLEANUP_FAILED', 'BRANCH_EXISTS', 'CHECK_FAILED',
        'TEST_FAILED', 'LINT_FAILED', 'TYPECHECK_FAILED',
        'AI_ANALYSIS_FAILED', 'AI_FIX_FAILED', 'PR_CREATE_FAILED',
        'PR_EXISTS', 'ISSUE_UPDATE_FAILED', 'PIPELINE_FAILED',
        'INTERRUPTED', 'TIMEOUT', 'UNKNOWN_ERROR',
      ];

      for (const code of codes) {
        const err = new AutofixError(code, 'internal msg');
        const userMsg = err.getUserMessage();
        expect(userMsg).toBeDefined();
        expect(typeof userMsg).toBe('string');
        expect(userMsg.length).toBeGreaterThan(0);
        // User message should not equal the internal message (it's a friendly version)
        // except if the mapping falls through
      }
    });

    it('should return specific messages for known codes', () => {
      expect(new AutofixError('CONFIG_INVALID', 'x').getUserMessage()).toContain('Configuration');
      expect(new AutofixError('GITHUB_AUTH_FAILED', 'x').getUserMessage()).toContain('authentication');
      expect(new AutofixError('TIMEOUT', 'x').getUserMessage()).toContain('timed out');
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retryable codes', () => {
      const retryableCodes: AutofixErrorCode[] = [
        'GITHUB_RATE_LIMITED', 'GITHUB_API_ERROR', 'WORKTREE_ERROR',
        'CHECK_FAILED', 'AI_FIX_FAILED', 'TIMEOUT',
      ];

      for (const code of retryableCodes) {
        const err = new AutofixError(code, 'test');
        expect(err.shouldRetry()).toBe(true);
      }
    });

    it('should return false for non-retryable codes', () => {
      const nonRetryable: AutofixErrorCode[] = [
        'CONFIG_INVALID', 'CONFIG_MISSING', 'GITHUB_AUTH_FAILED',
        'BRANCH_EXISTS', 'PR_EXISTS',
      ];

      for (const code of nonRetryable) {
        const err = new AutofixError(code, 'test');
        expect(err.shouldRetry()).toBe(false);
      }
    });

    it('should return true when recoverable is set even for non-retryable codes', () => {
      const err = new AutofixError('CONFIG_INVALID', 'test', { recoverable: true });
      expect(err.shouldRetry()).toBe(true);
    });
  });

  describe('getSuggestedAction', () => {
    it('should return suggestions for all known codes', () => {
      const codes: AutofixErrorCode[] = [
        'CONFIG_INVALID', 'CONFIG_MISSING', 'GITHUB_AUTH_FAILED',
        'GITHUB_RATE_LIMITED', 'GITHUB_API_ERROR', 'ISSUE_NOT_FOUND',
        'NO_ISSUES_FOUND', 'WORKTREE_ERROR', 'WORKTREE_CREATE_FAILED',
        'WORKTREE_CLEANUP_FAILED', 'BRANCH_EXISTS', 'CHECK_FAILED',
        'TEST_FAILED', 'LINT_FAILED', 'TYPECHECK_FAILED',
        'AI_ANALYSIS_FAILED', 'AI_FIX_FAILED', 'PR_CREATE_FAILED',
        'PR_EXISTS', 'ISSUE_UPDATE_FAILED', 'PIPELINE_FAILED',
        'INTERRUPTED', 'TIMEOUT', 'UNKNOWN_ERROR',
      ];

      for (const code of codes) {
        const err = new AutofixError(code, 'msg');
        const action = err.getSuggestedAction();
        expect(action).toBeDefined();
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      }
    });

    it('should return specific actions for some codes', () => {
      expect(new AutofixError('GITHUB_AUTH_FAILED', 'x').getSuggestedAction()).toContain('GITHUB_TOKEN');
      expect(new AutofixError('TIMEOUT', 'x').getSuggestedAction()).toContain('timeout');
    });
  });

  describe('toLogFormat', () => {
    it('should return a serializable object', () => {
      const err = new AutofixError('CHECK_FAILED', 'checks failed', {
        recoverable: true,
        context: { checkType: 'lint' },
      });

      const log = err.toLogFormat();
      expect(log).toHaveProperty('name', 'AutofixError');
      expect(log).toHaveProperty('code', 'CHECK_FAILED');
      expect(log).toHaveProperty('message', 'checks failed');
      expect(log).toHaveProperty('recoverable', true);
      expect(log).toHaveProperty('context', { checkType: 'lint' });
      expect(log).toHaveProperty('stack');
    });

    it('should include undefined context when not set', () => {
      const err = new AutofixError('UNKNOWN_ERROR', 'test');
      const log = err.toLogFormat();
      expect(log.context).toBeUndefined();
    });
  });
});

describe('ErrorAggregator (error-system)', () => {
  describe('addError', () => {
    it('should add AutofixError directly', () => {
      const agg = new ErrorAggregator();
      const err = new AutofixError('TIMEOUT', 'timeout');
      agg.addError(err);
      expect(agg.getErrors()).toHaveLength(1);
      expect(agg.getErrors()[0]).toBe(err);
    });

    it('should wrap generic Error using AutofixError.from', () => {
      const agg = new ErrorAggregator();
      agg.addError(new Error('generic'));
      expect(agg.getErrors()).toHaveLength(1);
      expect(agg.getErrors()[0]).toBeInstanceOf(AutofixError);
    });

    it('should wrap string as AutofixError with UNKNOWN_ERROR code', () => {
      const agg = new ErrorAggregator();
      agg.addError('string error');
      expect(agg.getErrors()).toHaveLength(1);
      const stored = agg.getErrors()[0]!;
      expect(stored).toBeInstanceOf(AutofixError);
      expect(stored.code).toBe('UNKNOWN_ERROR');
      expect(stored.message).toBe('string error');
    });
  });

  describe('addWarning', () => {
    it('should store warnings', () => {
      const agg = new ErrorAggregator();
      agg.addWarning('w1');
      agg.addWarning('w2');
      expect(agg.getWarnings()).toEqual(['w1', 'w2']);
    });
  });

  describe('hasErrors / hasWarnings', () => {
    it('should reflect current state', () => {
      const agg = new ErrorAggregator();
      expect(agg.hasErrors()).toBe(false);
      expect(agg.hasWarnings()).toBe(false);

      agg.addError('err');
      expect(agg.hasErrors()).toBe(true);

      agg.addWarning('warn');
      expect(agg.hasWarnings()).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return "No errors" when empty', () => {
      expect(new ErrorAggregator().getSummary()).toBe('No errors');
    });

    it('should include error count and details', () => {
      const agg = new ErrorAggregator();
      agg.addError(new AutofixError('TIMEOUT', 'timed out'));
      agg.addError(new AutofixError('CHECK_FAILED', 'lint failed'));
      const summary = agg.getSummary();
      expect(summary).toContain('2 error(s) occurred:');
      expect(summary).toContain('TIMEOUT');
      expect(summary).toContain('CHECK_FAILED');
    });
  });

  describe('throwIfErrors', () => {
    it('should not throw when no errors', () => {
      expect(() => new ErrorAggregator().throwIfErrors()).not.toThrow();
    });

    it('should throw the single error directly when only one', () => {
      const agg = new ErrorAggregator();
      const err = new AutofixError('TIMEOUT', 'oops');
      agg.addError(err);
      expect(() => agg.throwIfErrors()).toThrow(err);
    });

    it('should throw PIPELINE_FAILED for multiple errors', () => {
      const agg = new ErrorAggregator();
      agg.addError(new AutofixError('TIMEOUT', 'a'));
      agg.addError(new AutofixError('CHECK_FAILED', 'b'));

      try {
        agg.throwIfErrors();
        expect.unreachable('should have thrown');
      } catch (e) {
        const ae = e as AutofixError;
        expect(ae.code).toBe('PIPELINE_FAILED');
        expect(ae.context?.errorCount).toBe(2);
      }
    });
  });

  describe('clear', () => {
    it('should remove all errors and warnings', () => {
      const agg = new ErrorAggregator();
      agg.addError('e');
      agg.addWarning('w');
      agg.clear();
      expect(agg.hasErrors()).toBe(false);
      expect(agg.hasWarnings()).toBe(false);
    });
  });
});

describe('stageToErrorCode (error-system)', () => {
  it('should map all pipeline stages', () => {
    const expected: Record<PipelineStage, AutofixErrorCode> = {
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

    for (const [stage, code] of Object.entries(expected)) {
      expect(stageToErrorCode(stage as PipelineStage)).toBe(code);
    }
  });
});

describe('createApiError (error-system)', () => {
  it('should create GITHUB_AUTH_FAILED for 401', () => {
    const err = createApiError(401);
    expect(err.code).toBe('GITHUB_AUTH_FAILED');
    expect(err.message).toContain('Authentication failed');
  });

  it('should create GITHUB_RATE_LIMITED for 403', () => {
    const err = createApiError(403);
    expect(err.code).toBe('GITHUB_RATE_LIMITED');
  });

  it('should create ISSUE_NOT_FOUND for 404', () => {
    const err = createApiError(404);
    expect(err.code).toBe('ISSUE_NOT_FOUND');
  });

  it('should create GITHUB_API_ERROR for 422', () => {
    const err = createApiError(422);
    expect(err.code).toBe('GITHUB_API_ERROR');
    expect(err.message).toContain('Validation failed');
  });

  it('should create GITHUB_API_ERROR for other status codes', () => {
    const err = createApiError(500);
    expect(err.code).toBe('GITHUB_API_ERROR');
    expect(err.message).toContain('500');
  });

  it('should use custom message when provided', () => {
    const err = createApiError(401, 'custom auth message');
    expect(err.message).toBe('custom auth message');
  });

  it('should use default message for 403 when not provided', () => {
    const err = createApiError(403);
    expect(err.message).toContain('Rate limit exceeded');
  });

  it('should use default message for 404 when not provided', () => {
    const err = createApiError(404);
    expect(err.message).toContain('not found');
  });
});
