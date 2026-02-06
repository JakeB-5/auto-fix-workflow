/**
 * @module workflow/code-fix-strategy/__tests__/pr-creator
 * @description Tests for PR creation logic
 */

import { describe, it, expect } from 'vitest';
import { createPRParams, formatPR } from '../pr-creator.js';
import type {
  IssueGroup,
  Issue,
  PullRequest,
} from '../../../common/types/index.js';
import type { FileChange } from '../types.js';

/**
 * Helper to create a minimal Issue
 */
function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    number: 1,
    title: 'Fix login bug',
    body: 'Login fails on mobile',
    state: 'open',
    type: 'bug',
    labels: ['bug'],
    assignees: [],
    context: {
      component: 'auth',
      priority: 'high',
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
    priority: 'high',
    ...overrides,
  };
}

/**
 * Helper to create a FileChange
 */
function createChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    path: 'src/auth.ts',
    type: 'modified',
    additions: 10,
    deletions: 3,
    ...overrides,
  };
}

describe('pr-creator', () => {
  describe('createPRParams', () => {
    it('should create basic PR params for single issue', () => {
      const group = createGroup();
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.title).toBeDefined();
      expect(params.body).toBeDefined();
      expect(params.headBranch).toBe('fix/issue-1');
      expect(params.baseBranch).toBe('main');
      expect(params.linkedIssues).toEqual([1]);
      expect(params.draft).toBe(false);
    });

    it('should use "fix" type for bug issues', () => {
      const group = createGroup({
        issues: [createIssue({ type: 'bug' })],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.title).toMatch(/^fix:/);
    });

    it('should use actual type for non-bug issues', () => {
      const group = createGroup({
        issues: [createIssue({ type: 'feature' })],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.title).toMatch(/^feature:/);
    });

    it('should use most common type for mixed issues', () => {
      const group = createGroup({
        issues: [
          createIssue({ number: 1, type: 'bug' }),
          createIssue({ number: 2, type: 'bug' }),
          createIssue({ number: 3, type: 'feature' }),
        ],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.title).toMatch(/^fix:/);
    });

    it('should include issue title for single issue description', () => {
      const group = createGroup({
        issues: [createIssue({ title: 'Fix login redirect' })],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.title).toContain('Fix login redirect');
    });

    it('should include group name and count for multiple issues', () => {
      const group = createGroup({
        name: 'Auth module fixes',
        issues: [
          createIssue({ number: 1 }),
          createIssue({ number: 2 }),
        ],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.title).toContain('Auth module fixes');
      expect(params.title).toContain('2 issues');
    });

    it('should link all issues', () => {
      const group = createGroup({
        issues: [
          createIssue({ number: 10 }),
          createIssue({ number: 20 }),
          createIssue({ number: 30 }),
        ],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.linkedIssues).toEqual([10, 20, 30]);
    });

    it('should include automated-fix label', () => {
      const group = createGroup();
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.labels).toContain('automated-fix');
    });

    it('should include priority label', () => {
      const group = createGroup({ priority: 'critical' });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.labels).toContain('priority:critical');
    });

    it('should include issue labels', () => {
      const group = createGroup({
        issues: [
          createIssue({ labels: ['frontend', 'urgent'] }),
        ],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.labels).toContain('frontend');
      expect(params.labels).toContain('urgent');
    });

    it('should deduplicate labels', () => {
      const group = createGroup({
        issues: [
          createIssue({ labels: ['bug', 'frontend'] }),
          createIssue({ labels: ['bug', 'backend'] }),
        ],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      const bugCount = params.labels?.filter((l) => l === 'bug').length ?? 0;
      expect(bugCount).toBe(1);
    });

    it('should generate PR body with summary section', () => {
      const group = createGroup();
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('## Summary');
      expect(params.body).toContain('Auth fixes');
    });

    it('should include component information in body', () => {
      const group = createGroup({ components: ['auth', 'session'] });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('auth');
      expect(params.body).toContain('session');
    });

    it('should include priority in body', () => {
      const group = createGroup({ priority: 'high' });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('high');
    });

    it('should generate issues list in body', () => {
      const group = createGroup({
        issues: [createIssue({ number: 42, title: 'Fix redirect' })],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('## Issues Fixed');
      expect(params.body).toContain('Fixes #42');
      expect(params.body).toContain('Fix redirect');
    });

    it('should include acceptance criteria in issues list', () => {
      const group = createGroup({
        issues: [
          createIssue({
            acceptanceCriteria: [
              { description: 'Login works on mobile', completed: true },
              { description: 'Error message shown', completed: false },
            ],
          }),
        ],
      });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('[x] Login works on mobile');
      expect(params.body).toContain('[ ] Error message shown');
    });

    it('should generate changes summary in body', () => {
      const changes = [
        createChange({ path: 'src/a.ts', type: 'added', additions: 20, deletions: 0 }),
        createChange({ path: 'src/b.ts', type: 'modified', additions: 5, deletions: 3 }),
        createChange({ path: 'src/c.ts', type: 'deleted', additions: 0, deletions: 15 }),
      ];
      const group = createGroup();

      const params = createPRParams(group, changes);

      expect(params.body).toContain('## Changes');
      expect(params.body).toContain('3 file(s) changed');
      expect(params.body).toContain('1 added');
      expect(params.body).toContain('1 modified');
      expect(params.body).toContain('1 deleted');
      expect(params.body).toContain('+25');
      expect(params.body).toContain('-18');
    });

    it('should include changed files list with icons', () => {
      const changes = [
        createChange({ path: 'src/new.ts', type: 'added', additions: 10, deletions: 0 }),
        createChange({ path: 'src/old.ts', type: 'modified', additions: 2, deletions: 1 }),
      ];
      const group = createGroup();

      const params = createPRParams(group, changes);

      expect(params.body).toContain('`src/new.ts`');
      expect(params.body).toContain('`src/old.ts`');
    });

    it('should include verification checklist', () => {
      const group = createGroup();
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('## Verification Checklist');
      expect(params.body).toContain('[x] Tests pass');
      expect(params.body).toContain('[x] Type checks pass');
      expect(params.body).toContain('[x] Linting passes');
      expect(params.body).toContain('[x] No forbidden patterns detected');
    });

    it('should include footer', () => {
      const group = createGroup();
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      expect(params.body).toContain('Auto-generated by auto-fix-workflow');
    });

    it('should handle empty changes', () => {
      const group = createGroup();

      const params = createPRParams(group, []);

      expect(params.body).toContain('0 file(s) changed');
      expect(params.body).toContain('+0');
      expect(params.body).toContain('-0');
    });

    it('should handle empty components', () => {
      const group = createGroup({ components: [] });
      const changes = [createChange()];

      const params = createPRParams(group, changes);

      // Should not crash, just no component line
      expect(params.body).toBeDefined();
    });
  });

  describe('formatPR', () => {
    it('should format PR for display', () => {
      const pr: PullRequest = {
        number: 42,
        title: 'fix: resolve login bug',
        body: 'PR body here',
        state: 'open',
        headBranch: 'fix/issue-1',
        baseBranch: 'main',
        linkedIssues: [1, 2],
        labels: ['automated-fix'],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/pull/42',
        changedFiles: 3,
        additions: 25,
        deletions: 10,
      };

      const formatted = formatPR(pr);

      expect(formatted).toContain('PR #42');
      expect(formatted).toContain('fix: resolve login bug');
      expect(formatted).toContain('Status: open');
      expect(formatted).toContain('fix/issue-1 -> main');
      expect(formatted).toContain('https://github.com/owner/repo/pull/42');
      expect(formatted).toContain('3 files');
      expect(formatted).toContain('+25');
      expect(formatted).toContain('-10');
      expect(formatted).toContain('1, 2');
    });

    it('should not show linked issues when empty', () => {
      const pr: PullRequest = {
        number: 1,
        title: 'chore: cleanup',
        body: '',
        state: 'draft',
        headBranch: 'chore/cleanup',
        baseBranch: 'main',
        linkedIssues: [],
        labels: [],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/pull/1',
        changedFiles: 1,
        additions: 0,
        deletions: 5,
      };

      const formatted = formatPR(pr);

      expect(formatted).not.toContain('Linked Issues');
    });

    it('should show correct state', () => {
      const pr: PullRequest = {
        number: 5,
        title: 'feat: add feature',
        body: '',
        state: 'merged',
        headBranch: 'feat/new',
        baseBranch: 'main',
        linkedIssues: [],
        labels: [],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/owner/repo/pull/5',
        changedFiles: 2,
        additions: 100,
        deletions: 0,
      };

      const formatted = formatPR(pr);

      expect(formatted).toContain('Status: merged');
    });
  });
});
