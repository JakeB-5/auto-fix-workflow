/**
 * @module commands/autofix/pipeline/stages/commit-stage
 * @description Commit changes stage
 */

import type { Result } from '../../../../common/types/result.js';
import { ok, err, isSuccess } from '../../../../common/types/result.js';
import type { PipelineContext, PipelineStage } from '../../types.js';
import type { WorktreeStage } from './worktree-stage.js';

/**
 * Commit stage error
 */
export interface CommitStageError {
  readonly code: 'COMMIT_FAILED' | 'PUSH_FAILED' | 'INVALID_STATE';
  readonly message: string;
}

/**
 * Commit Stage
 *
 * Handles committing changes and pushing to remote
 */
export class CommitStage {
  readonly stageName: PipelineStage = 'commit';

  /**
   * Commit changes and push to remote
   */
  async execute(
    context: PipelineContext,
    worktreeStage: WorktreeStage
  ): Promise<Result<void, CommitStageError>> {
    if (!context.worktree || !context.fixResult) {
      return err({ code: 'INVALID_STATE', message: 'Missing prerequisites for commit' });
    }

    // Commit changes
    const commitMessage = context.fixResult.commitMessage.replace(/"/g, '\\"');
    const commitResult = await worktreeStage.execInWorktree(
      context.worktree.path,
      `commit -am "${commitMessage}"`
    );

    if (!isSuccess(commitResult)) {
      return err({ code: 'COMMIT_FAILED', message: `Commit failed: ${commitResult.error.message}` });
    }

    // Push branch to remote (required for PR creation)
    const pushResult = await worktreeStage.execInWorktree(
      context.worktree.path,
      `push -u origin ${context.worktree.branch}`
    );

    if (!isSuccess(pushResult)) {
      return err({ code: 'PUSH_FAILED', message: `Push failed: ${pushResult.error.message}` });
    }

    return ok(undefined);
  }
}

/**
 * Create commit stage
 */
export function createCommitStage(): CommitStage {
  return new CommitStage();
}
