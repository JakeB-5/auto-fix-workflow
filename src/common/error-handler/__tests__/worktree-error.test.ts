/**
 * @module common/error-handler/__tests__/worktree-error
 * @description Tests for WorktreeError class
 */

import { describe, it, expect } from 'vitest';
import { WorktreeError } from '../worktree-error.js';
import { AutofixError } from '../base.js';

describe('WorktreeError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AutofixError);
      expect(error).toBeInstanceOf(WorktreeError);
      expect(error.code).toBe('WORKTREE_NOT_FOUND');
      expect(error.message).toBe('Test message');
      expect(error.context).toEqual({});
    });

    it('should create error with context', () => {
      const context = { path: '/test/path', branch: 'test-branch' };
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test message', context);

      expect(error.context).toEqual(context);
      expect(error.context.path).toBe('/test/path');
      expect(error.context.branch).toBe('test-branch');
    });

    it('should freeze error instance', () => {
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test');

      expect(Object.isFrozen(error)).toBe(true);
    });

    it('should freeze context', () => {
      const context = { path: '/test/path' };
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test', context);

      expect(Object.isFrozen(error.context)).toBe(true);
      expect(() => {
        (error.context as { path: string }).path = '/new/path';
      }).toThrow();
    });

    it('should freeze uncommittedFiles array', () => {
      const uncommittedFiles = ['file1.ts', 'file2.ts'];
      const error = new WorktreeError('WORKTREE_DIRTY', 'Test', { uncommittedFiles });

      expect(Object.isFrozen(error.context.uncommittedFiles)).toBe(true);
    });

    it('should handle options with cause', () => {
      const cause = new Error('Original error');
      const error = new WorktreeError('WORKTREE_CREATE_FAILED', 'Test', {}, { cause });

      expect(error.cause).toBe(cause);
    });

    it('should handle empty context', () => {
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test');

      // Context always includes uncommittedFiles (even if undefined)
      expect(error.context).toEqual({ uncommittedFiles: undefined });
      expect(error.context.uncommittedFiles).toBeUndefined();
    });
  });

  describe('static factory methods', () => {
    describe('createFailed', () => {
      it('should create error for worktree creation failure', () => {
        const error = WorktreeError.createFailed('/test/path', 'test-branch', 'branch exists');

        expect(error.code).toBe('WORKTREE_CREATE_FAILED');
        expect(error.message).toBe(
          'Failed to create worktree at /test/path for branch test-branch: branch exists'
        );
        expect(error.context.path).toBe('/test/path');
        expect(error.context.branch).toBe('test-branch');
      });

      it('should include cause if provided', () => {
        const cause = new Error('Git error');
        const error = WorktreeError.createFailed('/test/path', 'branch', 'reason', cause);

        expect(error.cause).toBe(cause);
      });

      it('should work without cause', () => {
        const error = WorktreeError.createFailed('/test/path', 'branch', 'reason');

        expect(error.cause).toBeUndefined();
      });
    });

    describe('removeFailed', () => {
      it('should create error for worktree removal failure', () => {
        const error = WorktreeError.removeFailed('/test/path', 'worktree locked');

        expect(error.code).toBe('WORKTREE_REMOVE_FAILED');
        expect(error.message).toBe('Failed to remove worktree at /test/path: worktree locked');
        expect(error.context.path).toBe('/test/path');
      });

      it('should include cause if provided', () => {
        const cause = new Error('Git error');
        const error = WorktreeError.removeFailed('/test/path', 'reason', cause);

        expect(error.cause).toBe(cause);
      });

      it('should work without cause', () => {
        const error = WorktreeError.removeFailed('/test/path', 'reason');

        expect(error.cause).toBeUndefined();
      });
    });

    describe('notFound', () => {
      it('should create error for worktree not found', () => {
        const error = WorktreeError.notFound('/test/path');

        expect(error.code).toBe('WORKTREE_NOT_FOUND');
        expect(error.message).toBe('Worktree not found at /test/path');
        expect(error.context.path).toBe('/test/path');
      });

      it('should handle various path formats', () => {
        const paths = ['/absolute/path', 'relative/path', 'C:\\Windows\\Path'];
        for (const path of paths) {
          const error = WorktreeError.notFound(path);
          expect(error.context.path).toBe(path);
        }
      });
    });

    describe('alreadyExists', () => {
      it('should create error with path and branch', () => {
        const error = WorktreeError.alreadyExists('/test/path', 'test-branch');

        expect(error.code).toBe('WORKTREE_ALREADY_EXISTS');
        expect(error.message).toBe('Worktree for branch test-branch already exists at /test/path');
        expect(error.context.path).toBe('/test/path');
        expect(error.context.branch).toBe('test-branch');
      });

      it('should create error with only path', () => {
        const error = WorktreeError.alreadyExists('/test/path');

        expect(error.code).toBe('WORKTREE_ALREADY_EXISTS');
        expect(error.message).toBe('Worktree already exists at /test/path');
        expect(error.context.path).toBe('/test/path');
        expect(error.context.branch).toBeUndefined();
      });

      it('should handle undefined branch', () => {
        const error = WorktreeError.alreadyExists('/test/path', undefined);

        expect(error.message).toBe('Worktree already exists at /test/path');
        expect(error.context.branch).toBeUndefined();
      });
    });

    describe('locked', () => {
      it('should create error for locked worktree', () => {
        const error = WorktreeError.locked('/test/path');

        expect(error.code).toBe('WORKTREE_LOCKED');
        expect(error.message).toBe('Worktree at /test/path is locked');
        expect(error.context.path).toBe('/test/path');
      });

      it('should include lock file path if provided', () => {
        const error = WorktreeError.locked('/test/path', '/test/path/.git/worktrees/branch/locked');

        expect(error.code).toBe('WORKTREE_LOCKED');
        expect(error.context.path).toBe('/test/path');
        expect(error.context.lockFile).toBe('/test/path/.git/worktrees/branch/locked');
      });

      it('should work without lock file', () => {
        const error = WorktreeError.locked('/test/path');

        expect(error.context.lockFile).toBeUndefined();
      });
    });

    describe('dirty', () => {
      it('should create error for dirty worktree', () => {
        const files = ['file1.ts', 'file2.ts'];
        const error = WorktreeError.dirty('/test/path', files);

        expect(error.code).toBe('WORKTREE_DIRTY');
        expect(error.message).toBe('Worktree at /test/path has uncommitted changes');
        expect(error.context.path).toBe('/test/path');
        expect(error.context.uncommittedFiles).toEqual(files);
      });

      it('should freeze uncommitted files array', () => {
        const files = ['file1.ts'];
        const error = WorktreeError.dirty('/test/path', files);

        expect(Object.isFrozen(error.context.uncommittedFiles)).toBe(true);
      });

      it('should handle empty uncommitted files', () => {
        const error = WorktreeError.dirty('/test/path', []);

        expect(error.context.uncommittedFiles).toEqual([]);
      });

      it('should handle multiple uncommitted files', () => {
        const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts'];
        const error = WorktreeError.dirty('/test/path', files);

        expect(error.context.uncommittedFiles).toEqual(files);
        expect(error.context.uncommittedFiles).toHaveLength(4);
      });
    });

    describe('gitError', () => {
      it('should create error for git command failure', () => {
        const error = WorktreeError.gitError('Git command failed', 'git worktree add');

        expect(error.code).toBe('WORKTREE_GIT_ERROR');
        expect(error.message).toBe('Git command failed');
        expect(error.context.gitCommand).toBe('git worktree add');
      });

      it('should include git stderr', () => {
        const error = WorktreeError.gitError('Error', 'git command', 'stderr output');

        expect(error.context.gitStderr).toBe('stderr output');
      });

      it('should include git exit code', () => {
        const error = WorktreeError.gitError('Error', 'git command', 'stderr', 128);

        expect(error.context.gitExitCode).toBe(128);
      });

      it('should include cause', () => {
        const cause = new Error('Original error');
        const error = WorktreeError.gitError('Error', 'git command', undefined, undefined, cause);

        expect(error.cause).toBe(cause);
      });

      it('should work with all parameters', () => {
        const cause = new Error('Original');
        const error = WorktreeError.gitError('Failed', 'git worktree add', 'error output', 1, cause);

        expect(error.message).toBe('Failed');
        expect(error.context.gitCommand).toBe('git worktree add');
        expect(error.context.gitStderr).toBe('error output');
        expect(error.context.gitExitCode).toBe(1);
        expect(error.cause).toBe(cause);
      });

      it('should work with minimal parameters', () => {
        const error = WorktreeError.gitError('Failed', 'git command');

        expect(error.context.gitStderr).toBeUndefined();
        expect(error.context.gitExitCode).toBeUndefined();
        expect(error.cause).toBeUndefined();
      });
    });

    describe('pathInvalid', () => {
      it('should create error for invalid path', () => {
        const error = WorktreeError.pathInvalid('/test/path', 'path does not exist');

        expect(error.code).toBe('WORKTREE_PATH_INVALID');
        expect(error.message).toBe('Invalid worktree path /test/path: path does not exist');
        expect(error.context.path).toBe('/test/path');
      });

      it('should handle various invalid reasons', () => {
        const reasons = ['not absolute', 'contains invalid chars', 'too long'];
        for (const reason of reasons) {
          const error = WorktreeError.pathInvalid('/test/path', reason);
          expect(error.message).toContain(reason);
        }
      });
    });
  });

  describe('canRetryAfterUnlock getter', () => {
    it('should return true for WORKTREE_LOCKED', () => {
      const error = WorktreeError.locked('/test/path');

      expect(error.canRetryAfterUnlock).toBe(true);
    });

    it('should return false for other error codes', () => {
      const codes: Array<{
        code: 'WORKTREE_NOT_FOUND' | 'WORKTREE_DIRTY' | 'WORKTREE_ALREADY_EXISTS';
        factory: () => WorktreeError;
      }> = [
        { code: 'WORKTREE_NOT_FOUND', factory: () => WorktreeError.notFound('/test') },
        { code: 'WORKTREE_DIRTY', factory: () => WorktreeError.dirty('/test', []) },
        {
          code: 'WORKTREE_ALREADY_EXISTS',
          factory: () => WorktreeError.alreadyExists('/test'),
        },
      ];

      for (const { code, factory } of codes) {
        const error = factory();
        expect(error.canRetryAfterUnlock).toBe(false);
        expect(error.code).toBe(code);
      }
    });
  });

  describe('needsCleanup getter', () => {
    it('should return true for WORKTREE_DIRTY', () => {
      const error = WorktreeError.dirty('/test/path', ['file.ts']);

      expect(error.needsCleanup).toBe(true);
    });

    it('should return true for WORKTREE_ALREADY_EXISTS', () => {
      const error = WorktreeError.alreadyExists('/test/path');

      expect(error.needsCleanup).toBe(true);
    });

    it('should return false for other error codes', () => {
      const codes: Array<{
        code: 'WORKTREE_NOT_FOUND' | 'WORKTREE_LOCKED';
        factory: () => WorktreeError;
      }> = [
        { code: 'WORKTREE_NOT_FOUND', factory: () => WorktreeError.notFound('/test') },
        { code: 'WORKTREE_LOCKED', factory: () => WorktreeError.locked('/test') },
      ];

      for (const { code, factory } of codes) {
        const error = factory();
        expect(error.needsCleanup).toBe(false);
        expect(error.code).toBe(code);
      }
    });
  });

  describe('error properties', () => {
    it('should have timestamp', () => {
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test');

      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should have stack trace', () => {
      const error = new WorktreeError('WORKTREE_NOT_FOUND', 'Test');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should support instanceof checks', () => {
      const error = WorktreeError.notFound('/test/path');

      expect(error instanceof WorktreeError).toBe(true);
      expect(error instanceof AutofixError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('context immutability', () => {
    it('should not allow modification of path', () => {
      const error = WorktreeError.notFound('/test/path');

      expect(() => {
        (error.context as { path: string }).path = '/new/path';
      }).toThrow();
    });

    it('should not allow modification of branch', () => {
      const error = WorktreeError.createFailed('/test', 'old-branch', 'reason');

      expect(() => {
        (error.context as { branch: string }).branch = 'new-branch';
      }).toThrow();
    });

    it('should not allow modification of uncommittedFiles array', () => {
      const error = WorktreeError.dirty('/test', ['file1.ts']);

      expect(() => {
        (error.context.uncommittedFiles as string[]).push('file2.ts');
      }).toThrow();
    });
  });
});
