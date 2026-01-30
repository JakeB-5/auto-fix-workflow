/**
 * @module commands/autofix/__tests__/e2e.test
 * @description End-to-end tests for autofix command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config, Issue, IssueGroup, GroupBy } from '../../../common/types/index.js';

// Store original env
const originalEnv = { ...process.env };

// Mock all external dependencies for E2E testing
vi.mock('../mcp-tools/github-issues.js', () => ({
  GitHubIssuesTool: vi.fn().mockImplementation(() => ({
    fetchIssues: vi.fn().mockResolvedValue({
      success: true,
      data: {
        issues: [
          mockIssue(1),
          mockIssue(2),
        ],
        totalCount: 2,
        hasMore: false,
      },
    }),
  })),
}));

vi.mock('../mcp-tools/worktree.js', () => ({
  WorktreeTool: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      success: true,
      data: mockWorktree('fix/test'),
    }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    execInWorktree: vi.fn().mockResolvedValue({ success: true, data: { stdout: '', stderr: '' } }),
  })),
}));

vi.mock('../mcp-tools/run-checks.js', () => ({
  RunChecksTool: vi.fn().mockImplementation(() => ({
    runChecks: vi.fn().mockResolvedValue({
      success: true,
      data: {
        passed: true,
        results: [
          { check: 'lint', passed: true, status: 'passed', durationMs: 50 },
          { check: 'typecheck', passed: true, status: 'passed', durationMs: 100 },
          { check: 'test', passed: true, status: 'passed', durationMs: 200 },
        ],
        attempt: 1,
        totalDurationMs: 350,
      },
    }),
  })),
}));

vi.mock('../mcp-tools/create-pr.js', () => ({
  CreatePRTool: vi.fn().mockImplementation(() => ({
    createPRFromIssues: vi.fn().mockResolvedValue({
      success: true,
      data: mockPullRequest(100),
    }),
  })),
}));

vi.mock('../mcp-tools/update-issue.js', () => ({
  UpdateIssueTool: vi.fn().mockImplementation(() => ({
    markFixed: vi.fn().mockResolvedValue({ success: true }),
    markInProgress: vi.fn().mockResolvedValue({ success: true }),
    markFailed: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('../ai-integration.js', () => ({
  AIIntegration: vi.fn().mockImplementation(() => ({
    analyzeGroup: vi.fn().mockResolvedValue({
      success: true,
      data: {
        issues: [],
        filesToModify: ['src/test.ts'],
        approach: 'Apply fixes',
        confidence: 0.95,
        complexity: 'low',
      },
    }),
    applyFix: vi.fn().mockResolvedValue({
      success: true,
      data: {
        filesModified: ['src/test.ts'],
        summary: 'Fixed issues',
        success: true,
        commitMessage: 'fix: resolve test issues',
      },
    }),
  })),
}));

// Mock helpers
function mockIssue(number: number): Issue {
  return {
    number,
    title: `Issue ${number}: Test bug`,
    body: 'This is a test issue',
    state: 'open',
    type: 'bug',
    labels: ['auto-fix', 'bug'],
    assignees: [],
    context: {
      component: 'core',
      priority: 'medium',
      relatedFiles: ['src/core.ts'],
      relatedSymbols: ['testFunction'],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    url: `https://github.com/test/repo/issues/${number}`,
  };
}

function mockWorktree(branch: string) {
  return {
    path: `/tmp/worktrees/${branch}`,
    branch,
    status: 'ready',
    issueNumbers: [1],
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };
}

function mockPullRequest(number: number) {
  return {
    number,
    title: 'fix: resolve issues',
    body: 'Fixes #1',
    state: 'open',
    headBranch: 'fix/issues',
    baseBranch: 'main',
    linkedIssues: [1],
    labels: ['auto-fix'],
    reviewers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: `https://github.com/test/repo/pull/${number}`,
    changedFiles: 1,
    additions: 10,
    deletions: 2,
  };
}

describe('E2E: Autofix Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('Full Workflow', () => {
    it('should complete full autofix workflow', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 2,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalPRs).toBeGreaterThan(0);
        expect(result.data.totalFailed).toBe(0);
      }
    });

    it('should handle dry-run mode', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 2,
        dryRun: true,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(true);
      }
    });

    it('should process specific issues', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        issues: [1, 2],
        groupBy: 'component',
        maxParallel: 2,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should load config from environment', async () => {
      const { loadEnvConfig } = await import('../config.js');

      process.env.GITHUB_TOKEN = 'env-token';
      process.env.GITHUB_OWNER = 'env-owner';
      process.env.GITHUB_REPO = 'env-repo';

      const config = loadEnvConfig();

      expect(config.github?.token).toBe('env-token');
      expect(config.github?.owner).toBe('env-owner');
      expect(config.github?.repo).toBe('env-repo');
    });

    it('should validate required config', async () => {
      const { validateConfig } = await import('../config.js');

      const invalidConfig = {
        github: {
          token: '',
          owner: '',
          repo: '',
        },
        asana: {
          token: '',
          workspaceGid: '',
          projectGids: [],
        },
        worktree: {
          baseDir: '/tmp',
        },
      } as Config;

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should parse CLI arguments', async () => {
      const { parseArgs } = await import('../config.js');

      const options = parseArgs({
        issues: '1,2,3',
        groupBy: 'file',
        maxParallel: 5,
        dryRun: true,
        maxRetries: 2,
        verbose: true,
      });

      expect(options.issueNumbers).toEqual([1, 2, 3]);
      expect(options.groupBy).toBe('file');
      expect(options.maxParallel).toBe(5);
      expect(options.dryRun).toBe(true);
      expect(options.maxRetries).toBe(2);
      expect(options.verbose).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing config', async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_OWNER;
      delete process.env.GITHUB_REPO;

      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 2,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFIG_INVALID');
      }
    });

    it('should handle fetch failures gracefully', async () => {
      const { GitHubIssuesTool } = await import('../mcp-tools/github-issues.js');
      (GitHubIssuesTool as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        fetchIssues: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'AUTH_FAILED', message: 'Authentication failed' },
        }),
      }));

      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 2,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
    });

    it('should handle no issues found', async () => {
      const { GitHubIssuesTool } = await import('../mcp-tools/github-issues.js');
      (GitHubIssuesTool as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        fetchIssues: vi.fn().mockResolvedValue({
          success: true,
          data: {
            issues: [],
            totalCount: 0,
            hasMore: false,
          },
        }),
      }));

      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 2,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FETCH_FAILED');
      }
    });
  });

  describe('Grouping Strategies', () => {
    it('should group by component', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 2,
        dryRun: true,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should group by file', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'file',
        maxParallel: 2,
        dryRun: true,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should group by priority', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'priority',
        maxParallel: 2,
        dryRun: true,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Parallel Processing', () => {
    it('should respect max parallel setting', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 1,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });

    it('should handle high parallelism', async () => {
      const { runAutofix } = await import('../index.js');

      const result = await runAutofix({
        groupBy: 'component',
        maxParallel: 10,
        dryRun: false,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Report Generation', () => {
    it('should generate summary line', async () => {
      const { generateSummaryLine, createAutofixResult } = await import('../report.js');

      const result = createAutofixResult([
        {
          group: {
            id: 'g1',
            name: 'Group 1',
            groupBy: 'component' as GroupBy,
            key: 'test',
            issues: [mockIssue(1)],
            branchName: 'fix/g1',
            relatedFiles: [],
            components: ['test'],
            priority: 'medium',
          },
          status: 'completed',
          pr: mockPullRequest(100),
          attempts: 1,
          durationMs: 1000,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ], false, new Date());

      const summary = generateSummaryLine(result);

      expect(summary).toContain('SUCCESS');
      expect(summary).toContain('1/1');
      expect(summary).toContain('1 PRs');
    });
  });
});
