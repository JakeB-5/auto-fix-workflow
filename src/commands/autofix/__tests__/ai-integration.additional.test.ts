/**
 * @module commands/autofix/__tests__/ai-integration.additional.test
 * @description Additional AI integration tests for uncovered methods
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AIIntegration,
  createAIIntegration,
  getBudgetTracker,
  type AIConfig,
} from '../ai-integration.js';
import type { Issue, IssueGroup } from '../../../common/types/index.js';
import type { AIAnalysisResult } from '../types.js';

// Mock child_process for safeInvokeClaude
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock data
const mockIssue: Issue = {
  number: 123,
  title: 'Test Bug',
  body: 'This is a test bug description',
  state: 'open' as const,
  type: 'bug' as const,
  labels: ['bug'],
  assignees: [],
  context: {
    component: 'test-component',
    priority: 'high' as const,
    relatedFiles: ['src/test.ts'],
    relatedSymbols: [],
    source: 'github' as const,
  },
  acceptanceCriteria: [],
  relatedIssues: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  url: 'https://github.com/test/repo/issues/123',
};

const mockGroup: IssueGroup = {
  id: 'grp-1',
  name: 'Test Group',
  groupBy: 'component',
  key: 'test-component',
  issues: [mockIssue],
  branchName: 'fix/issue-123',
  relatedFiles: ['src/test.ts'],
  components: ['test-component'],
  priority: 'high',
};

describe('AIIntegration - additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyzeAsanaTask', () => {
    it('should return fallback analysis when CLI fails', async () => {
      // Mock safeInvokeClaude to return failure
      const ai = new AIIntegration({ preferredModel: 'opus' });

      // We can't easily mock safeInvokeClaude without module-level mocking,
      // but we test the fallback logic indirectly via the private method
      const fallback = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-1',
        name: 'Fix bug in auth module',
        notes: 'There is a critical bug',
        permalinkUrl: 'https://asana.com/task/1',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });

      expect(fallback.issueType).toBe('bug');
      expect(fallback.confidence).toBe(0.3);
      expect(fallback.component).toBe('general');
    });

    it('should classify feature tasks correctly in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-2',
        name: 'Add new feature for dashboard',
        notes: 'Implement new dashboard widget',
        permalinkUrl: 'https://asana.com/task/2',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.issueType).toBe('feature');
    });

    it('should classify refactor tasks correctly in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-3',
        name: 'Refactor authentication flow',
        notes: '',
        permalinkUrl: 'https://asana.com/task/3',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.issueType).toBe('refactor');
    });

    it('should classify docs tasks correctly in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-4',
        name: 'Update documentation for API',
        notes: '',
        permalinkUrl: 'https://asana.com/task/4',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.issueType).toBe('docs');
    });

    it('should classify test tasks correctly in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-5',
        name: 'Write test coverage for auth module',
        notes: '',
        permalinkUrl: 'https://asana.com/task/5',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.issueType).toBe('test');
    });

    it('should default to chore for unrecognized tasks', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-6',
        name: 'Update dependencies',
        notes: '',
        permalinkUrl: 'https://asana.com/task/6',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.issueType).toBe('chore');
    });

    it('should extract priority from custom fields in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-7',
        name: 'Some task',
        notes: '',
        permalinkUrl: 'https://asana.com/task/7',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
        customFields: [
          {
            gid: 'f1',
            name: 'Priority',
            type: 'enum',
            enumValue: { gid: 'e1', name: 'Critical' },
          },
        ],
      });
      expect(result.priority).toBe('critical');
    });

    it('should extract high priority from custom fields', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-8',
        name: 'Some task',
        notes: '',
        permalinkUrl: 'https://asana.com/task/8',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
        customFields: [
          {
            gid: 'f1',
            name: 'Priority',
            type: 'enum',
            enumValue: { gid: 'e1', name: 'High' },
          },
        ],
      });
      expect(result.priority).toBe('high');
    });

    it('should extract low priority from custom fields', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-9',
        name: 'Some task',
        notes: '',
        permalinkUrl: 'https://asana.com/task/9',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
        customFields: [
          {
            gid: 'f1',
            name: 'Task Priority',
            type: 'enum',
            enumValue: { gid: 'e1', name: 'Low' },
          },
        ],
      });
      expect(result.priority).toBe('low');
    });

    it('should extract component from custom fields in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-10',
        name: 'Some task',
        notes: '',
        permalinkUrl: 'https://asana.com/task/10',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
        customFields: [
          {
            gid: 'f1',
            name: 'Component',
            type: 'enum',
            enumValue: { gid: 'e1', name: 'auth' },
          },
        ],
      });
      expect(result.component).toBe('auth');
    });

    it('should use textValue for component when no enumValue', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-11',
        name: 'Some task',
        notes: '',
        permalinkUrl: 'https://asana.com/task/11',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
        customFields: [
          {
            gid: 'f1',
            name: 'Component',
            type: 'text',
            textValue: 'payments',
          },
        ],
      });
      expect(result.component).toBe('payments');
    });

    it('should use task notes (truncated) as summary in fallback', () => {
      const ai = new AIIntegration();
      const longNotes = 'x'.repeat(600);
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-12',
        name: 'Task Name',
        notes: longNotes,
        permalinkUrl: 'https://asana.com/task/12',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.summary.length).toBe(500);
    });

    it('should use task name as summary when no notes', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-13',
        name: 'Task Name',
        notes: '',
        permalinkUrl: 'https://asana.com/task/13',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.summary).toBe('Task Name');
    });

    it('should include labels with issueType and priority in fallback', () => {
      const ai = new AIIntegration();
      const result = (ai as any).getFallbackTaskAnalysis({
        gid: 'task-14',
        name: 'Fix error',
        notes: '',
        permalinkUrl: 'https://asana.com/task/14',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });
      expect(result.labels).toContain('bug');
      expect(result.labels).toContain('priority:medium');
    });
  });

  describe('buildTaskAnalysisPrompt', () => {
    it('should build prompt with task details', () => {
      const ai = new AIIntegration();
      const prompt = (ai as any).buildTaskAnalysisPrompt({
        gid: 'task-1',
        name: 'Fix login',
        notes: 'Login is broken',
        permalinkUrl: 'https://asana.com/task/1',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
        tags: [{ gid: 't1', name: 'urgent' }],
        customFields: [{ gid: 'cf1', name: 'Priority', type: 'text', displayValue: 'High' }],
      });

      expect(prompt).toContain('Fix login');
      expect(prompt).toContain('Login is broken');
      expect(prompt).toContain('urgent');
      expect(prompt).toContain('Priority: High');
    });

    it('should handle missing optional fields', () => {
      const ai = new AIIntegration();
      const prompt = (ai as any).buildTaskAnalysisPrompt({
        gid: 'task-2',
        name: 'Task',
        notes: '',
        permalinkUrl: 'https://asana.com/task/2',
        createdAt: '2024-01-01',
        modifiedAt: '2024-01-01',
        completed: false,
      });

      expect(prompt).toContain('(no description)');
      expect(prompt).toContain('(none)');
    });
  });

  describe('generateCommitMessage', () => {
    it('should use component from first issue for single issue', () => {
      const ai = new AIIntegration();
      const msg = ai.generateCommitMessage(mockGroup);
      expect(msg).toContain('fix(test-component)');
      expect(msg).toContain('Test Bug');
      expect(msg).toContain('Fixes #123');
    });

    it('should handle multi-issue groups', () => {
      const ai = new AIIntegration();
      const multiGroup: IssueGroup = {
        ...mockGroup,
        issues: [mockIssue, { ...mockIssue, number: 456 }],
        components: ['auth'],
      };
      const msg = ai.generateCommitMessage(multiGroup);
      expect(msg).toContain('fix(auth)');
      expect(msg).toContain('address 2 issues');
      expect(msg).toContain('#123, #456');
    });

    it('should fall back to general when no components', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: [mockIssue, { ...mockIssue, number: 456 }],
        components: [],
      };
      const msg = ai.generateCommitMessage(group);
      expect(msg).toContain('fix(general)');
    });
  });

  describe('estimateComplexity', () => {
    it('should return low for single issue with few files', () => {
      const ai = new AIIntegration();
      expect(ai.estimateComplexity(mockGroup)).toBe('low');
    });

    it('should return medium for 2-3 issues with 3-5 files', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: [mockIssue, { ...mockIssue, number: 2 }],
        relatedFiles: ['a.ts', 'b.ts', 'c.ts'],
      };
      expect(ai.estimateComplexity(group)).toBe('medium');
    });

    it('should return high for many issues (>3)', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: Array.from({ length: 4 }, (_, i) => ({ ...mockIssue, number: i + 1 })),
        relatedFiles: ['a.ts'],
      };
      expect(ai.estimateComplexity(group)).toBe('high');
    });

    it('should return high for many files (>5)', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: [mockIssue],
        relatedFiles: Array.from({ length: 6 }, (_, i) => `file${i}.ts`),
      };
      expect(ai.estimateComplexity(group)).toBe('high');
    });
  });

  describe('canHandle', () => {
    it('should return true for valid group with budget', () => {
      const ai = new AIIntegration();
      expect(ai.canHandle(mockGroup)).toBe(true);
    });

    it('should return false for empty group', () => {
      const ai = new AIIntegration();
      expect(ai.canHandle({ ...mockGroup, issues: [] })).toBe(false);
    });

    it('should return false when budget exhausted', () => {
      const ai = new AIIntegration({
        maxBudgetPerIssue: 0.001,
        maxBudgetPerSession: 0.001,
      });
      const tracker = getBudgetTracker(ai);
      tracker.addCost(mockGroup.id, 0.002);
      expect(ai.canHandle(mockGroup)).toBe(false);
    });

    it('should return false for high complexity with >10 files', () => {
      const ai = new AIIntegration();
      const complexGroup: IssueGroup = {
        ...mockGroup,
        issues: Array.from({ length: 4 }, (_, i) => ({ ...mockIssue, number: i + 1 })),
        relatedFiles: Array.from({ length: 11 }, (_, i) => `f${i}.ts`),
      };
      expect(ai.canHandle(complexGroup)).toBe(false);
    });

    it('should return true for high complexity with <=10 files', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: Array.from({ length: 4 }, (_, i) => ({ ...mockIssue, number: i + 1 })),
        relatedFiles: Array.from({ length: 10 }, (_, i) => `f${i}.ts`),
      };
      expect(ai.canHandle(group)).toBe(true);
    });
  });

  describe('getSuggestedApproach', () => {
    it('should return approach string for low complexity', () => {
      const ai = new AIIntegration();
      const approach = ai.getSuggestedApproach(mockGroup);
      expect(approach).toContain('Simple fix');
      expect(approach).toContain('1 issue(s)');
    });

    it('should return approach string for medium complexity', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: [mockIssue, { ...mockIssue, number: 2 }],
        relatedFiles: ['a.ts', 'b.ts', 'c.ts'],
      };
      const approach = ai.getSuggestedApproach(group);
      expect(approach).toContain('Moderate complexity');
    });

    it('should return approach string for high complexity', () => {
      const ai = new AIIntegration();
      const group: IssueGroup = {
        ...mockGroup,
        issues: Array.from({ length: 4 }, (_, i) => ({ ...mockIssue, number: i + 1 })),
        relatedFiles: Array.from({ length: 6 }, (_, i) => `f${i}.ts`),
      };
      const approach = ai.getSuggestedApproach(group);
      expect(approach).toContain('Complex change');
    });
  });
});
