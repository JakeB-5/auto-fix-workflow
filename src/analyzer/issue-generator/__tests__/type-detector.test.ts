/**
 * @module analyzer/issue-generator/__tests__/type-detector
 * @description Tests for issue type detection
 */

import { describe, it, expect } from 'vitest';
import { detectIssueType, type TaskData } from '../type-detector.js';

describe('analyzer/issue-generator/type-detector', () => {
  describe('detectIssueType', () => {
    describe('sentry source', () => {
      it('should always return bug for sentry errors', () => {
        const task: TaskData = {
          source: 'sentry',
          description: 'Add new feature',
          title: 'New feature request',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should return bug even with feature keywords', () => {
        const task: TaskData = {
          source: 'sentry',
          description: 'Implement new API endpoint',
        };
        expect(detectIssueType(task)).toBe('bug');
      });
    });

    describe('error patterns', () => {
      it('should detect bug from error message', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Something went wrong',
          errorMessage: 'NullPointerException',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from stack trace', () => {
        const task: TaskData = {
          source: 'github',
          description: 'Application crashes',
          stackTrace: 'at processUser (/src/user.ts:42:15)',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from "error" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Error when submitting form',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from "exception" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Unhandled exception in login',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from "fail" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Login fails with valid credentials',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from "crash" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'App crashes on startup',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from "bug" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Bug in user profile',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should detect bug from "broken" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Broken link on homepage',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should be case-insensitive for error detection', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'ERROR in authentication',
        };
        expect(detectIssueType(task)).toBe('bug');
      });
    });

    describe('feature patterns', () => {
      it('should detect feature from "feature" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'New feature for user dashboard',
        };
        expect(detectIssueType(task)).toBe('feature');
      });

      it('should detect feature from "add" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Add export functionality',
        };
        expect(detectIssueType(task)).toBe('feature');
      });

      it('should detect feature from "implement" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Implement search bar',
        };
        expect(detectIssueType(task)).toBe('feature');
      });

      it('should detect feature from "create" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Create new API endpoint',
        };
        expect(detectIssueType(task)).toBe('feature');
      });

      it('should detect feature from "new" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'New payment integration',
        };
        expect(detectIssueType(task)).toBe('feature');
      });

      it('should use title when description is empty', () => {
        const task: TaskData = {
          source: 'asana',
          description: '',
          title: 'Add new feature',
        };
        expect(detectIssueType(task)).toBe('feature');
      });
    });

    describe('refactor patterns', () => {
      it('should detect refactor from "refactor" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Refactor authentication module',
        };
        expect(detectIssueType(task)).toBe('refactor');
      });

      it('should detect refactor from "restructure" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Restructure project layout',
        };
        expect(detectIssueType(task)).toBe('refactor');
      });

      it('should detect refactor from "reorganize" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Reorganize components',
        };
        expect(detectIssueType(task)).toBe('refactor');
      });

      it('should detect refactor from "clean up" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Clean up legacy code',
        };
        expect(detectIssueType(task)).toBe('refactor');
      });
    });

    describe('documentation patterns', () => {
      it('should detect docs from "document" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Document API endpoints',
        };
        expect(detectIssueType(task)).toBe('docs');
      });

      it('should detect docs from "doc" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Update doc for installation',
        };
        expect(detectIssueType(task)).toBe('docs');
      });

      it('should detect docs from "readme" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Update README with examples',
        };
        expect(detectIssueType(task)).toBe('docs');
      });

      it('should detect docs from "comment" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Write comments to complex functions',
        };
        expect(detectIssueType(task)).toBe('docs');
      });

      it('should detect docs from "explanation" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Write explanation for architecture',
        };
        expect(detectIssueType(task)).toBe('docs');
      });
    });

    describe('test patterns', () => {
      it('should detect test from "test" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Write tests for user service',
        };
        expect(detectIssueType(task)).toBe('test');
      });

      it('should detect test from "spec" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Write spec for API',
        };
        expect(detectIssueType(task)).toBe('test');
      });

      it('should detect test from "testing" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Improve testing coverage',
        };
        expect(detectIssueType(task)).toBe('test');
      });

      it('should detect test from "coverage" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Increase code coverage to 90%',
        };
        expect(detectIssueType(task)).toBe('test');
      });
    });

    describe('chore patterns', () => {
      it('should detect chore from "chore" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Chore: update dependencies',
        };
        expect(detectIssueType(task)).toBe('chore');
      });

      it('should detect chore from "config" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Update config files',
        };
        expect(detectIssueType(task)).toBe('chore');
      });

      it('should detect chore from "setup" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Setup CI/CD pipeline',
        };
        expect(detectIssueType(task)).toBe('chore');
      });

      it('should detect chore from "build" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Fix build script',
        };
        expect(detectIssueType(task)).toBe('chore');
      });

      it('should detect chore from "dependency" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Update dependency versions',
        };
        expect(detectIssueType(task)).toBe('chore');
      });

      it('should detect chore from "deps" keyword', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Bump deps version',
        };
        expect(detectIssueType(task)).toBe('chore');
      });
    });

    describe('default behavior', () => {
      it('should default to bug for unclear tasks', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Something needs attention',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should default to bug for empty description', () => {
        const task: TaskData = {
          source: 'asana',
          description: '',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should handle undefined optional fields', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Task description',
        };
        expect(detectIssueType(task)).toBe('bug');
      });
    });

    describe('priority ordering', () => {
      it('should prioritize error over feature', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Add new feature but it errors out',
          errorMessage: 'TypeError',
        };
        expect(detectIssueType(task)).toBe('bug');
      });

      it('should prioritize feature over refactor', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Add feature and refactor code',
        };
        expect(detectIssueType(task)).toBe('feature');
      });

      it('should prioritize refactor over docs', () => {
        const task: TaskData = {
          source: 'asana',
          description: 'Refactor and document the code',
        };
        expect(detectIssueType(task)).toBe('refactor');
      });
    });
  });
});
