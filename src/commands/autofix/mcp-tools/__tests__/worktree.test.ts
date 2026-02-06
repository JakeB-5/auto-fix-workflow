/**
 * @module commands/autofix/mcp-tools/__tests__/worktree
 * @description Tests for WorktreeTool MCP tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorktreeTool,
  createWorktreeTool,
  WorktreeOperationSchema,
} from '../worktree.js';
import type { WorktreeConfig } from '../worktree.js';

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
const mockMkdir = vi.fn();
const mockAccess = vi.fn();
vi.mock('fs/promises', () => ({
  mkdir: function (...args: any[]) { return mockMkdir(...args); },
  access: function (...args: any[]) { return mockAccess(...args); },
}));

describe('WorktreeOperationSchema', () => {
  it('should accept valid create operation', () => {
    const input = {
      action: 'create',
      branchName: 'fix/issue-1',
      baseBranch: 'autofixing',
      issueNumbers: [1, 2],
    };
    const result = WorktreeOperationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept create with default baseBranch', () => {
    const input = {
      action: 'create',
      branchName: 'fix/issue-1',
      issueNumbers: [1],
    };
    const result = WorktreeOperationSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('baseBranch', 'autofixing');
    }
  });

  it('should accept valid cleanup operation', () => {
    const input = {
      action: 'cleanup',
      path: '/tmp/worktree',
      force: true,
    };
    const result = WorktreeOperationSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept cleanup with default force', () => {
    const input = {
      action: 'cleanup',
      path: '/tmp/worktree',
    };
    const result = WorktreeOperationSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty('force', false);
    }
  });

  it('should accept valid list operation', () => {
    const result = WorktreeOperationSchema.safeParse({ action: 'list' });
    expect(result.success).toBe(true);
  });

  it('should accept valid status operation', () => {
    const result = WorktreeOperationSchema.safeParse({
      action: 'status',
      path: '/tmp/worktree',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const result = WorktreeOperationSchema.safeParse({ action: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('WorktreeTool', () => {
  const config: WorktreeConfig = {
    baseDir: '/tmp/worktrees',
    prefix: 'autofix-',
    repoPath: '/repo',
  };

  let tool: WorktreeTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new WorktreeTool(config);
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
  });

  describe('static properties', () => {
    it('should have correct tool name', () => {
      expect(WorktreeTool.toolName).toBe('git_worktree');
    });

    it('should have correct tool description', () => {
      expect(WorktreeTool.toolDescription).toBe('Manage git worktrees for parallel development');
    });
  });

  describe('create', () => {
    it('should create worktree successfully when branch does not exist', async () => {
      // list returns no existing worktree
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree list (for getWorktreeByPath)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch origin
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch --list (local)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch -r --list (remote)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // worktree add

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.branch).toBe('fix/issue-1');
        expect(result.data.status).toBe('ready');
        expect(result.data.issueNumbers).toEqual([1]);
        expect(result.data.path).toContain('autofix-fix-issue-1');
      }
    });

    it('should create worktree when branch already exists', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch origin
        .mockResolvedValueOnce({ stdout: '  fix/issue-1\n', stderr: '' }) // local branches - branch exists
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch -D (delete local)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // worktree add

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
      });

      expect(result.success).toBe(true);
    });

    it('should create worktree when branch exists remotely', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch origin
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // local branches - no match
        .mockResolvedValueOnce({ stdout: '  origin/fix/issue-1\n', stderr: '' }) // remote branches - match
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch -D fails silently
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // worktree add

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
      });

      expect(result.success).toBe(true);
    });

    it('should return WORKTREE_EXISTS if worktree already exists at path', async () => {
      // Use an explicit path so we can match exactly in the porcelain output
      const explicitPath = '/tmp/worktrees/explicit-wt';
      const worktreeOutput = `worktree ${explicitPath}\nHEAD abc123\nbranch refs/heads/fix/issue-1\n`;
      mockExecAsync.mockResolvedValueOnce({ stdout: worktreeOutput, stderr: '' });

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
        path: explicitPath,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('WORKTREE_EXISTS');
      }
    });

    it('should use provided path instead of generating one', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch origin
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch --list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch -r --list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // worktree add

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
        path: '/custom/path',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/custom/path');
      }
    });

    it('should use default baseBranch when not specified', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.create({
        branchName: 'fix/issue-1',
        issueNumbers: [1],
      });

      // The worktree add command should use 'autofixing' as base
      const addCall = mockExecAsync.mock.calls[4];
      expect(addCall[0]).toContain('origin/autofixing');
    });

    it('should handle branch -D failure gracefully when branch exists', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch origin
        .mockResolvedValueOnce({ stdout: '  fix/issue-1\n', stderr: '' }) // branch exists locally
        .mockRejectedValueOnce(new Error('branch checked out elsewhere')) // branch -D fails
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // worktree add still works

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
      });

      expect(result.success).toBe(true);
    });

    it('should map git errors properly', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // fetch
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch --list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // branch -r --list
        .mockRejectedValueOnce(new Error('fatal: some git error'));

      const result = await tool.create({
        branchName: 'fix/issue-1',
        baseBranch: 'autofixing',
        issueNumbers: [1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GIT_ERROR');
      }
    });
  });

  describe('remove', () => {
    it('should remove worktree successfully', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree remove
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // worktree list (for getWorktreeByPath)

      const result = await tool.remove({
        path: '/tmp/worktrees/autofix-fix-issue-1',
      });

      expect(result.success).toBe(true);
    });

    it('should use force flag when specified', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.remove({
        path: '/tmp/worktrees/autofix-fix-issue-1',
        force: true,
      });

      const removeCall = mockExecAsync.mock.calls[0];
      expect(removeCall[0]).toContain('--force');
    });

    it('should not use force flag when not specified', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.remove({
        path: '/tmp/worktrees/autofix-fix-issue-1',
      });

      const removeCall = mockExecAsync.mock.calls[0];
      expect(removeCall[0]).not.toContain('--force');
    });

    it('should delete branch after removal by default', async () => {
      const worktreeOutput = `worktree /tmp/worktrees/autofix-fix-issue-1\nHEAD abc123\nbranch refs/heads/fix/issue-1\n`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree remove
        .mockResolvedValueOnce({ stdout: worktreeOutput, stderr: '' }) // worktree list (for getWorktreeByPath)
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // branch -D

      await tool.remove({
        path: '/tmp/worktrees/autofix-fix-issue-1',
      });

      // branch -D should have been called
      const branchCall = mockExecAsync.mock.calls[2];
      expect(branchCall[0]).toContain('branch -D fix/issue-1');
    });

    it('should not delete protected branches (main, master, develop)', async () => {
      const worktreeOutput = `worktree /tmp/worktrees/autofix-main\nHEAD abc123\nbranch refs/heads/main\n`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree remove
        .mockResolvedValueOnce({ stdout: worktreeOutput, stderr: '' }); // worktree list

      await tool.remove({
        path: '/tmp/worktrees/autofix-main',
      });

      // Only 2 calls (remove + list), no branch -D
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });

    it('should skip branch deletion when deleteBranch is false', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await tool.remove({
        path: '/tmp/worktrees/autofix-fix-issue-1',
        deleteBranch: false,
      });

      // Only 1 call (worktree remove), no list or branch -D
      expect(mockExecAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle branch -D failure gracefully', async () => {
      const worktreeOutput = `worktree /tmp/worktrees/autofix-fix-issue-1\nHEAD abc123\nbranch refs/heads/fix/issue-1\n`;

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // worktree remove
        .mockResolvedValueOnce({ stdout: worktreeOutput, stderr: '' }) // list
        .mockRejectedValueOnce(new Error('branch already deleted')); // branch -D

      const result = await tool.remove({
        path: '/tmp/worktrees/autofix-fix-issue-1',
      });

      // Should still succeed
      expect(result.success).toBe(true);
    });

    it('should return error on worktree remove failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('not a valid worktree'));

      const result = await tool.remove({
        path: '/tmp/nonexistent',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('WORKTREE_NOT_FOUND');
      }
    });
  });

  describe('list', () => {
    it('should list worktrees successfully', async () => {
      const output = [
        'worktree /repo',
        'HEAD abc123',
        'branch refs/heads/main',
        '',
        'worktree /tmp/worktrees/autofix-fix-1',
        'HEAD def456',
        'branch refs/heads/fix/issue-1',
      ].join('\n');

      mockExecAsync.mockResolvedValueOnce({ stdout: output, stderr: '' });

      const result = await tool.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]!.path).toBe('/repo');
        expect(result.data[0]!.branch).toBe('main');
        expect(result.data[1]!.path).toBe('/tmp/worktrees/autofix-fix-1');
        expect(result.data[1]!.branch).toBe('fix/issue-1');
        expect(result.data[1]!.headCommit).toBe('def456');
      }
    });

    it('should return empty array for empty output', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await tool.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should skip entries without branch', async () => {
      const output = [
        'worktree /repo',
        'HEAD abc123',
        'detached',
      ].join('\n');

      mockExecAsync.mockResolvedValueOnce({ stdout: output, stderr: '' });

      const result = await tool.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should return error on git failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('fatal: git error'));

      const result = await tool.list();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('GIT_ERROR');
      }
    });
  });

  describe('getStatus', () => {
    it('should return worktree status with no changes', async () => {
      const listOutput = [
        'worktree /tmp/wt',
        'HEAD abc123',
        'branch refs/heads/fix/issue-1',
      ].join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: listOutput, stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: '', stderr: '' }); // git status --porcelain

      const result = await tool.getStatus('/tmp/wt');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('/tmp/wt');
        expect(result.data.status).toBe('ready');
      }
    });

    it('should return in_use status when there are uncommitted changes', async () => {
      const listOutput = [
        'worktree /tmp/wt',
        'HEAD abc123',
        'branch refs/heads/fix/issue-1',
      ].join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: listOutput, stderr: '' }) // worktree list
        .mockResolvedValueOnce({ stdout: ' M src/file.ts\n', stderr: '' }); // git status --porcelain

      const result = await tool.getStatus('/tmp/wt');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('in_use');
      }
    });

    it('should return WORKTREE_NOT_FOUND when path not in list', async () => {
      const listOutput = [
        'worktree /tmp/other',
        'HEAD abc123',
        'branch refs/heads/main',
      ].join('\n');

      mockExecAsync.mockResolvedValueOnce({ stdout: listOutput, stderr: '' });

      const result = await tool.getStatus('/tmp/wt');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('WORKTREE_NOT_FOUND');
      }
    });

    it('should handle hasUncommittedChanges failure gracefully', async () => {
      const listOutput = [
        'worktree /tmp/wt',
        'HEAD abc123',
        'branch refs/heads/fix/issue-1',
      ].join('\n');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: listOutput, stderr: '' }) // worktree list
        .mockRejectedValueOnce(new Error('git status failed')); // git status fails

      const result = await tool.getStatus('/tmp/wt');

      expect(result.success).toBe(true);
      if (result.success) {
        // When status check fails, hasUncommittedChanges returns false
        expect(result.data.status).toBe('ready');
      }
    });
  });

  describe('execInWorktree', () => {
    it('should execute git command in worktree', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: 'output', stderr: '' });

      const result = await tool.execInWorktree('/tmp/wt', 'status');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stdout).toBe('output');
      }
    });

    it('should return error on failure', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('error: git failed'));

      const result = await tool.execInWorktree('/tmp/wt', 'status');

      expect(result.success).toBe(false);
    });
  });

  describe('error mapping', () => {
    it('should map "already exists" to WORKTREE_EXISTS', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('worktree already exists at path'));

      const result = await tool.create({
        branchName: 'fix/x',
        issueNumbers: [1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('WORKTREE_EXISTS');
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });

    it('should map "branch ... exists" to BRANCH_EXISTS when no "already" in message', async () => {
      // Note: mapError checks "already exists" first, so if message contains "already exists"
      // it maps to WORKTREE_EXISTS. BRANCH_EXISTS only fires when "branch" and "exists" are
      // present but "already exists" is NOT.
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('a branch named fix/x exists in refs/heads'));

      const result = await tool.create({
        branchName: 'fix/x',
        issueNumbers: [1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('BRANCH_EXISTS');
      }
    });

    it('should map "branch already exists" to WORKTREE_EXISTS (already exists takes priority)', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('branch fix/x already exists'));

      const result = await tool.create({
        branchName: 'fix/x',
        issueNumbers: [1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // "already exists" check fires first in mapError
        expect(result.error.code).toBe('WORKTREE_EXISTS');
      }
    });

    it('should map non-Error to UNKNOWN', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce('string error');

      const result = await tool.create({
        branchName: 'fix/x',
        issueNumbers: [1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toBe('string error');
      }
    });

    it('should map unknown Error to UNKNOWN', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce(new Error('something unexpected'));

      const result = await tool.create({
        branchName: 'fix/x',
        issueNumbers: [1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
      }
    });
  });

  describe('generateWorktreePath', () => {
    it('should sanitize branch name in generated path', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await tool.create({
        branchName: 'fix/issue@#$%^&*123',
        issueNumbers: [1],
      });

      if (result.success) {
        expect(result.data.path).toMatch(/autofix-fix-issue-123/);
        expect(result.data.path).not.toMatch(/[@#$%^&*]/);
      }
    });
  });
});

describe('createWorktreeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return tool definition with correct properties', () => {
    const toolDef = createWorktreeTool({
      baseDir: '/tmp',
      prefix: 'autofix-',
      repoPath: '/repo',
    });

    expect(toolDef.name).toBe('git_worktree');
    expect(toolDef.description).toBe('Manage git worktrees for parallel development');
    expect(toolDef.inputSchema.required).toEqual(['action']);
  });

  it('should handle create action via handler', async () => {
    mockExecAsync
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const toolDef = createWorktreeTool({
      baseDir: '/tmp',
      prefix: 'autofix-',
      repoPath: '/repo',
    });

    const result = await toolDef.handler({
      action: 'create',
      branchName: 'fix/issue-1',
      baseBranch: 'autofixing',
      issueNumbers: [1],
    });

    expect(result.success).toBe(true);
  });

  it('should handle cleanup action via handler', async () => {
    mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const toolDef = createWorktreeTool({
      baseDir: '/tmp',
      prefix: 'autofix-',
      repoPath: '/repo',
    });

    const result = await toolDef.handler({
      action: 'cleanup',
      path: '/tmp/worktree',
      force: false,
    });

    expect(result.success).toBe(true);
  });

  it('should handle list action via handler', async () => {
    mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const toolDef = createWorktreeTool({
      baseDir: '/tmp',
      prefix: 'autofix-',
      repoPath: '/repo',
    });

    const result = await toolDef.handler({ action: 'list' });

    expect(result.success).toBe(true);
  });

  it('should handle status action via handler', async () => {
    const listOutput = [
      'worktree /tmp/wt',
      'HEAD abc123',
      'branch refs/heads/fix/issue-1',
    ].join('\n');

    mockExecAsync
      .mockResolvedValueOnce({ stdout: listOutput, stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const toolDef = createWorktreeTool({
      baseDir: '/tmp',
      prefix: 'autofix-',
      repoPath: '/repo',
    });

    const result = await toolDef.handler({
      action: 'status',
      path: '/tmp/wt',
    });

    expect(result.success).toBe(true);
  });
});
