/**
 * @module commands/autofix/__tests__/integration.test
 * @description Integration tests for autofix module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config, Issue, IssueGroup, GroupBy } from '../../../common/types/index.js';
import type { AutofixOptions } from '../types.js';

// Mock all external dependencies
vi.mock('../mcp-tools/github-issues.js', () => ({
  GitHubIssuesTool: vi.fn().mockImplementation(function() { return {
    fetchIssues: vi.fn().mockResolvedValue({
      success: true,
      data: {
        issues: [
          createMockIssue(1),
          createMockIssue(2),
          createMockIssue(3),
        ],
        totalCount: 3,
        hasMore: false,
      },
    }),
  }; }),
}));

vi.mock('../mcp-tools/worktree.js', () => ({
  WorktreeTool: vi.fn().mockImplementation(function() { return {
    create: vi.fn().mockResolvedValue({
      success: true,
      data: {
        path: '/test/worktree',
        branch: 'fix/test',
        status: 'ready',
        issueNumbers: [1],
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
    }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    // Return modified files for git status --porcelain to pass hasUncommittedChanges check
    execInWorktree: vi.fn().mockResolvedValue({ success: true, data: { stdout: 'M src/test.ts', stderr: '' } }),
  }; }),
}));

vi.mock('../mcp-tools/run-checks.js', () => ({
  RunChecksTool: vi.fn().mockImplementation(function() { return {
    runChecks: vi.fn().mockResolvedValue({
      success: true,
      data: {
        passed: true,
        results: [],
        attempt: 1,
        totalDurationMs: 100,
      },
    }),
  }; }),
}));

vi.mock('../mcp-tools/create-pr.js', () => ({
  CreatePRTool: vi.fn().mockImplementation(function() { return {
    createPRFromIssues: vi.fn().mockResolvedValue({
      success: true,
      data: {
        number: 100,
        title: 'fix: test',
        body: '',
        state: 'open',
        headBranch: 'fix/test',
        baseBranch: 'main',
        linkedIssues: [1],
        labels: [],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/repo/pull/100',
        changedFiles: 1,
        additions: 1,
        deletions: 0,
      },
    }),
  }; }),
}));

vi.mock('../mcp-tools/update-issue.js', () => ({
  UpdateIssueTool: vi.fn().mockImplementation(function() { return {
    markFixed: vi.fn().mockResolvedValue({ success: true }),
    markInProgress: vi.fn().mockResolvedValue({ success: true }),
    markFailed: vi.fn().mockResolvedValue({ success: true }),
  }; }),
}));

vi.mock('../ai-integration.js', () => ({
  AIIntegration: vi.fn().mockImplementation(function() { return {
    analyzeGroup: vi.fn().mockResolvedValue({
      success: true,
      data: {
        issues: [],
        filesToModify: [],
        rootCause: 'test root cause',
        suggestedFix: 'test fix',
        confidence: 0.9,
        complexity: 'low',
      },
    }),
    applyFix: vi.fn().mockResolvedValue({
      success: true,
      data: {
        filesModified: [],
        summary: 'test',
        success: true,
        commitMessage: 'fix: test',
      },
    }),
  }; }),
}));

// Helper to create mock issue
function createMockIssue(number: number): Issue {
  return {
    number,
    title: `Test Issue ${number}`,
    body: 'Test body',
    state: 'open',
    type: 'bug',
    labels: ['auto-fix', 'component:test'],
    assignees: [],
    context: {
      component: 'test',
      priority: 'medium',
      relatedFiles: [`src/test${number}.ts`],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: `https://github.com/test/repo/issues/${number}`,
  };
}

// Helper to create mock config
function createMockConfig(): Config {
  return {
    github: {
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
      defaultBranch: 'main',
      autoFixLabel: 'auto-fix',
    },
    asana: {
      token: 'test-token',
      workspaceGid: 'test-gid',
      projectGids: [],
    },
    worktree: {
      baseDir: '/tmp/worktrees',
      prefix: 'autofix-',
      maxConcurrent: 3,
    },
    checks: {},
  };
}

describe('Autofix Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('IssueFetcher', () => {
    it('should fetch and group issues', async () => {
      const { createFetcher } = await import('../fetcher.js');
      const config = createMockConfig();
      const fetcher = createFetcher(config);

      const options: AutofixOptions = {
        groupBy: 'component',
        maxParallel: 3,
        dryRun: false,
        maxRetries: 3,
      };

      const result = await fetcher.fetchAndGroup(options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issues.length).toBe(3);
        expect(result.data.groups.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GroupIssuesTool', () => {
    it('should group issues by component', async () => {
      const { GroupIssuesTool } = await import('../mcp-tools/group-issues.js');
      const tool = new GroupIssuesTool();

      const issues = [
        createMockIssue(1),
        createMockIssue(2),
        createMockIssue(3),
      ];

      const result = tool.groupIssues(issues, {
        issueNumbers: [1, 2, 3],
        groupBy: 'component',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groups.length).toBeGreaterThan(0);
        expect(result.data.totalIssues).toBe(3);
      }
    });

    it('should respect max group size', async () => {
      const { GroupIssuesTool } = await import('../mcp-tools/group-issues.js');
      const tool = new GroupIssuesTool();

      const issues = [
        createMockIssue(1),
        createMockIssue(2),
        createMockIssue(3),
        createMockIssue(4),
        createMockIssue(5),
      ];

      const result = tool.groupIssues(issues, {
        issueNumbers: [1, 2, 3, 4, 5],
        groupBy: 'component',
        maxGroupSize: 2,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // All groups should have at most 2 issues
        for (const group of result.data.groups) {
          expect(group.issues.length).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe('ProcessingQueue with Pipeline', () => {
    it('should process groups through queue and pipeline', async () => {
      const { createQueue } = await import('../queue.js');
      const { createPipeline } = await import('../pipeline.js');

      const config = createMockConfig();
      const queue = createQueue(2, 3);

      const groups: IssueGroup[] = [
        {
          id: 'g1',
          name: 'Group 1',
          groupBy: 'component' as GroupBy,
          key: 'test',
          issues: [createMockIssue(1)],
          branchName: 'fix/g1',
          relatedFiles: ['src/test1.ts'],
          components: ['test'],
          priority: 'medium',
        },
        {
          id: 'g2',
          name: 'Group 2',
          groupBy: 'component' as GroupBy,
          key: 'test',
          issues: [createMockIssue(2)],
          branchName: 'fix/g2',
          relatedFiles: ['src/test2.ts'],
          components: ['test'],
          priority: 'medium',
        },
      ];

      queue.enqueue(groups);

      queue.setProcessor(async (group) => {
        const pipeline = createPipeline({
          config,
          dryRun: false,
          maxRetries: 3,
          baseBranch: 'main',
          repoPath: '/test/repo',
        });
        return pipeline.processGroup(group);
      });

      vi.useFakeTimers();
      const resultsPromise = queue.start();
      await vi.runAllTimersAsync();
      vi.useRealTimers();

      const results = await resultsPromise;

      expect(results.length).toBe(2);
      expect(results.every(r => r.status === 'completed')).toBe(true);
    });
  });

  describe('Progress Reporter', () => {
    it('should track progress through processing', async () => {
      const { createProgressReporter } = await import('../progress.js');
      const { createQueue } = await import('../queue.js');

      const reporter = createProgressReporter({ verbose: false });
      const queue = createQueue(1, 1);

      const events: string[] = [];
      reporter.on(event => events.push(event.type));

      const groups: IssueGroup[] = [
        {
          id: 'g1',
          name: 'Group 1',
          groupBy: 'component' as GroupBy,
          key: 'test',
          issues: [createMockIssue(1)],
          branchName: 'fix/g1',
          relatedFiles: [],
          components: ['test'],
          priority: 'medium',
        },
      ];

      reporter.start(groups);
      reporter.groupStart('g1');
      reporter.groupStage('g1', 'worktree_create');
      reporter.groupStage('g1', 'checks');
      reporter.groupComplete('g1', {
        group: groups[0]!,
        status: 'completed',
        attempts: 1,
        durationMs: 100,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      expect(events).toContain('start');
      expect(events).toContain('group_start');
      expect(events).toContain('group_stage');
      expect(events).toContain('group_complete');
    });
  });

  describe('Dry Run', () => {
    it('should simulate operations without changes', async () => {
      const { executeDryRun } = await import('../dry-run.js');

      const config = createMockConfig();
      const options: AutofixOptions = {
        groupBy: 'component',
        maxParallel: 3,
        dryRun: true,
        maxRetries: 3,
      };

      const groups: IssueGroup[] = [
        {
          id: 'g1',
          name: 'Group 1',
          groupBy: 'component' as GroupBy,
          key: 'test',
          issues: [createMockIssue(1)],
          branchName: 'fix/g1',
          relatedFiles: ['src/test.ts'],
          components: ['test'],
          priority: 'medium',
        },
      ];

      const { result, preview } = executeDryRun(groups, config, options);

      expect(result.dryRun).toBe(true);
      expect(preview).toContain('DRY-RUN PREVIEW');
      expect(preview).toContain('Group 1');
      expect(preview).toContain('WORKTREE');
      expect(preview).toContain('PR');
    });
  });

  describe('Report Generation', () => {
    it('should generate text report', async () => {
      const { createReportGenerator, createAutofixResult } = await import('../report.js');

      const groups: IssueGroup[] = [
        {
          id: 'g1',
          name: 'Group 1',
          groupBy: 'component' as GroupBy,
          key: 'test',
          issues: [createMockIssue(1)],
          branchName: 'fix/g1',
          relatedFiles: [],
          components: ['test'],
          priority: 'medium',
        },
      ];

      const groupResults = [
        {
          group: groups[0]!,
          status: 'completed' as const,
          pr: {
            number: 100,
            title: 'fix: test',
            body: '',
            state: 'open' as const,
            headBranch: 'fix/g1',
            baseBranch: 'main',
            linkedIssues: [1],
            labels: [],
            reviewers: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            url: 'https://github.com/test/repo/pull/100',
            changedFiles: 1,
            additions: 1,
            deletions: 0,
          },
          attempts: 1,
          durationMs: 1000,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ];

      const result = createAutofixResult(groupResults, false, new Date());
      const generator = createReportGenerator({ format: 'text' });
      const report = generator.generate(result);

      expect(report).toContain('AUTOFIX REPORT');
      expect(report).toContain('Total Groups:');
      expect(report).toContain('PRs Created:');
    });

    it('should generate JSON report', async () => {
      const { createReportGenerator, createAutofixResult } = await import('../report.js');

      const groups: IssueGroup[] = [
        {
          id: 'g1',
          name: 'Group 1',
          groupBy: 'component' as GroupBy,
          key: 'test',
          issues: [createMockIssue(1)],
          branchName: 'fix/g1',
          relatedFiles: [],
          components: ['test'],
          priority: 'medium',
        },
      ];

      const groupResults = [
        {
          group: groups[0]!,
          status: 'completed' as const,
          attempts: 1,
          durationMs: 1000,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ];

      const result = createAutofixResult(groupResults, false, new Date());
      const generator = createReportGenerator({ format: 'json' });
      const report = generator.generate(result);

      const parsed = JSON.parse(report);
      expect(parsed.summary).toBeDefined();
      expect(parsed.groups).toBeDefined();
      expect(parsed.statistics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle and aggregate errors', async () => {
      const { AutofixError, ErrorAggregator } = await import('../error-system.js');

      const aggregator = new ErrorAggregator();

      aggregator.addError(new AutofixError('CHECK_FAILED', 'Test failed'));
      aggregator.addError(new Error('Generic error'));
      aggregator.addWarning('This is a warning');

      expect(aggregator.hasErrors()).toBe(true);
      expect(aggregator.hasWarnings()).toBe(true);
      expect(aggregator.getErrors().length).toBe(2);
      expect(aggregator.getWarnings().length).toBe(1);

      const summary = aggregator.getSummary();
      expect(summary).toContain('2 error(s)');
    });

    it('should provide user-friendly messages', async () => {
      const { AutofixError } = await import('../error-system.js');

      const error = new AutofixError('GITHUB_AUTH_FAILED', 'Auth failed');

      expect(error.getUserMessage()).toContain('authentication');
      expect(error.getSuggestedAction()).toContain('GITHUB_TOKEN');
    });
  });
});
