/**
 * @module workflow/group-issues/__tests__/grouper.test
 * @description Grouper 테스트
 */

import { describe, it, expect } from 'vitest';
import { groupByComponent, groupByFile, groupByLabel } from '../grouper.js';
import type { Issue } from '../../../common/types/index.js';

describe('grouper', () => {
  const createMockIssue = (
    number: number,
    overrides: Partial<Issue> = {}
  ): Issue => ({
    number,
    title: `Issue #${number}`,
    body: '',
    state: 'open',
    type: 'bug',
    labels: [],
    assignees: [],
    context: {
      component: '',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: `https://github.com/owner/repo/issues/${number}`,
    ...overrides,
  });

  describe('groupByComponent', () => {
    it('should group issues by component', () => {
      const issues = [
        createMockIssue(1, {
          context: {
            component: 'Button',
            priority: 'high',
            relatedFiles: [],
            relatedSymbols: [],
            source: 'github',
          },
        }),
        createMockIssue(2, {
          context: {
            component: 'Button',
            priority: 'medium',
            relatedFiles: [],
            relatedSymbols: [],
            source: 'github',
          },
        }),
        createMockIssue(3, {
          context: {
            component: 'Header',
            priority: 'low',
            relatedFiles: [],
            relatedSymbols: [],
            source: 'github',
          },
        }),
      ];

      const groups = groupByComponent(issues);

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.key === 'Button')?.issues).toHaveLength(2);
      expect(groups.find(g => g.key === 'Header')?.issues).toHaveLength(1);
    });

    it('should handle uncategorized issues', () => {
      const issues = [
        createMockIssue(1),
        createMockIssue(2),
      ];

      const groups = groupByComponent(issues);

      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('uncategorized');
      expect(groups[0].issues).toHaveLength(2);
    });

    it('should set highest priority', () => {
      const issues = [
        createMockIssue(1, {
          context: {
            component: 'Button',
            priority: 'low',
            relatedFiles: [],
            relatedSymbols: [],
            source: 'github',
          },
        }),
        createMockIssue(2, {
          context: {
            component: 'Button',
            priority: 'critical',
            relatedFiles: [],
            relatedSymbols: [],
            source: 'github',
          },
        }),
        createMockIssue(3, {
          context: {
            component: 'Button',
            priority: 'high',
            relatedFiles: [],
            relatedSymbols: [],
            source: 'github',
          },
        }),
      ];

      const groups = groupByComponent(issues);

      expect(groups[0].priority).toBe('critical');
    });

    it('should collect all related files', () => {
      const issues = [
        createMockIssue(1, {
          context: {
            component: 'Button',
            priority: 'medium',
            relatedFiles: ['src/Button.tsx'],
            relatedSymbols: [],
            source: 'github',
          },
        }),
        createMockIssue(2, {
          context: {
            component: 'Button',
            priority: 'medium',
            relatedFiles: ['src/Button.test.tsx'],
            relatedSymbols: [],
            source: 'github',
          },
        }),
      ];

      const groups = groupByComponent(issues);

      expect(groups[0].relatedFiles).toContain('src/Button.tsx');
      expect(groups[0].relatedFiles).toContain('src/Button.test.tsx');
    });
  });

  describe('groupByFile', () => {
    it('should group issues by file', () => {
      const issues = [
        createMockIssue(1, {
          codeAnalysis: {
            filePath: 'src/components/Button/Button.tsx',
          },
        }),
        createMockIssue(2, {
          codeAnalysis: {
            filePath: 'src/components/Button/Button.tsx',
          },
        }),
        createMockIssue(3, {
          codeAnalysis: {
            filePath: 'src/components/Header/Header.tsx',
          },
        }),
      ];

      const groups = groupByFile(issues);

      expect(groups.length).toBeGreaterThanOrEqual(2);
      const buttonGroup = groups.find(g => g.key.includes('Button'));
      expect(buttonGroup?.issues).toHaveLength(2);
    });

    it('should handle issues without files', () => {
      const issues = [createMockIssue(1)];

      const groups = groupByFile(issues);

      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('uncategorized');
    });
  });

  describe('groupByLabel', () => {
    it('should group issues by label', () => {
      const issues = [
        createMockIssue(1, { labels: ['bug', 'priority:high'] }),
        createMockIssue(2, { labels: ['bug', 'priority:low'] }),
        createMockIssue(3, { labels: ['feature', 'priority:medium'] }),
      ];

      const groups = groupByLabel(issues);

      expect(groups.length).toBeGreaterThanOrEqual(2);
      const bugGroup = groups.find(g => g.key === 'bug');
      expect(bugGroup?.issues).toHaveLength(2);
    });

    it('should handle issues without labels', () => {
      const issues = [createMockIssue(1)];

      const groups = groupByLabel(issues);

      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('uncategorized');
    });

    it('should use first label as primary', () => {
      const issues = [
        createMockIssue(1, { labels: ['bug', 'urgent'] }),
        createMockIssue(2, { labels: ['bug', 'low'] }),
      ];

      const groups = groupByLabel(issues);

      const bugGroup = groups.find(g => g.key === 'bug');
      expect(bugGroup?.issues).toHaveLength(2);
    });
  });
});
