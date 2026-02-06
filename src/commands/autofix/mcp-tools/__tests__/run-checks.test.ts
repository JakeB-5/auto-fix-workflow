/**
 * @module commands/autofix/mcp-tools/__tests__/run-checks
 * @description Tests for RunChecksTool MCP tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RunChecksTool,
  createRunChecksTool,
  RunChecksInputSchema,
} from '../run-checks.js';
import type { ChecksToolConfig } from '../run-checks.js';

// Mock child_process
const mockExecAsync = vi.fn();
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));
vi.mock('util', () => ({
  promisify: vi.fn().mockReturnValue(function (...args: any[]) {
    return mockExecAsync(...args);
  }),
}));

// Mock fs/promises
const mockAccess = vi.fn();
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  access: function (...args: any[]) { return mockAccess(...args); },
  readFile: function (...args: any[]) { return mockReadFile(...args); },
}));

describe('RunChecksInputSchema', () => {
  it('should accept valid input', () => {
    const input = {
      worktreePath: '/tmp/wt',
      checks: ['test', 'lint'],
      failFast: true,
      timeout: 60000,
    };
    const result = RunChecksInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input with defaults', () => {
    const input = {
      worktreePath: '/tmp/wt',
      checks: ['test'],
    };
    const result = RunChecksInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.failFast).toBe(true);
      expect(result.data.timeout).toBe(300000);
    }
  });

  it('should reject invalid check type', () => {
    const input = {
      worktreePath: '/tmp/wt',
      checks: ['invalid'],
    };
    const result = RunChecksInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing worktreePath', () => {
    const result = RunChecksInputSchema.safeParse({ checks: ['test'] });
    expect(result.success).toBe(false);
  });
});

describe('RunChecksTool', () => {
  let tool: RunChecksTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new RunChecksTool();
  });

  describe('static properties', () => {
    it('should have correct tool name', () => {
      expect(RunChecksTool.toolName).toBe('run_checks');
    });

    it('should have correct tool description', () => {
      expect(RunChecksTool.toolDescription).toBe('Run test, lint, and type-check commands');
    });
  });

  describe('runChecks', () => {
    it('should return INVALID_PATH when worktree path does not exist', async () => {
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await tool.runChecks({
        worktreePath: '/nonexistent',
        checks: ['test'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_PATH');
        expect(result.error.message).toContain('/nonexistent');
      }
    });

    it('should run single test check successfully', async () => {
      // path exists
      mockAccess.mockResolvedValueOnce(undefined);
      // No lock files - npm default
      mockAccess
        .mockRejectedValueOnce(new Error('ENOENT')) // pnpm-lock.yaml
        .mockRejectedValueOnce(new Error('ENOENT')) // yarn.lock
        .mockRejectedValueOnce(new Error('ENOENT')); // package-lock.json
      // package.json with test script
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest run' } })
      );
      // exec test command
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'All tests passed',
        stderr: '',
      });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(true);
        expect(result.data.results).toHaveLength(1);
        expect(result.data.results[0]!.check).toBe('test');
        expect(result.data.results[0]!.passed).toBe(true);
        expect(result.data.results[0]!.status).toBe('passed');
        expect(result.data.attempt).toBe(1);
      }
    });

    it('should detect pnpm package manager', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // path exists
        .mockResolvedValueOnce(undefined); // pnpm-lock.yaml exists

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest run' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('pnpm test');
    });

    it('should detect yarn package manager', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // path exists
        .mockRejectedValueOnce(new Error('ENOENT')) // no pnpm-lock
        .mockResolvedValueOnce(undefined); // yarn.lock exists

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'jest' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('yarn test');
    });

    it('should detect npm package manager with package-lock.json', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined) // path exists
        .mockRejectedValueOnce(new Error('ENOENT')) // no pnpm-lock
        .mockRejectedValueOnce(new Error('ENOENT')) // no yarn.lock
        .mockResolvedValueOnce(undefined); // package-lock.json exists

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run test');
    });

    it('should fall back to npx vitest when no test script found', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { build: 'tsc' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npx vitest run --passWithNoTests');
    });

    it('should use test:run script if available', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { 'test:run': 'vitest run' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run test:run');
    });

    it('should detect typecheck script names', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['typecheck'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run typecheck');
    });

    it('should fall back to npx tsc when no typecheck script', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: {} })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['typecheck'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npx tsc --noEmit');
    });

    it('should detect lint script names', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint .' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run lint');
    });

    it('should fall back to npx eslint when no lint script', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: {} })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npx eslint .');
    });

    it('should use pnpm for typecheck when pnpm detected', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined); // pnpm-lock exists

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { typecheck: 'tsc' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['typecheck'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('pnpm run typecheck');
    });

    it('should use yarn for lint when yarn detected', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined); // yarn.lock

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('yarn lint');
    });

    it('should handle check failure', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest' } })
      );

      const execError: any = new Error('Command failed');
      execError.code = 1;
      execError.stdout = 'FAIL src/test.ts';
      execError.stderr = 'Error details';
      mockExecAsync.mockRejectedValueOnce(execError);

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(false);
        expect(result.data.results[0]!.passed).toBe(false);
        expect(result.data.results[0]!.status).toBe('failed');
        expect(result.data.results[0]!.stdout).toBe('FAIL src/test.ts');
        expect(result.data.results[0]!.stderr).toBe('Error details');
        expect(result.data.results[0]!.exitCode).toBe(1);
      }
    });

    it('should handle timeout', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest' } })
      );

      const timeoutError: any = new Error('Process timed out');
      timeoutError.killed = true;
      timeoutError.signal = 'SIGTERM';
      timeoutError.stdout = 'partial output';
      timeoutError.stderr = '';
      mockExecAsync.mockRejectedValueOnce(timeoutError);

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(false);
        expect(result.data.results[0]!.status).toBe('timeout');
        expect(result.data.results[0]!.error).toBe('Check timed out');
      }
    });

    it('should stop on first failure with failFast=true (default)', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint', test: 'vitest' } })
      );

      const lintError: any = new Error('Lint failed');
      lintError.code = 1;
      mockExecAsync.mockRejectedValueOnce(lintError);

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint', 'test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Only lint ran, test was skipped due to failFast
        expect(result.data.results).toHaveLength(1);
        expect(result.data.results[0]!.check).toBe('lint');
        expect(result.data.passed).toBe(false);
      }
    });

    it('should continue on failure with failFast=false', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint', test: 'vitest' } })
      );

      const lintError: any = new Error('Lint failed');
      lintError.code = 1;
      mockExecAsync
        .mockRejectedValueOnce(lintError) // lint fails
        .mockResolvedValueOnce({ stdout: 'passed', stderr: '' }); // test passes

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint', 'test'],
        failFast: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(2);
        expect(result.data.results[0]!.passed).toBe(false);
        expect(result.data.results[1]!.passed).toBe(true);
        expect(result.data.passed).toBe(false);
      }
    });

    it('should run multiple checks all passing', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint', typecheck: 'tsc', test: 'vitest' } })
      );

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'lint ok', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'types ok', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'tests ok', stderr: '' });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint', 'typecheck', 'test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(true);
        expect(result.data.results).toHaveLength(3);
        expect(result.data.totalDurationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should use custom config commands when provided', async () => {
      const customTool = new RunChecksTool({
        testCommand: 'custom-test',
        typeCheckCommand: 'custom-tsc',
        lintCommand: 'custom-lint',
        testTimeout: 10000,
        typeCheckTimeout: 5000,
        lintTimeout: 5000,
      });

      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: {} })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await customTool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('custom-test');
    });

    it('should handle package.json read failure gracefully', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(true);
      // Falls back to npx vitest when scripts can't be read
    });

    it('should handle non-Error rejection in check execution', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest' } })
      );

      // Throw a string - executeCheck's internal catch handles it
      // but string has no .message, .killed, .signal properties
      mockExecAsync.mockRejectedValueOnce('unexpected error');

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(false);
        expect(result.data.results[0]!.passed).toBe(false);
        expect(result.data.results[0]!.status).toBe('failed');
      }
    });

    it('should handle pathExists returning false and yield INVALID_PATH', async () => {
      // pathExists catches errors internally and returns false
      // This leads to INVALID_PATH, not UNKNOWN
      mockAccess.mockImplementationOnce(() => {
        throw new Error('sync error');
      });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_PATH');
      }
    });

    it('should detect "check" lint script', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { check: 'biome check' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run check');
    });

    it('should detect "type-check" typecheck script', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { 'type-check': 'tsc --noEmit' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['typecheck'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run type-check');
    });

    it('should detect "types" typecheck script', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { types: 'tsc --noEmit' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['typecheck'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run types');
    });

    it('should detect "eslint" lint script', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { eslint: 'eslint .' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('npm run eslint');
    });

    it('should use pnpm for lint when pnpm detected', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined); // pnpm-lock

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('pnpm run lint');
    });

    it('should use yarn for typecheck when yarn detected', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined); // yarn.lock

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { typecheck: 'tsc' } })
      );

      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['typecheck'],
      });

      const cmd = mockExecAsync.mock.calls[0][0];
      expect(cmd).toContain('yarn typecheck');
    });

    it('should failFast on executeCheck throwing during loop', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint', test: 'vitest' } })
      );

      // First check throws a non-exec error
      mockExecAsync.mockImplementationOnce(() => {
        throw new Error('Unexpected synchronous error');
      });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint', 'test'],
        failFast: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(1);
        expect(result.data.results[0]!.passed).toBe(false);
        expect(result.data.results[0]!.error).toBe('Unexpected synchronous error');
      }
    });

    it('should continue on throw in loop with failFast=false', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { lint: 'eslint', test: 'vitest' } })
      );

      // First check throws, second passes
      mockExecAsync
        .mockImplementationOnce(() => { throw new Error('Lint crash'); })
        .mockResolvedValueOnce({ stdout: 'tests pass', stderr: '' });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['lint', 'test'],
        failFast: false,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(2);
        expect(result.data.results[0]!.passed).toBe(false);
        expect(result.data.results[0]!.error).toBe('Lint crash');
        expect(result.data.results[1]!.passed).toBe(true);
      }
    });

    it('should handle non-Error throw in executeCheck catch (message is undefined)', async () => {
      mockAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({ scripts: { test: 'vitest' } })
      );

      // When a string is thrown, it's caught by executeCheck's internal catch
      // and cast to ExecError. A string has no .message property, so error is undefined.
      mockExecAsync.mockImplementationOnce(() => { throw 'string thrown'; });

      const result = await tool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results[0]!.passed).toBe(false);
        expect(result.data.results[0]!.status).toBe('failed');
        // String thrown has no .message, so error is undefined
        expect(result.data.results[0]!.error).toBeUndefined();
      }
    });

    it('should hit outer catch when detectConfiguration throws', async () => {
      // Path exists
      mockAccess.mockResolvedValueOnce(undefined);
      // Force detectConfiguration to fail by making detectPackageManager throw unexpectedly
      // detectPackageManager calls pathExists which calls fs.access
      // But pathExists has a try-catch. Let's make readFile throw in a way
      // that propagates out of detectConfiguration.
      // Actually, detectPackageManager has no try-catch around pathExists calls.
      // pathExists always resolves. detectPackageScripts has try-catch.
      // So we need to make something throw after pathExists.
      // The simplest: make multiple access calls succeed/fail normally,
      // then make readFile throw with a special error that propagates.
      // Actually readFile is in detectPackageScripts which has try-catch too.
      // The outer catch is for truly unexpected errors.
      // Let's mock pathExists to throw on the second call (during detectPackageManager)
      // by making access throw something that isn't caught by pathExists...
      // Actually pathExists catches everything. So we need to throw from detectConfiguration
      // itself somehow.

      // Let's try a different approach - monkey-patch the tool instance
      const brokenTool = new RunChecksTool();
      // Override the private detectConfiguration to throw
      (brokenTool as any).detectConfiguration = function () {
        throw new Error('Configuration detection crashed');
      };

      const result = await brokenTool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toBe('Configuration detection crashed');
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });

    it('should hit outer catch with non-Error', async () => {
      mockAccess.mockResolvedValueOnce(undefined);

      const brokenTool = new RunChecksTool();
      (brokenTool as any).detectConfiguration = function () {
        throw 'string config error';
      };

      const result = await brokenTool.runChecks({
        worktreePath: '/tmp/wt',
        checks: ['test'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toBe('string config error');
      }
    });
  });
});

describe('createRunChecksTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return tool definition with correct properties', () => {
    const toolDef = createRunChecksTool();

    expect(toolDef.name).toBe('run_checks');
    expect(toolDef.description).toBe('Run test, lint, and type-check commands');
    expect(toolDef.inputSchema.required).toEqual(['worktreePath', 'checks']);
  });

  it('should accept optional config', () => {
    const toolDef = createRunChecksTool({
      testCommand: 'custom-test',
    });

    expect(toolDef.name).toBe('run_checks');
  });

  it('should have handler that runs checks', async () => {
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

    const toolDef = createRunChecksTool();

    const result = await toolDef.handler({
      worktreePath: '/nonexistent',
      checks: ['test'],
      failFast: true,
      timeout: 60000,
    });

    expect(result.success).toBe(false);
  });
});
