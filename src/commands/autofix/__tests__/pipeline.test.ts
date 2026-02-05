/**
 * @module commands/autofix/__tests__/pipeline.test
 * @description Tests for ProcessingPipeline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessingPipeline, createPipeline, type PipelineConfig } from '../pipeline.js';
import type { IssueGroup, Issue, Config, GroupBy } from '../../../common/types/index.js';
import type { PipelineStage, PipelineContext } from '../types.js';

// Mock dependencies
vi.mock('../mcp-tools/worktree.js', () => ({
  WorktreeTool: vi.fn().mockImplementation(() => ({
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
    remove: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    // Return modified files for git status --porcelain to pass hasUncommittedChanges check
    execInWorktree: vi.fn().mockResolvedValue({ success: true, data: { stdout: 'M src/test.ts', stderr: '' } }),
  })),
}));

vi.mock('../mcp-tools/run-checks.js', () => ({
  RunChecksTool: vi.fn().mockImplementation(() => ({
    runChecks: vi.fn().mockResolvedValue({
      success: true,
      data: {
        passed: true,
        results: [
          { check: 'lint', passed: true, status: 'passed', durationMs: 100 },
          { check: 'typecheck', passed: true, status: 'passed', durationMs: 200 },
          { check: 'test', passed: true, status: 'passed', durationMs: 300 },
        ],
        attempt: 1,
        totalDurationMs: 600,
      },
    }),
  })),
}));

vi.mock('../mcp-tools/create-pr.js', () => ({
  CreatePRTool: vi.fn().mockImplementation(() => ({
    createPRFromIssues: vi.fn().mockResolvedValue({
      success: true,
      data: {
        number: 123,
        title: 'fix: test issue',
        body: 'Test PR body',
        state: 'open',
        headBranch: 'fix/test',
        baseBranch: 'main',
        linkedIssues: [1],
        labels: ['auto-fix'],
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com/test/repo/pull/123',
        changedFiles: 1,
        additions: 10,
        deletions: 5,
      },
    }),
  })),
}));

vi.mock('../mcp-tools/update-issue.js', () => ({
  UpdateIssueTool: vi.fn().mockImplementation(() => ({
    markFixed: vi.fn().mockResolvedValue({ success: true, data: { issueNumber: 1, updated: true } }),
  })),
}));

vi.mock('../ai-integration.js', () => ({
  AIIntegration: vi.fn().mockImplementation(() => ({
    analyzeGroup: vi.fn().mockResolvedValue({
      success: true,
      data: {
        issues: [],
        filesToModify: ['src/test.ts'],
        rootCause: 'Test root cause',
        suggestedFix: 'Test approach',
        confidence: 0.9,
        complexity: 'low',
      },
    }),
    applyFix: vi.fn().mockResolvedValue({
      success: true,
      data: {
        filesModified: ['src/test.ts'],
        summary: 'Test fix applied',
        success: true,
        commitMessage: 'fix: test issue',
      },
    }),
  })),
}));

// Mock issue factory
function createMockIssue(number: number): Issue {
  return {
    number,
    title: `Test Issue ${number}`,
    body: 'Test body',
    state: 'open',
    type: 'bug',
    labels: ['auto-fix'],
    assignees: [],
    context: {
      component: 'test',
      priority: 'medium',
      relatedFiles: ['src/test.ts'],
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

// Mock group factory
function createMockGroup(id: string, issueNumbers: number[]): IssueGroup {
  return {
    id,
    name: `Group ${id}`,
    groupBy: 'component' as GroupBy,
    key: 'test',
    issues: issueNumbers.map(n => createMockIssue(n)),
    branchName: `fix/${id}`,
    relatedFiles: ['src/test.ts'],
    components: ['test'],
    priority: 'medium',
  };
}

// Mock config
function createMockConfig(): Config {
  return {
    github: {
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
      defaultBranch: 'main',
    },
    asana: {
      token: 'test-token',
      workspaceGid: 'test-gid',
      projectGids: [],
    },
    worktree: {
      baseDir: '/tmp/worktrees',
      prefix: 'autofix-',
    },
    checks: {
      testCommand: 'npm test',
      typeCheckCommand: 'npm run type-check',
      lintCommand: 'npm run lint',
    },
  };
}

describe('ProcessingPipeline', () => {
  let pipelineConfig: PipelineConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    pipelineConfig = {
      config: createMockConfig(),
      dryRun: false,
      maxRetries: 3,
      baseBranch: 'main',
      repoPath: '/test/repo',
    };
  });

  describe('constructor', () => {
    it('should create pipeline with config', () => {
      const pipeline = createPipeline(pipelineConfig);
      expect(pipeline).toBeInstanceOf(ProcessingPipeline);
    });
  });

  describe('processGroup', () => {
    it('should process group through all stages', async () => {
      const pipeline = createPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const stagesVisited: PipelineStage[] = [];
      pipeline.onStageChange((stage) => {
        stagesVisited.push(stage);
      });

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('completed');
      expect(result.group).toBe(group);
      expect(result.pr).toBeDefined();
      expect(result.pr?.number).toBe(123);
    });

    it('should track stage changes', async () => {
      const pipeline = createPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const stages: PipelineStage[] = [];
      pipeline.onStageChange((stage) => {
        stages.push(stage);
      });

      await pipeline.processGroup(group);

      expect(stages).toContain('worktree_create');
      expect(stages).toContain('ai_analysis');
      expect(stages).toContain('ai_fix');
      expect(stages).toContain('checks');
      expect(stages).toContain('pr_create');
      expect(stages).toContain('done');
    });

    it('should handle worktree creation failure', async () => {
      // Override mock for this test
      const { WorktreeTool } = await import('../mcp-tools/worktree.js');
      (WorktreeTool as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'WORKTREE_EXISTS', message: 'Worktree already exists' },
        }),
        remove: vi.fn().mockResolvedValue({ success: true }),
      }));

      const pipeline = new ProcessingPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should handle check failures', async () => {
      const { RunChecksTool } = await import('../mcp-tools/run-checks.js');
      (RunChecksTool as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        runChecks: vi.fn().mockResolvedValue({
          success: true,
          data: {
            passed: false,
            results: [
              { check: 'lint', passed: false, status: 'failed', durationMs: 100, error: 'Lint errors' },
            ],
            attempt: 1,
            totalDurationMs: 100,
          },
        }),
      }));

      const pipeline = new ProcessingPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('failed');
    });

    it('should skip actual changes in dry-run mode', async () => {
      const dryRunConfig = { ...pipelineConfig, dryRun: true };
      const pipeline = createPipeline(dryRunConfig);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      // Should still complete but without actual PR
      expect(result.status).toBe('completed');
    });

    it('should include duration in result', async () => {
      const pipeline = createPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should include check results', async () => {
      const pipeline = createPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.checkResult).toBeDefined();
      expect(result.checkResult?.passed).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should collect errors in context', async () => {
      const { AIIntegration } = await import('../ai-integration.js');
      (AIIntegration as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        analyzeGroup: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'ANALYSIS_FAILED', message: 'Analysis failed' },
        }),
        applyFix: vi.fn(),
      }));

      const pipeline = new ProcessingPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('failed');
      expect(result.errorDetails).toBeDefined();
    });

    it('should cleanup on failure', async () => {
      const { WorktreeTool } = await import('../mcp-tools/worktree.js');
      const removeMock = vi.fn().mockResolvedValue({ success: true });

      (WorktreeTool as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        create: vi.fn().mockResolvedValue({
          success: true,
          data: { path: '/test/worktree', branch: 'fix/test', status: 'ready', issueNumbers: [1], createdAt: new Date(), lastActivityAt: new Date() },
        }),
        remove: removeMock,
        execInWorktree: vi.fn().mockRejectedValue(new Error('Commit failed')),
      }));

      const { RunChecksTool } = await import('../mcp-tools/run-checks.js');
      (RunChecksTool as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        runChecks: vi.fn().mockResolvedValue({
          success: true,
          data: { passed: true, results: [], attempt: 1, totalDurationMs: 0 },
        }),
      }));

      const pipeline = new ProcessingPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1]);

      await pipeline.processGroup(group);

      // Should have called remove for cleanup
      expect(removeMock).toHaveBeenCalled();
    });
  });

  describe('multi-issue groups', () => {
    it('should handle groups with multiple issues', async () => {
      const pipeline = createPipeline(pipelineConfig);
      const group = createMockGroup('g1', [1, 2, 3]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('completed');
      expect(result.group.issues).toHaveLength(3);
    });
  });
});
