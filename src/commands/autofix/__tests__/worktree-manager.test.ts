/**
 * @module commands/autofix/__tests__/worktree-manager.test
 * @description Tests for worktree-manager module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorktreeManager,
  createWorktreeManager,
  type WorktreeManagerConfig,
} from '../worktree-manager.js';

// Mock the WorktreeTool
vi.mock('../mcp-tools/worktree.js', () => {
  return {
    WorktreeTool: vi.fn(function (this: any, config: any) {
      this.config = config;
      this.create = vi.fn();
      this.remove = vi.fn();
      this.list = vi.fn();
      return this;
    }),
  };
});

function makeConfig(overrides?: Partial<WorktreeManagerConfig>): WorktreeManagerConfig {
  return {
    maxConcurrent: 3,
    autoCleanupMinutes: 60,
    baseDir: '/tmp/worktrees',
    prefix: 'autofix-',
    repoPath: '/repo',
    ...overrides,
  };
}

function getToolMock(manager: WorktreeManager): any {
  return (manager as any).tool;
}

describe('WorktreeManager', () => {
  let manager: WorktreeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new WorktreeManager(makeConfig());
  });

  afterEach(() => {
    manager.stopAutoCleanup();
  });

  describe('constructor', () => {
    it('should create a manager with the given config', () => {
      expect(manager).toBeInstanceOf(WorktreeManager);
    });
  });

  describe('acquire', () => {
    it('should acquire a worktree lease successfully', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: {
          path: '/tmp/worktrees/autofix-fix-123',
          branch: 'fix/issue-123',
          status: 'active',
        },
      });

      const result = await manager.acquire('fix/issue-123', [123]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.worktree.path).toBe('/tmp/worktrees/autofix-fix-123');
        expect(result.data.leaseId).toBeDefined();
        expect(typeof result.data.release).toBe('function');
      }
    });

    it('should reject when max concurrent exceeded', async () => {
      const config = makeConfig({ maxConcurrent: 1 });
      const m = new WorktreeManager(config);
      const tool = getToolMock(m);

      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w1', branch: 'b1', status: 'active' },
      });

      // Acquire first
      await m.acquire('branch-1', [1]);

      // Second should fail
      const result = await m.acquire('branch-2', [2]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MAX_CONCURRENT_EXCEEDED');
      }

      m.stopAutoCleanup();
    });

    it('should handle tool.create failure', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: false,
        error: { code: 'GIT_ERROR', message: 'git failed' },
      });

      const result = await manager.acquire('fix/issue-123', [123]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ACQUIRE_FAILED');
        expect(result.error.message).toBe('git failed');
      }
    });

    it('should pass baseBranch to tool.create', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      await manager.acquire('branch', [1], 'main');
      expect(tool.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseBranch: 'main' })
      );
    });

    it('should default baseBranch to autofixing', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      await manager.acquire('branch', [1]);
      expect(tool.create).toHaveBeenCalledWith(
        expect.objectContaining({ baseBranch: 'autofixing' })
      );
    });
  });

  describe('release', () => {
    it('should release an active worktree', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });
      tool.remove.mockResolvedValue({ success: true, data: undefined });

      const result = await manager.acquire('branch', [1]);
      expect(result.success).toBe(true);
      if (result.success) {
        await result.data.release();
        expect(tool.remove).toHaveBeenCalledWith(
          expect.objectContaining({ path: '/tmp/w', force: true, deleteBranch: false })
        );
        expect(manager.getActiveCount()).toBe(0);
      }
    });

    it('should do nothing for unknown lease ID', async () => {
      const tool = getToolMock(manager);
      await manager.release('nonexistent-lease');
      expect(tool.remove).not.toHaveBeenCalled();
    });
  });

  describe('releaseAndCleanBranch', () => {
    it('should release worktree and delete branch', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });
      tool.remove.mockResolvedValue({ success: true, data: undefined });

      const result = await manager.acquire('branch', [1]);
      if (result.success) {
        await manager.releaseAndCleanBranch(result.data.leaseId);
        expect(tool.remove).toHaveBeenCalledWith(
          expect.objectContaining({ deleteBranch: true })
        );
      }
    });

    it('should do nothing for unknown lease ID', async () => {
      const tool = getToolMock(manager);
      await manager.releaseAndCleanBranch('nonexistent');
      expect(tool.remove).not.toHaveBeenCalled();
    });
  });

  describe('getActive', () => {
    it('should return empty array when no active worktrees', () => {
      expect(manager.getActive()).toEqual([]);
    });

    it('should return active worktrees', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w1', branch: 'b1', status: 'active' },
      });

      await manager.acquire('b1', [1]);
      const active = manager.getActive();
      expect(active).toHaveLength(1);
      expect(active[0]!.path).toBe('/tmp/w1');
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when empty', () => {
      expect(manager.getActiveCount()).toBe(0);
    });

    it('should count active worktrees', async () => {
      const tool = getToolMock(manager);
      tool.create
        .mockResolvedValueOnce({ success: true, data: { path: '/tmp/w1', branch: 'b1', status: 'active' } })
        .mockResolvedValueOnce({ success: true, data: { path: '/tmp/w2', branch: 'b2', status: 'active' } });

      await manager.acquire('b1', [1]);
      await manager.acquire('b2', [2]);
      expect(manager.getActiveCount()).toBe(2);
    });
  });

  describe('canAcquire', () => {
    it('should return true when under limit', () => {
      expect(manager.canAcquire()).toBe(true);
    });

    it('should return false when at limit', async () => {
      const config = makeConfig({ maxConcurrent: 1 });
      const m = new WorktreeManager(config);
      const tool = getToolMock(m);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      await m.acquire('b', [1]);
      expect(m.canAcquire()).toBe(false);

      m.stopAutoCleanup();
    });
  });

  describe('startAutoCleanup / stopAutoCleanup', () => {
    it('should start and stop cleanup interval', () => {
      vi.useFakeTimers();
      manager.startAutoCleanup();

      // Should not start a second interval
      manager.startAutoCleanup();

      manager.stopAutoCleanup();
      // Calling again should be a no-op
      manager.stopAutoCleanup();
      vi.useRealTimers();
    });
  });

  describe('runAutoCleanup', () => {
    it('should clean up stale worktrees', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });
      tool.remove.mockResolvedValue({ success: true, data: undefined });

      const result = await manager.acquire('b', [1]);
      if (result.success) {
        // Manually age the worktree entry
        const activeMap = (manager as any).activeWorktrees;
        const entry = activeMap.get(result.data.leaseId);
        if (entry) {
          // Set acquiredAt to 2 hours ago
          entry.acquiredAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
        }

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await manager.runAutoCleanup();
        warnSpy.mockRestore();

        expect(tool.remove).toHaveBeenCalled();
        expect(manager.getActiveCount()).toBe(0);
      }
    });

    it('should not clean up fresh worktrees', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      await manager.acquire('b', [1]);
      await manager.runAutoCleanup();

      expect(tool.remove).not.toHaveBeenCalled();
      expect(manager.getActiveCount()).toBe(1);
    });
  });

  describe('cleanupAll', () => {
    it('should release all active worktrees', async () => {
      const tool = getToolMock(manager);
      tool.create
        .mockResolvedValueOnce({ success: true, data: { path: '/tmp/w1', branch: 'b1', status: 'active' } })
        .mockResolvedValueOnce({ success: true, data: { path: '/tmp/w2', branch: 'b2', status: 'active' } });
      tool.remove.mockResolvedValue({ success: true, data: undefined });

      await manager.acquire('b1', [1]);
      await manager.acquire('b2', [2]);
      expect(manager.getActiveCount()).toBe(2);

      await manager.cleanupAll();
      expect(manager.getActiveCount()).toBe(0);
      expect(tool.remove).toHaveBeenCalledTimes(2);
    });

    it('should handle empty active set', async () => {
      await manager.cleanupAll();
      expect(manager.getActiveCount()).toBe(0);
    });
  });

  describe('listAll', () => {
    it('should list all worktrees from tool', async () => {
      const tool = getToolMock(manager);
      const worktrees = [
        { path: '/repo', branch: 'main', status: 'active' },
        { path: '/tmp/w1', branch: 'fix-1', status: 'active' },
      ];
      tool.list.mockResolvedValue({ success: true, data: worktrees });

      const result = await manager.listAll();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(worktrees);
      }
    });

    it('should handle tool.list failure', async () => {
      const tool = getToolMock(manager);
      tool.list.mockResolvedValue({
        success: false,
        error: { code: 'GIT_ERROR', message: 'list failed' },
      });

      const result = await manager.listAll();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CLEANUP_FAILED');
      }
    });
  });

  describe('cleanupOrphaned', () => {
    it('should clean up orphaned worktrees', async () => {
      const tool = getToolMock(manager);
      // Return worktrees including one orphaned (not in active map)
      tool.list.mockResolvedValue({
        success: true,
        data: [
          { path: '/repo', branch: 'main', status: 'active' },
          { path: '/tmp/autofix-orphan', branch: 'fix-orphan', status: 'active' },
        ],
      });
      tool.remove.mockResolvedValue({ success: true, data: undefined });

      const cleaned = await manager.cleanupOrphaned();
      // The orphaned one (with prefix) should be cleaned
      expect(cleaned).toBe(1);
      expect(tool.remove).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/tmp/autofix-orphan', deleteBranch: true })
      );
    });

    it('should skip main worktree (no prefix)', async () => {
      const tool = getToolMock(manager);
      tool.list.mockResolvedValue({
        success: true,
        data: [
          { path: '/repo', branch: 'main', status: 'active' },
        ],
      });

      const cleaned = await manager.cleanupOrphaned();
      expect(cleaned).toBe(0);
      expect(tool.remove).not.toHaveBeenCalled();
    });

    it('should skip active worktrees', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/autofix-active', branch: 'b1', status: 'active' },
      });

      await manager.acquire('b1', [1]);

      tool.list.mockResolvedValue({
        success: true,
        data: [
          { path: '/tmp/autofix-active', branch: 'b1', status: 'active' },
        ],
      });

      const cleaned = await manager.cleanupOrphaned();
      expect(cleaned).toBe(0);
    });

    it('should return 0 on list failure', async () => {
      const tool = getToolMock(manager);
      tool.list.mockResolvedValue({
        success: false,
        error: { code: 'GIT_ERROR', message: 'failed' },
      });

      const cleaned = await manager.cleanupOrphaned();
      expect(cleaned).toBe(0);
    });

    it('should ignore cleanup errors for individual worktrees', async () => {
      const tool = getToolMock(manager);
      tool.list.mockResolvedValue({
        success: true,
        data: [
          { path: '/tmp/autofix-orphan1', branch: 'f1', status: 'active' },
          { path: '/tmp/autofix-orphan2', branch: 'f2', status: 'active' },
        ],
      });
      tool.remove
        .mockRejectedValueOnce(new Error('remove failed'))
        .mockResolvedValueOnce({ success: true, data: undefined });

      const cleaned = await manager.cleanupOrphaned();
      // First one throws, second succeeds
      expect(cleaned).toBe(1);
    });
  });

  describe('updateStatus', () => {
    it('should update worktree status', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      const result = await manager.acquire('b', [1]);
      if (result.success) {
        manager.updateStatus(result.data.leaseId, 'completed');
        const info = manager.getByLeaseId(result.data.leaseId);
        expect(info?.status).toBe('completed');
      }
    });

    it('should do nothing for unknown lease ID', () => {
      manager.updateStatus('unknown', 'completed');
      // Should not throw
    });
  });

  describe('getByLeaseId', () => {
    it('should return worktree info for valid lease', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      const result = await manager.acquire('b', [1]);
      if (result.success) {
        const info = manager.getByLeaseId(result.data.leaseId);
        expect(info).toBeDefined();
        expect(info!.path).toBe('/tmp/w');
      }
    });

    it('should return undefined for unknown lease', () => {
      expect(manager.getByLeaseId('unknown')).toBeUndefined();
    });
  });

  describe('getByPath', () => {
    it('should return active worktree by path', async () => {
      const tool = getToolMock(manager);
      tool.create.mockResolvedValue({
        success: true,
        data: { path: '/tmp/w', branch: 'b', status: 'active' },
      });

      await manager.acquire('b', [1]);
      const active = manager.getByPath('/tmp/w');
      expect(active).toBeDefined();
      expect(active!.worktree.path).toBe('/tmp/w');
    });

    it('should return undefined for unknown path', () => {
      expect(manager.getByPath('/unknown')).toBeUndefined();
    });
  });
});

describe('createWorktreeManager', () => {
  it('should create a WorktreeManager from config', () => {
    const config = {
      worktree: {
        maxConcurrent: 5,
        autoCleanupMinutes: 30,
        baseDir: '/tmp/wt',
        prefix: 'fix-',
      },
    } as any;

    const m = createWorktreeManager(config, '/repo');
    expect(m).toBeInstanceOf(WorktreeManager);
    m.stopAutoCleanup();
  });

  it('should use defaults for missing config values', () => {
    const config = {
      worktree: {
        baseDir: '/tmp/wt',
      },
    } as any;

    const m = createWorktreeManager(config, '/repo');
    expect(m).toBeInstanceOf(WorktreeManager);
    m.stopAutoCleanup();
  });
});
