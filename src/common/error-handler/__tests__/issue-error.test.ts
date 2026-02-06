/**
 * @module common/error-handler/__tests__/issue-error
 * @description Tests for IssueError class
 */

import { describe, it, expect } from 'vitest';
import { IssueError } from '../issue-error.js';
import { AutofixError } from '../base.js';

describe('IssueError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AutofixError);
      expect(error).toBeInstanceOf(IssueError);
      expect(error.code).toBe('ISSUE_NOT_FOUND');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('IssueError');
      expect(error.context).toEqual({});
    });

    it('should create error with context', () => {
      const context = { issueNumber: 123, url: 'https://example.com' };
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test message', context);

      expect(error.context).toEqual(context);
      expect(error.context.issueNumber).toBe(123);
      expect(error.context.url).toBe('https://example.com');
    });

    it('should freeze context to make it immutable', () => {
      const context = { issueNumber: 123 };
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test message', context);

      expect(Object.isFrozen(error.context)).toBe(true);
      expect(() => {
        (error.context as { issueNumber: number }).issueNumber = 456;
      }).toThrow();
    });

    it('should handle empty context', () => {
      const error = new IssueError('NO_ISSUES_FOUND', 'No issues');

      expect(error.context).toEqual({});
      expect(Object.keys(error.context).length).toBe(0);
    });
  });

  describe('static factory methods', () => {
    describe('notFound', () => {
      it('should create error for issue not found', () => {
        const error = IssueError.notFound(123);

        expect(error.code).toBe('ISSUE_NOT_FOUND');
        expect(error.message).toBe('Issue #123 not found');
        expect(error.context.issueNumber).toBe(123);
      });

      it('should include additional context', () => {
        const error = IssueError.notFound(123, { url: 'https://github.com/owner/repo/issues/123' });

        expect(error.code).toBe('ISSUE_NOT_FOUND');
        expect(error.message).toBe('Issue #123 not found');
        expect(error.context.issueNumber).toBe(123);
        expect(error.context.url).toBe('https://github.com/owner/repo/issues/123');
      });

      it('should merge context properly', () => {
        const error = IssueError.notFound(123, { state: 'closed' });

        expect(error.context.issueNumber).toBe(123);
        expect(error.context.state).toBe('closed');
      });
    });

    describe('noIssuesFound', () => {
      it('should create error for no issues found', () => {
        const error = IssueError.noIssuesFound('No open issues matching criteria');

        expect(error.code).toBe('NO_ISSUES_FOUND');
        expect(error.message).toBe('No open issues matching criteria');
        expect(error.context).toEqual({});
      });

      it('should include context if provided', () => {
        const context = { issueNumbers: [1, 2, 3] };
        const error = IssueError.noIssuesFound('No issues', context);

        expect(error.code).toBe('NO_ISSUES_FOUND');
        expect(error.context.issueNumbers).toEqual([1, 2, 3]);
      });
    });

    describe('updateFailed', () => {
      it('should create error for issue update failure', () => {
        const error = IssueError.updateFailed(456, 'Network timeout');

        expect(error.code).toBe('ISSUE_UPDATE_FAILED');
        expect(error.message).toBe('Failed to update issue #456: Network timeout');
        expect(error.context.issueNumber).toBe(456);
      });

      it('should include additional context', () => {
        const error = IssueError.updateFailed(456, 'Rate limited', { state: 'open' });

        expect(error.code).toBe('ISSUE_UPDATE_FAILED');
        expect(error.message).toBe('Failed to update issue #456: Rate limited');
        expect(error.context.issueNumber).toBe(456);
        expect(error.context.state).toBe('open');
      });
    });

    describe('prExists', () => {
      it('should create error for existing PR', () => {
        const error = IssueError.prExists(789, 'https://github.com/owner/repo/pull/789');

        expect(error.code).toBe('PR_EXISTS');
        expect(error.message).toBe('Pull request #789 already exists');
        expect(error.context.prNumber).toBe(789);
        expect(error.context.url).toBe('https://github.com/owner/repo/pull/789');
      });

      it('should include additional context', () => {
        const error = IssueError.prExists(
          789,
          'https://github.com/owner/repo/pull/789',
          { state: 'open' }
        );

        expect(error.context.prNumber).toBe(789);
        expect(error.context.url).toBe('https://github.com/owner/repo/pull/789');
        expect(error.context.state).toBe('open');
      });
    });

    describe('prCreateFailed', () => {
      it('should create error for PR creation failure', () => {
        const error = IssueError.prCreateFailed('Failed to push branch');

        expect(error.code).toBe('PR_CREATE_FAILED');
        expect(error.message).toBe('Failed to push branch');
        expect(error.context).toEqual({});
      });

      it('should include context if provided', () => {
        const error = IssueError.prCreateFailed('Failed', { issueNumber: 123 });

        expect(error.code).toBe('PR_CREATE_FAILED');
        expect(error.message).toBe('Failed');
        expect(error.context.issueNumber).toBe(123);
      });
    });
  });

  describe('error properties', () => {
    it('should have timestamp', () => {
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test');

      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should have stack trace', () => {
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('IssueError');
    });

    it('should support instanceof checks', () => {
      const error = IssueError.notFound(123);

      expect(error instanceof IssueError).toBe(true);
      expect(error instanceof AutofixError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('error with various context types', () => {
    it('should handle issueNumber in context', () => {
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test', { issueNumber: 999 });

      expect(error.context.issueNumber).toBe(999);
    });

    it('should handle issueNumbers array in context', () => {
      const error = new IssueError('NO_ISSUES_FOUND', 'Test', { issueNumbers: [1, 2, 3] });

      expect(error.context.issueNumbers).toEqual([1, 2, 3]);
    });

    it('should handle prNumber in context', () => {
      const error = new IssueError('PR_EXISTS', 'Test', { prNumber: 42 });

      expect(error.context.prNumber).toBe(42);
    });

    it('should handle url in context', () => {
      const error = new IssueError('PR_EXISTS', 'Test', { url: 'https://example.com/pr/1' });

      expect(error.context.url).toBe('https://example.com/pr/1');
    });

    it('should handle state in context', () => {
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test', { state: 'closed' });

      expect(error.context.state).toBe('closed');
    });

    it('should handle multiple context fields', () => {
      const context = {
        issueNumber: 123,
        url: 'https://example.com',
        state: 'open',
      };
      const error = new IssueError('ISSUE_NOT_FOUND', 'Test', context);

      expect(error.context).toEqual(context);
    });
  });
});
