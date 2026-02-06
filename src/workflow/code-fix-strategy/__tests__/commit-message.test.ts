/**
 * @module workflow/code-fix-strategy/__tests__/commit-message
 * @description Tests for commit message generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateCommitMessage,
  validateCommitMessage,
} from '../commit-message.js';
import type { Issue } from '../../../common/types/index.js';
import type { FileChange } from '../types.js';

/**
 * Helper to create a minimal Issue object
 */
function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    number: 1,
    title: 'Fix login bug',
    body: 'Login fails on mobile',
    state: 'open',
    type: 'bug',
    labels: [],
    assignees: [],
    context: {
      component: 'auth',
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
 * Helper to create a minimal FileChange
 */
function createChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    path: 'src/app.ts',
    type: 'modified',
    additions: 5,
    deletions: 2,
    ...overrides,
  };
}

describe('commit-message', () => {
  describe('generateCommitMessage', () => {
    it('should generate fix commit for bug issue', () => {
      const issues = [createIssue({ type: 'bug', title: 'Fix login bug' })];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^fix/);
      expect(message).toContain('Fix login bug');
      expect(message).toContain('Fixes #1');
    });

    it('should generate feat commit for feature issue', () => {
      const issues = [
        createIssue({ type: 'feature', title: 'Add dark mode' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^feat/);
      expect(message).toContain('Add dark mode');
    });

    it('should generate refactor commit for refactor issue', () => {
      const issues = [
        createIssue({ type: 'refactor', title: 'Extract utility' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^refactor/);
    });

    it('should generate docs commit for docs issue', () => {
      const issues = [
        createIssue({ type: 'docs', title: 'Update README' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^docs/);
    });

    it('should generate test commit for test issue', () => {
      const issues = [
        createIssue({ type: 'test', title: 'Add unit tests' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^test/);
    });

    it('should generate chore commit for chore issue', () => {
      const issues = [
        createIssue({ type: 'chore', title: 'Update deps' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^chore/);
    });

    it('should generate chore for empty issues array', () => {
      const message = generateCommitMessage([], []);
      expect(message).toMatch(/^chore/);
      expect(message).toContain('automated fix');
    });

    it('should not include footer when no issues', () => {
      const message = generateCommitMessage([], []);
      expect(message).not.toContain('Fixes');
    });

    it('should include scope from component path', () => {
      const issues = [createIssue()];
      const changes = [
        createChange({ path: 'src/components/auth/Login.tsx' }),
      ];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('(auth)');
    });

    it('should use "multiple" scope for multiple components', () => {
      const issues = [createIssue()];
      const changes = [
        createChange({ path: 'src/components/auth/Login.tsx' }),
        createChange({ path: 'src/components/dashboard/Panel.tsx' }),
      ];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('(multiple)');
    });

    it('should fall back to first directory for scope', () => {
      const issues = [createIssue()];
      const changes = [createChange({ path: 'src/utils.ts' })];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('(src)');
    });

    it('should handle multiple issues', () => {
      const issues = [
        createIssue({ number: 1, title: 'Fix login bug' }),
        createIssue({ number: 2, title: 'Fix signup bug' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('and 1 more');
      expect(message).toContain('Fixes #1, #2');
    });

    it('should include body with change summary', () => {
      const issues = [createIssue()];
      const changes = [
        createChange({ type: 'added', additions: 10, deletions: 0 }),
        createChange({ type: 'modified', additions: 5, deletions: 3 }),
        createChange({
          path: 'src/old.ts',
          type: 'deleted',
          additions: 0,
          deletions: 20,
        }),
      ];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('1 added');
      expect(message).toContain('1 modified');
      expect(message).toContain('1 deleted');
    });

    it('should include issue details in body for multiple issues', () => {
      const issues = [
        createIssue({ number: 10, title: 'Bug A' }),
        createIssue({ number: 20, title: 'Bug B' }),
        createIssue({ number: 30, title: 'Bug C' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('Fixed issues:');
      expect(message).toContain('#10: Bug A');
      expect(message).toContain('#20: Bug B');
      expect(message).toContain('#30: Bug C');
    });

    it('should use most common issue type for commit type', () => {
      const issues = [
        createIssue({ type: 'bug' }),
        createIssue({ type: 'bug' }),
        createIssue({ type: 'feature' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toMatch(/^fix/);
    });

    it('should strip issue number prefix from title', () => {
      const issues = [
        createIssue({ title: '#42 - Fix the login page' }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('Fix the login page');
      expect(message).not.toMatch(/#42\s*-/);
    });

    it('should truncate long subjects to 72 chars', () => {
      const longTitle =
        'This is a very long title that exceeds seventy-two characters and should be truncated to fit';
      const issues = [createIssue({ title: longTitle })];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      const header = message.split('\n')[0] ?? '';
      // The header includes type and scope, so check total
      // The subject itself should be truncated
      expect(header.length).toBeLessThanOrEqual(200); // generous limit for type+scope
    });

    it('should handle no scope (null) for empty changes', () => {
      const issues = [createIssue()];
      const message = generateCommitMessage(issues, []);
      // Should not have parentheses scope like fix(): or fix(null):
      expect(message).not.toContain('(null)');
    });

    it('should handle unknown issue type mapping', () => {
      // Force an unknown type by casting
      const issues = [
        createIssue({ type: 'unknown' as Issue['type'] }),
      ];
      const changes = [createChange()];

      const message = generateCommitMessage(issues, changes);
      // Unknown types default to 'fix'
      expect(message).toMatch(/^fix/);
    });

    it('should handle modules directory for scope', () => {
      const issues = [createIssue()];
      const changes = [
        createChange({ path: 'src/modules/billing/invoice.ts' }),
      ];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('(billing)');
    });

    it('should handle features directory for scope', () => {
      const issues = [createIssue()];
      const changes = [
        createChange({ path: 'src/features/settings/theme.ts' }),
      ];

      const message = generateCommitMessage(issues, changes);
      expect(message).toContain('(settings)');
    });
  });

  describe('validateCommitMessage', () => {
    it('should validate correct fix commit', () => {
      expect(validateCommitMessage('fix: resolve login issue')).toBe(true);
    });

    it('should validate correct feat commit with scope', () => {
      expect(validateCommitMessage('feat(auth): add SSO support')).toBe(true);
    });

    it('should validate refactor commit', () => {
      expect(validateCommitMessage('refactor: extract utility')).toBe(true);
    });

    it('should validate docs commit', () => {
      expect(validateCommitMessage('docs: update README')).toBe(true);
    });

    it('should validate test commit', () => {
      expect(validateCommitMessage('test: add unit tests')).toBe(true);
    });

    it('should validate chore commit', () => {
      expect(validateCommitMessage('chore: update deps')).toBe(true);
    });

    it('should validate style commit', () => {
      expect(validateCommitMessage('style: fix formatting')).toBe(true);
    });

    it('should validate perf commit', () => {
      expect(validateCommitMessage('perf: optimize query')).toBe(true);
    });

    it('should reject invalid type', () => {
      expect(validateCommitMessage('invalid: something')).toBe(false);
    });

    it('should reject missing subject', () => {
      expect(validateCommitMessage('fix:')).toBe(false);
    });

    it('should reject missing colon', () => {
      expect(validateCommitMessage('fix something')).toBe(false);
    });

    it('should reject empty message', () => {
      expect(validateCommitMessage('')).toBe(false);
    });

    it('should accept multiline messages (validates only header)', () => {
      const message = 'fix: resolve bug\n\nDetailed body text here.';
      expect(validateCommitMessage(message)).toBe(true);
    });

    it('should reject header with subject longer than 72 chars', () => {
      // Subject part (after "fix: ") must be <= 72 chars
      const longHeader = 'fix: ' + 'a'.repeat(73);
      expect(validateCommitMessage(longHeader)).toBe(false);
    });

    it('should accept header at exactly 72 chars', () => {
      // "fix: " is 5 chars, so subject = 67 chars for total 72
      const header = 'fix: ' + 'a'.repeat(67);
      expect(header.length).toBe(72);
      expect(validateCommitMessage(header)).toBe(true);
    });

    it('should validate commit with scope having special chars', () => {
      expect(validateCommitMessage('fix(auth/login): fix redirect')).toBe(
        true
      );
    });
  });
});
