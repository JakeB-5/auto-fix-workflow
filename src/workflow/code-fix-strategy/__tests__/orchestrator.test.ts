/**
 * @module workflow/code-fix-strategy/__tests__/orchestrator
 * @description Tests for fix strategy orchestrator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FixAttempt } from '../types.js';
import type { IssueGroup, Issue } from '../../../common/types/index.js';

// Mock the checker module to control runVerificationChecks behavior
vi.mock('../checker.js', () => {
  return {
    runVerificationChecks: vi.fn(),
  };
});

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

describe('orchestrator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFixStatus', () => {
    it('should return initial status for no attempts', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const status = getFixStatus([], 3);

      expect(status).toEqual({
        currentAttempt: 0,
        maxAttempts: 3,
        attempts: [],
        complete: false,
        success: false,
      });
    });

    it('should return status for successful attempt', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: true,
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
          success: true,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status).toEqual({
        currentAttempt: 1,
        maxAttempts: 3,
        attempts,
        complete: true,
        success: true,
      });
    });

    it('should return status for failed attempts', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const attempts: FixAttempt[] = [
        {
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
        },
        {
          attempt: 2,
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
            attempt: 2,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status).toEqual({
        currentAttempt: 2,
        maxAttempts: 3,
        attempts,
        complete: false,
        success: false,
      });
    });

    it('should mark complete when max retries reached', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 1,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
        {
          attempt: 2,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 2,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
        {
          attempt: 3,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 3,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status.complete).toBe(true);
      expect(status.success).toBe(false);
      expect(status.currentAttempt).toBe(3);
    });

    it('should handle in-progress attempts', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
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
                error: 'Lint error',
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status.complete).toBe(false);
      expect(status.success).toBe(false);
      expect(status.currentAttempt).toBe(1);
      expect(status.maxAttempts).toBe(3);
    });

    it('should handle maxRetries of 1', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 1,
            totalDurationMs: 500,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 1);

      expect(status.complete).toBe(true);
      expect(status.success).toBe(false);
    });

    it('should correctly reflect success on first attempt', async () => {
      const { getFixStatus } = await import('../orchestrator.js');
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: true,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 500,
          },
          success: true,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 5);

      expect(status.complete).toBe(true);
      expect(status.success).toBe(true);
      expect(status.currentAttempt).toBe(1);
      expect(status.maxAttempts).toBe(5);
    });
  });

  describe('executeFixStrategy', () => {
    it('should return success with PR when checks pass', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: true,
          results: [
            { check: 'test', passed: true, status: 'passed', durationMs: 500 },
            { check: 'lint', passed: true, status: 'passed', durationMs: 200 },
          ],
          attempt: 1,
          totalDurationMs: 700,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBeDefined();
        expect(result.data.headBranch).toBe('fix/issue-1');
        expect(result.data.baseBranch).toBe('main');
        expect(result.data.url).toBeDefined();
        expect(result.data.number).toBe(1);
        expect(result.data.state).toBe('open');
        expect(result.data.changedFiles).toBeDefined();
        expect(typeof result.data.additions).toBe('number');
        expect(typeof result.data.deletions).toBe('number');
      }
    });

    it('should return CHECK_FAILED error when runVerificationChecks fails', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Worktree not found',
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CHECK_FAILED');
        expect(result.error.message).toBe('Worktree not found');
      }
    });

    it('should handle checks that pass but checks.data.passed is false (shouldRetry scenario)', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);

      // First call: checks return success=true but passed=false (test failed)
      // shouldRetry returns true for failed status with retries remaining
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: false,
          results: [
            { check: 'test', passed: false, status: 'failed', durationMs: 1000, error: 'assertion error' },
          ],
          attempt: 1,
          totalDurationMs: 1000,
        },
      });

      // Second call: still fails
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: false,
          results: [
            { check: 'test', passed: false, status: 'failed', durationMs: 1000, error: 'assertion error' },
          ],
          attempt: 2,
          totalDurationMs: 1000,
        },
      });

      // Third call: still fails
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: false,
          results: [
            { check: 'test', passed: false, status: 'failed', durationMs: 1000, error: 'assertion error' },
          ],
          attempt: 3,
          totalDurationMs: 1000,
        },
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group, { maxRetries: 3 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MAX_RETRIES_EXCEEDED');
        expect(result.error.attempts).toBeDefined();
        expect(result.error.context).toBeDefined();
      }

      consoleSpy.mockRestore();
    });

    it('should use default strategy when none provided', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: true,
          results: [],
          attempt: 1,
          totalDurationMs: 100,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should use provided strategy values', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: true,
          results: [],
          attempt: 1,
          totalDurationMs: 100,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group, {
        maxRetries: 1,
        forbiddenPatterns: [],
        allowedScopes: ['src/'],
      });

      expect(result).toBeDefined();
    });

    it('should handle partial strategy with defaults', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: true,
          results: [],
          attempt: 1,
          totalDurationMs: 100,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group, {
        maxRetries: 5,
      });

      expect(result).toBeDefined();
    });

    it('should break retry loop when shouldRetry returns false', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);

      // Return checks that pass as a result but have no failed checks (empty results)
      // shouldRetry returns false when results are empty
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: false,
          results: [], // No checks run -> shouldRetry returns false
          attempt: 1,
          totalDurationMs: 0,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group, { maxRetries: 3 });

      // Should fail with MAX_RETRIES_EXCEEDED since shouldRetry=false breaks loop
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MAX_RETRIES_EXCEEDED');
      }
    });

    it('should create PR with correct linked issues for multiple issues', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: true,
          results: [],
          attempt: 1,
          totalDurationMs: 100,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup({
        issues: [
          createIssue({ number: 10 }),
          createIssue({ number: 20 }),
        ],
      });

      const result = await executeFixStrategy(group);

      if (result.success) {
        expect(result.data.linkedIssues).toContain(10);
        expect(result.data.linkedIssues).toContain(20);
      }
    });

    it('should include labels in created PR', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);
      mockedRun.mockResolvedValue({
        success: true,
        data: {
          passed: true,
          results: [],
          attempt: 1,
          totalDurationMs: 100,
        },
      });

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup({ priority: 'critical' });

      const result = await executeFixStrategy(group);

      if (result.success) {
        expect(result.data.labels).toContain('automated-fix');
        expect(result.data.labels).toContain('priority:critical');
      }
    });

    it('should retry and eventually succeed on second attempt', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);

      // First attempt: fail with a retriable failure
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: false,
          results: [
            { check: 'test', passed: false, status: 'failed', durationMs: 500, error: 'assertion' },
          ],
          attempt: 1,
          totalDurationMs: 500,
        },
      });

      // Second attempt: pass
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          results: [
            { check: 'test', passed: true, status: 'passed', durationMs: 500 },
          ],
          attempt: 2,
          totalDurationMs: 500,
        },
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      const result = await executeFixStrategy(group, { maxRetries: 3 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBeDefined();
      }

      consoleSpy.mockRestore();
    });

    it('should generate retry feedback with console.log', async () => {
      const { runVerificationChecks } = await import('../checker.js');
      const mockedRun = vi.mocked(runVerificationChecks);

      // First attempt: fail
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: false,
          results: [
            { check: 'lint', passed: false, status: 'failed', durationMs: 300, error: 'lint error' },
          ],
          attempt: 1,
          totalDurationMs: 300,
        },
      });

      // Second attempt: pass
      mockedRun.mockResolvedValueOnce({
        success: true,
        data: {
          passed: true,
          results: [
            { check: 'lint', passed: true, status: 'passed', durationMs: 300 },
          ],
          attempt: 2,
          totalDurationMs: 300,
        },
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { executeFixStrategy } = await import('../orchestrator.js');
      const group = createGroup();

      await executeFixStrategy(group, { maxRetries: 3 });

      // Should have logged retry feedback
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retry'));

      consoleSpy.mockRestore();
    });
  });
});
