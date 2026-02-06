/**
 * @module commands/autofix/__tests__/pipeline.test
 * @description Tests for ProcessingPipeline
 *
 * Strategy: Instead of mocking tool constructors (broken in Vitest 4.x with arrow functions),
 * we inject mock stage objects via the ProcessingPipeline constructor's `stages` parameter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessingPipeline, createPipeline, type PipelineConfig, type PipelineStages } from '../pipeline.js';
import type { IssueGroup, Issue, Config, GroupBy, WorktreeInfo, CheckResult, PullRequest } from '../../../common/types/index.js';
import type { PipelineStage, PipelineContext, AIAnalysisResult, AIFixResult } from '../types.js';

// ── Mock Data Factories ──────────────────────────────────────────────

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

// ── Mock Worktree Info ───────────────────────────────────────────────

const mockWorktreeInfo: WorktreeInfo = {
  path: '/test/worktree',
  branch: 'fix/test',
  status: 'ready',
  issueNumbers: [1],
  createdAt: new Date(),
  lastActivityAt: new Date(),
};

// ── Mock Check Result ────────────────────────────────────────────────

const mockCheckResult: CheckResult = {
  passed: true,
  results: [
    { check: 'lint', passed: true, status: 'passed', durationMs: 100 },
    { check: 'typecheck', passed: true, status: 'passed', durationMs: 200 },
    { check: 'test', passed: true, status: 'passed', durationMs: 300 },
  ],
  attempt: 1,
  totalDurationMs: 600,
};

// ── Mock Analysis Result ─────────────────────────────────────────────

const mockAnalysisResult: AIAnalysisResult = {
  issues: [],
  filesToModify: ['src/test.ts'],
  rootCause: 'Test root cause',
  suggestedFix: 'Test approach',
  confidence: 0.9,
  complexity: 'low',
};

// ── Mock Fix Result ──────────────────────────────────────────────────

const mockFixResult: AIFixResult = {
  filesModified: ['src/test.ts'],
  summary: 'Test fix applied',
  success: true,
  commitMessage: 'fix: test issue',
};

// ── Mock PR ──────────────────────────────────────────────────────────

const mockPR: PullRequest = {
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
};

// ── Mock Stage Factory ───────────────────────────────────────────────

function createMockStages(overrides: Partial<{
  worktreeExecute: ReturnType<typeof vi.fn>;
  worktreeCleanup: ReturnType<typeof vi.fn>;
  worktreeHasUncommittedChanges: ReturnType<typeof vi.fn>;
  worktreeExecInWorktree: ReturnType<typeof vi.fn>;
  analysisExecute: ReturnType<typeof vi.fn>;
  fixExecute: ReturnType<typeof vi.fn>;
  fixVerifyChanges: ReturnType<typeof vi.fn>;
  checkExecute: ReturnType<typeof vi.fn>;
  checkInstallDependencies: ReturnType<typeof vi.fn>;
  checkFormatCheckFailures: ReturnType<typeof vi.fn>;
  commitExecute: ReturnType<typeof vi.fn>;
  prExecute: ReturnType<typeof vi.fn>;
  prUpdateIssues: ReturnType<typeof vi.fn>;
}> = {}): PipelineStages {
  return {
    worktree: {
      stageName: 'worktree_create',
      execute: overrides.worktreeExecute ?? vi.fn().mockResolvedValue({
        success: true,
        data: mockWorktreeInfo,
      }),
      cleanup: overrides.worktreeCleanup ?? vi.fn().mockResolvedValue(undefined),
      hasUncommittedChanges: overrides.worktreeHasUncommittedChanges ?? vi.fn().mockResolvedValue(true),
      execInWorktree: overrides.worktreeExecInWorktree ?? vi.fn().mockResolvedValue({
        success: true,
        data: { stdout: 'M src/test.ts', stderr: '' },
      }),
    } as any,
    analysis: {
      stageName: 'ai_analysis',
      execute: overrides.analysisExecute ?? vi.fn().mockResolvedValue({
        success: true,
        data: mockAnalysisResult,
      }),
    } as any,
    fix: {
      stageName: 'ai_fix',
      execute: overrides.fixExecute ?? vi.fn().mockResolvedValue({
        success: true,
        data: mockFixResult,
      }),
      verifyChanges: overrides.fixVerifyChanges ?? vi.fn().mockResolvedValue(true),
    } as any,
    check: {
      stageName: 'checks',
      execute: overrides.checkExecute ?? vi.fn().mockResolvedValue({
        success: true,
        data: mockCheckResult,
      }),
      installDependencies: overrides.checkInstallDependencies ?? vi.fn().mockResolvedValue({
        success: true,
        data: undefined,
      }),
      formatCheckFailures: overrides.checkFormatCheckFailures ?? vi.fn().mockReturnValue('[lint] failed: Lint errors'),
    } as any,
    commit: {
      stageName: 'commit',
      execute: overrides.commitExecute ?? vi.fn().mockResolvedValue({
        success: true,
        data: undefined,
      }),
    } as any,
    pr: {
      stageName: 'pr_create',
      execute: overrides.prExecute ?? vi.fn().mockResolvedValue({
        success: true,
        data: mockPR,
      }),
      updateIssues: overrides.prUpdateIssues ?? vi.fn().mockResolvedValue(undefined),
    } as any,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ProcessingPipeline', () => {
  let pipelineConfig: PipelineConfig;

  beforeEach(() => {
    vi.clearAllMocks();

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
      const stages = createMockStages();
      const pipeline = createPipeline(pipelineConfig, stages);
      expect(pipeline).toBeInstanceOf(ProcessingPipeline);
    });
  });

  describe('processGroup', () => {
    it('should process group through all stages', async () => {
      const stages = createMockStages();
      const pipeline = createPipeline(pipelineConfig, stages);
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
      const stages = createMockStages();
      const pipeline = createPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      const visitedStages: PipelineStage[] = [];
      pipeline.onStageChange((stage) => {
        visitedStages.push(stage);
      });

      await pipeline.processGroup(group);

      expect(visitedStages).toContain('worktree_create');
      expect(visitedStages).toContain('ai_analysis');
      expect(visitedStages).toContain('ai_fix');
      expect(visitedStages).toContain('checks');
      expect(visitedStages).toContain('pr_create');
      expect(visitedStages).toContain('done');
    });

    it('should handle worktree creation failure', async () => {
      const stages = createMockStages({
        worktreeExecute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'WORKTREE_EXISTS', message: 'Worktree already exists' },
        }),
      });

      const pipeline = new ProcessingPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should handle check failures', async () => {
      const failedCheckResult: CheckResult = {
        passed: false,
        results: [
          { check: 'lint', passed: false, status: 'failed', durationMs: 100, error: 'Lint errors' },
        ],
        attempt: 1,
        totalDurationMs: 100,
      };

      const stages = createMockStages({
        checkExecute: vi.fn().mockResolvedValue({
          success: true,
          data: failedCheckResult,
        }),
      });

      const pipeline = new ProcessingPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('failed');
    });

    it('should skip actual changes in dry-run mode', async () => {
      const dryRunConfig = { ...pipelineConfig, dryRun: true };
      const stages = createMockStages();
      const pipeline = createPipeline(dryRunConfig, stages);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      // Should still complete but without actual PR
      expect(result.status).toBe('completed');
    });

    it('should include duration in result', async () => {
      const stages = createMockStages();
      const pipeline = createPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should include check results', async () => {
      const stages = createMockStages();
      const pipeline = createPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.checkResult).toBeDefined();
      expect(result.checkResult?.passed).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should collect errors in context', async () => {
      const stages = createMockStages({
        analysisExecute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'ANALYSIS_FAILED', message: 'Analysis failed' },
        }),
      });

      const pipeline = new ProcessingPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('failed');
      expect(result.errorDetails).toBeDefined();
    });

    it('should cleanup on failure', async () => {
      const cleanupMock = vi.fn().mockResolvedValue(undefined);

      const stages = createMockStages({
        worktreeCleanup: cleanupMock,
        // Fail at the commit stage by making execInWorktree reject
        commitExecute: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'COMMIT_FAILED', message: 'Commit failed' },
        }),
      });

      const pipeline = new ProcessingPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1]);

      await pipeline.processGroup(group);

      // Should have called cleanup for failure path
      expect(cleanupMock).toHaveBeenCalled();
    });
  });

  describe('multi-issue groups', () => {
    it('should handle groups with multiple issues', async () => {
      const stages = createMockStages();
      const pipeline = createPipeline(pipelineConfig, stages);
      const group = createMockGroup('g1', [1, 2, 3]);

      const result = await pipeline.processGroup(group);

      expect(result.status).toBe('completed');
      expect(result.group.issues).toHaveLength(3);
    });
  });
});
