/**
 * @module commands/autofix/pipeline/stages/worktree-stage
 * @description Worktree creation and cleanup stage
 */

import type { WorktreeInfo, Config } from '../../../../common/types/index.js';
import type { Result } from '../../../../common/types/result.js';
import { ok, err, isSuccess } from '../../../../common/types/result.js';
import type { PipelineContext, PipelineStage } from '../../types.js';
import { WorktreeTool, type WorktreeError, type WorktreeConfig } from '../../mcp-tools/worktree.js';

/**
 * Worktree stage configuration
 */
export interface WorktreeStageConfig {
  readonly worktreeConfig: WorktreeConfig;
  readonly baseBranch: string;
}

/**
 * Worktree Stage
 *
 * Handles worktree creation for isolated development and cleanup after processing
 */
export class WorktreeStage {
  readonly stageName: PipelineStage = 'worktree_create';
  private readonly worktreeTool: WorktreeTool;
  private readonly baseBranch: string;

  constructor(config: WorktreeStageConfig) {
    this.worktreeTool = new WorktreeTool(config.worktreeConfig);
    this.baseBranch = config.baseBranch;
  }

  /**
   * Create worktree for the group
   */
  async execute(context: PipelineContext): Promise<Result<WorktreeInfo, WorktreeError>> {
    return this.worktreeTool.create({
      branchName: context.group.branchName,
      baseBranch: this.baseBranch,
      issueNumbers: context.group.issues.map(i => i.number),
    });
  }

  /**
   * Cleanup worktree
   */
  async cleanup(context: PipelineContext, keepBranch: boolean = false): Promise<void> {
    if (!context.worktree) {
      return;
    }

    await this.worktreeTool.remove({
      path: context.worktree.path,
      force: true,
      deleteBranch: !keepBranch,
    });
  }

  /**
   * Check for uncommitted changes in worktree
   */
  async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
    const result = await this.worktreeTool.execInWorktree(worktreePath, 'status --porcelain');
    if (!isSuccess(result)) {
      return false;
    }
    return result.data.stdout.trim().length > 0;
  }

  /**
   * Execute git command in worktree
   */
  async execInWorktree(
    worktreePath: string,
    command: string
  ): Promise<Result<{ stdout: string; stderr: string }, WorktreeError>> {
    return this.worktreeTool.execInWorktree(worktreePath, command);
  }
}

/**
 * Create worktree stage from config
 */
export function createWorktreeStage(
  config: Config,
  repoPath: string,
  baseBranch: string
): WorktreeStage {
  return new WorktreeStage({
    worktreeConfig: {
      baseDir: config.worktree.baseDir,
      prefix: config.worktree.prefix ?? 'autofix-',
      repoPath,
    },
    baseBranch,
  });
}
