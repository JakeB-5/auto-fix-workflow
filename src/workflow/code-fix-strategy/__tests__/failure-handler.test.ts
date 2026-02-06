/**
 * @module workflow/code-fix-strategy/__tests__/failure-handler
 * @description Tests for failure handling
 */

import { describe, it, expect } from 'vitest';
import {
  handleFailure,
  createFailureLabels,
  isRecoverableFailure,
} from '../failure-handler.js';
import type { IssueGroup, Issue } from '../../../common/types/index.js';
import type { FixAttempt } from '../types.js';

/**
 * Helper to create a minimal Issue
 */
function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    number: 1,
    title: 'Fix bug',
    body: '',
    state: 'open',
    type: 'bug',
    labels: [],
    assignees: [],
    context: {
      component: 'core',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: 'https://github.com/owner/repo/issues/1',
    ...overrides,
  };
}

/**
 * Helper to create a minimal IssueGroup
 */
function createGroup(overrides: Partial<IssueGroup> = {}): IssueGroup {
  return {
    id: 'group-1',
    name: 'Auth fixes',
    groupBy: 'component',
    key: 'auth',
    issues: [createIssue()],
    branchName: 'fix/issue-1',
    relatedFiles: ['src/auth.ts'],
    components: ['auth'],
    priority: 'medium',
    ...overrides,
  };
}

/**
 * Helper to create a FixAttempt
 */
function createAttempt(overrides: Partial<FixAttempt> = {}): FixAttempt {
  return {
    attempt: 1,
    changes: [],
    checkResult: {
      passed: false,
      results: [
        {
          check: 'test',
          passed: false,
          status: 'failed',
          durationMs: 1000,
          error: 'Test failed',
        },
      ],
      attempt: 1,
      totalDurationMs: 1000,
    },
    success: false,
    timestamp: new Date(),
    ...overrides,
  };
}

describe('failure-handler', () => {
  describe('handleFailure', () => {
    it('should generate failure summary with single attempt', () => {
      const group = createGroup();
      const attempts = [createAttempt()];

      const summary = handleFailure(group, attempts);

      expect(summary.groupId).toBe('group-1');
      expect(summary.totalAttempts).toBe(1);
      expect(summary.reason).toBeDefined();
      expect(summary.failedChecks).toBeDefined();
      expect(summary.suggestions.length).toBeGreaterThan(0);
      expect(summary.issueComment).toBeDefined();
    });

    it('should generate failure summary with multiple attempts', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({ attempt: 1 }),
        createAttempt({ attempt: 2 }),
        createAttempt({ attempt: 3 }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.totalAttempts).toBe(3);
    });

    it('should determine primary reason from error field', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({ error: 'Compilation error in module X' }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.reason).toBe('Compilation error in module X');
    });

    it('should determine primary reason from failed checks', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
                error: 'Assertion error',
              },
            ],
            attempt: 1,
            totalDurationMs: 1000,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.reason).toContain('test');
      expect(summary.reason).toContain('failed');
    });

    it('should return "No attempts made" for empty attempts', () => {
      const group = createGroup();

      const summary = handleFailure(group, []);

      expect(summary.reason).toBe('No attempts made');
      expect(summary.totalAttempts).toBe(0);
    });

    it('should return "Unknown failure" when no checks failed', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
            ],
            attempt: 1,
            totalDurationMs: 1000,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.reason).toBe('Unknown failure');
    });

    it('should extract failed checks list', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
                error: 'Test assertion',
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
                error: 'Lint error',
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.failedChecks).toHaveLength(2);
      expect(summary.failedChecks[0]).toContain('test');
      expect(summary.failedChecks[1]).toContain('lint');
    });

    it('should use "Unknown error" for failed checks without error message', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
                // no error field
              },
            ],
            attempt: 1,
            totalDurationMs: 500,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.failedChecks[0]).toContain('Unknown error');
    });

    it('should suggest test-related fixes for test failures', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
            ],
            attempt: 1,
            totalDurationMs: 1000,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      const hasTestSuggestion = summary.suggestions.some((s) =>
        s.toLowerCase().includes('test')
      );
      expect(hasTestSuggestion).toBe(true);
    });

    it('should suggest type-related fixes for typecheck failures', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'typecheck',
                passed: false,
                status: 'failed',
                durationMs: 2000,
              },
            ],
            attempt: 1,
            totalDurationMs: 2000,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      const hasTypeSuggestion = summary.suggestions.some(
        (s) =>
          s.toLowerCase().includes('type') ||
          s.toLowerCase().includes('typescript')
      );
      expect(hasTypeSuggestion).toBe(true);
    });

    it('should suggest lint-related fixes for lint failures', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 500,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      const hasLintSuggestion = summary.suggestions.some((s) =>
        s.toLowerCase().includes('lint')
      );
      expect(hasLintSuggestion).toBe(true);
    });

    it('should suggest splitting for large groups (>3 issues)', () => {
      const group = createGroup({
        issues: [
          createIssue({ number: 1 }),
          createIssue({ number: 2 }),
          createIssue({ number: 3 }),
          createIssue({ number: 4 }),
        ],
      });
      const attempts = [createAttempt()];

      const summary = handleFailure(group, attempts);

      const hasSplitSuggestion = summary.suggestions.some((s) =>
        s.toLowerCase().includes('split')
      );
      expect(hasSplitSuggestion).toBe(true);
    });

    it('should always include general suggestions', () => {
      const group = createGroup();
      const attempts = [createAttempt()];

      const summary = handleFailure(group, attempts);

      const hasManualSuggestion = summary.suggestions.some((s) =>
        s.toLowerCase().includes('manual')
      );
      expect(hasManualSuggestion).toBe(true);
    });

    it('should format issueComment with markdown', () => {
      const group = createGroup();
      const attempts = [createAttempt()];

      const summary = handleFailure(group, attempts);

      expect(summary.issueComment).toContain('## Automated Fix Failed');
      expect(summary.issueComment).toContain('### Reason');
      expect(summary.issueComment).toContain('### Suggested Next Steps');
      expect(summary.issueComment).toContain('needs-manual-fix');
      expect(summary.issueComment).toContain('automated-fix-failed');
    });

    it('should include failed checks section in comment when there are failures', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
                error: 'Some test error',
              },
            ],
            attempt: 1,
            totalDurationMs: 1000,
          },
        }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.issueComment).toContain('### Failed Checks');
    });

    it('should include attempt count in comment', () => {
      const group = createGroup();
      const attempts = [
        createAttempt({ attempt: 1 }),
        createAttempt({ attempt: 2 }),
      ];

      const summary = handleFailure(group, attempts);

      expect(summary.issueComment).toContain('2 attempt(s)');
    });
  });

  describe('createFailureLabels', () => {
    it('should return standard failure labels', () => {
      const labels = createFailureLabels();

      expect(labels).toContain('needs-manual-fix');
      expect(labels).toContain('automated-fix-failed');
      expect(labels).toHaveLength(2);
    });
  });

  describe('isRecoverableFailure', () => {
    it('should return true for single attempt (less than 2)', () => {
      const attempts = [createAttempt()];

      expect(isRecoverableFailure(attempts)).toBe(true);
    });

    it('should return true for empty attempts', () => {
      expect(isRecoverableFailure([])).toBe(true);
    });

    it('should return true when showing improvement', () => {
      const attempts: FixAttempt[] = [
        createAttempt({
          attempt: 1,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
        }),
        createAttempt({
          attempt: 2,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 2,
            totalDurationMs: 1500,
          },
        }),
      ];

      expect(isRecoverableFailure(attempts)).toBe(true);
    });

    it('should return true when same number of checks pass', () => {
      const attempts: FixAttempt[] = [
        createAttempt({
          attempt: 1,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
        }),
        createAttempt({
          attempt: 2,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: true,
                status: 'passed',
                durationMs: 500,
              },
            ],
            attempt: 2,
            totalDurationMs: 1500,
          },
        }),
      ];

      // Same count of passed (1 each) => lastPassed >= prevPassed => true
      expect(isRecoverableFailure(attempts)).toBe(true);
    });

    it('should return false when regressing', () => {
      const attempts: FixAttempt[] = [
        createAttempt({
          attempt: 1,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: true,
                status: 'passed',
                durationMs: 500,
              },
              {
                check: 'typecheck',
                passed: false,
                status: 'failed',
                durationMs: 2000,
              },
            ],
            attempt: 1,
            totalDurationMs: 3500,
          },
        }),
        createAttempt({
          attempt: 2,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
              {
                check: 'typecheck',
                passed: false,
                status: 'failed',
                durationMs: 2000,
              },
            ],
            attempt: 2,
            totalDurationMs: 3500,
          },
        }),
      ];

      // Previous passed 2, last passed 0 => 0 < 2 => false
      expect(isRecoverableFailure(attempts)).toBe(false);
    });

    it('should only consider last two attempts', () => {
      const attempts: FixAttempt[] = [
        createAttempt({
          attempt: 1,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: true,
                status: 'passed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
        }),
        createAttempt({
          attempt: 2,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 2,
            totalDurationMs: 1500,
          },
        }),
        createAttempt({
          attempt: 3,
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 3,
            totalDurationMs: 1500,
          },
        }),
      ];

      // Last two: attempt 2 (0 passed) vs attempt 3 (1 passed) => 1 >= 0 => true
      expect(isRecoverableFailure(attempts)).toBe(true);
    });
  });
});
