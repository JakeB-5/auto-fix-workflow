/**
 * @module commands/autofix/worktree-manager
 * @description Worktree state management and auto-cleanup
 */

import type { WorktreeInfo, WorktreeStatus, Config } from '../../common/types/index.js';
import type { Result } from '../../common/types/result.js';
import { ok, err, isSuccess } from '../../common/types/result.js';
import { WorktreeTool } from './mcp-tools/worktree.js';

/**
 * Worktree manager error
 */
export interface WorktreeManagerError {
  readonly code: WorktreeManagerErrorCode;
  readonly message: string;
  readonly worktreePath?: string;
}

export type WorktreeManagerErrorCode =
  | 'MAX_CONCURRENT_EXCEEDED'
  | 'WORKTREE_NOT_FOUND'
  | 'CLEANUP_FAILED'
  | 'ACQUIRE_FAILED';

/**
 * Worktree lease
 */
export interface WorktreeLease {
  readonly worktree: WorktreeInfo;
  readonly leaseId: string;
  release(): Promise<void>;
}

/**
 * Worktree manager configuration
 */
export interface WorktreeManagerConfig {
  readonly maxConcurrent: number;
  readonly autoCleanupMinutes: number;
  readonly baseDir: string;
  readonly prefix: string;
  readonly repoPath: string;
}

/**
 * Worktree Manager
 *
 * Manages worktree lifecycle, concurrency, and automatic cleanup
 */
export class WorktreeManager {
  private readonly config: WorktreeManagerConfig;
  private readonly tool: WorktreeTool;
  private readonly activeWorktrees: Map<string, ActiveWorktree> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval> | undefined;

  constructor(config: WorktreeManagerConfig) {
    this.config = config;
    this.tool = new WorktreeTool({
      baseDir: config.baseDir,
      prefix: config.prefix,
      repoPath: config.repoPath,
    });
  }

  /**
   * Acquire a worktree for processing
   */
  async acquire(
    branchName: string,
    issueNumbers: readonly number[],
    baseBranch: string = 'main'
  ): Promise<Result<WorktreeLease, WorktreeManagerError>> {
    // Check concurrency limit
    if (this.activeWorktrees.size >= this.config.maxConcurrent) {
      return err({
        code: 'MAX_CONCURRENT_EXCEEDED',
        message: `Maximum concurrent worktrees (${this.config.maxConcurrent}) exceeded`,
      });
    }

    // Create worktree
    const result = await this.tool.create({
      branchName,
      baseBranch,
      issueNumbers,
    });

    if (!isSuccess(result)) {
      return err({
        code: 'ACQUIRE_FAILED',
        message: result.error.message,
      });
    }

    const worktree = result.data;
    const leaseId = this.generateLeaseId();

    // Track active worktree
    this.activeWorktrees.set(leaseId, {
      worktree,
      leaseId,
      acquiredAt: new Date(),
      branchName,
    });

    // Create lease with release function
    const lease: WorktreeLease = {
      worktree,
      leaseId,
      release: () => this.release(leaseId),
    };

    return ok(lease);
  }

  /**
   * Release a worktree
   */
  async release(leaseId: string): Promise<void> {
    const active = this.activeWorktrees.get(leaseId);
    if (!active) {
      return;
    }

    this.activeWorktrees.delete(leaseId);

    // Remove worktree
    await this.tool.remove({
      path: active.worktree.path,
      force: true,
      deleteBranch: false, // Keep branch for PR
    });
  }

  /**
   * Release a worktree and delete branch
   */
  async releaseAndCleanBranch(leaseId: string): Promise<void> {
    const active = this.activeWorktrees.get(leaseId);
    if (!active) {
      return;
    }

    this.activeWorktrees.delete(leaseId);

    // Remove worktree and branch
    await this.tool.remove({
      path: active.worktree.path,
      force: true,
      deleteBranch: true,
    });
  }

  /**
   * Get all active worktrees
   */
  getActive(): readonly WorktreeInfo[] {
    return [...this.activeWorktrees.values()].map(a => a.worktree);
  }

  /**
   * Get count of active worktrees
   */
  getActiveCount(): number {
    return this.activeWorktrees.size;
  }

  /**
   * Check if can acquire more worktrees
   */
  canAcquire(): boolean {
    return this.activeWorktrees.size < this.config.maxConcurrent;
  }

  /**
   * Start automatic cleanup interval
   */
  startAutoCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    const cleanupMs = this.config.autoCleanupMinutes * 60 * 1000;

    this.cleanupInterval = setInterval(
      () => this.runAutoCleanup(),
      cleanupMs / 2 // Check twice as often as the cleanup threshold
    );
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Run automatic cleanup of stale worktrees
   */
  async runAutoCleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = this.config.autoCleanupMinutes * 60 * 1000;

    for (const [leaseId, active] of this.activeWorktrees) {
      const age = now - active.acquiredAt.getTime();

      if (age > maxAge) {
        console.warn(`Auto-cleaning stale worktree: ${active.worktree.path}`);
        await this.releaseAndCleanBranch(leaseId);
      }
    }
  }

  /**
   * Clean up all worktrees (for shutdown)
   */
  async cleanupAll(): Promise<void> {
    const leaseIds = [...this.activeWorktrees.keys()];

    for (const leaseId of leaseIds) {
      await this.releaseAndCleanBranch(leaseId);
    }
  }

  /**
   * List all worktrees (including those not managed)
   */
  async listAll(): Promise<Result<WorktreeInfo[], WorktreeManagerError>> {
    const result = await this.tool.list();

    if (!isSuccess(result)) {
      return err({
        code: 'CLEANUP_FAILED',
        message: result.error.message,
      });
    }

    return ok(result.data);
  }

  /**
   * Clean up orphaned worktrees (those not in active list)
   */
  async cleanupOrphaned(): Promise<number> {
    const listResult = await this.listAll();
    if (!isSuccess(listResult)) {
      return 0;
    }

    const activePaths = new Set(
      [...this.activeWorktrees.values()].map(a => a.worktree.path)
    );

    let cleaned = 0;

    for (const worktree of listResult.data) {
      // Skip main worktree
      if (!worktree.path.includes(this.config.prefix)) {
        continue;
      }

      // Skip active worktrees
      if (activePaths.has(worktree.path)) {
        continue;
      }

      // Clean up orphaned
      try {
        await this.tool.remove({
          path: worktree.path,
          force: true,
          deleteBranch: true,
        });
        cleaned++;
      } catch {
        // Ignore cleanup errors
      }
    }

    return cleaned;
  }

  /**
   * Update worktree status
   */
  updateStatus(leaseId: string, status: WorktreeStatus): void {
    const active = this.activeWorktrees.get(leaseId);
    if (active) {
      (active.worktree as { status: WorktreeStatus }).status = status;
    }
  }

  /**
   * Get worktree by lease ID
   */
  getByLeaseId(leaseId: string): WorktreeInfo | undefined {
    return this.activeWorktrees.get(leaseId)?.worktree;
  }

  /**
   * Get worktree by path
   */
  getByPath(path: string): ActiveWorktree | undefined {
    for (const active of this.activeWorktrees.values()) {
      if (active.worktree.path === path) {
        return active;
      }
    }
    return undefined;
  }

  /**
   * Generate unique lease ID
   */
  private generateLeaseId(): string {
    return `lease-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Active worktree tracking
 */
interface ActiveWorktree {
  worktree: WorktreeInfo;
  leaseId: string;
  acquiredAt: Date;
  branchName: string;
}

/**
 * Create worktree manager from config
 */
export function createWorktreeManager(config: Config, repoPath: string): WorktreeManager {
  return new WorktreeManager({
    maxConcurrent: config.worktree.maxConcurrent ?? 3,
    autoCleanupMinutes: config.worktree.autoCleanupMinutes ?? 60,
    baseDir: config.worktree.baseDir,
    prefix: config.worktree.prefix ?? 'autofix-',
    repoPath,
  });
}
