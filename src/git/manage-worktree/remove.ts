/**
 * @module git/manage-worktree/remove
 * @description Git Worktree 제거 기능
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import type { RemoveWorktreeParams } from '../../common/types/index.js';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { WorktreeError } from './types.js';

/**
 * Worktree 제거
 *
 * @param params - 제거 파라미터
 * @returns 제거 결과
 */
export async function removeWorktree(
  params: RemoveWorktreeParams,
  repoPath?: string
): Promise<Result<void, WorktreeError>> {
  // 파라미터 검증
  if (!params.path || params.path.trim() === '') {
    return err({
      code: 'INVALID_PATH',
      message: 'Worktree path is required',
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const git: SimpleGit = simpleGit(repoPath ?? process.cwd());

    const worktreePath = params.path.trim();
    const force = params.force ?? false;
    const deleteBranch = params.deleteBranch ?? true;

    // Worktree 목록에서 해당 경로가 있는지 확인
    let branchName: string | undefined;
    try {
      const worktreeList = await git.raw(['worktree', 'list', '--porcelain']);
      const worktrees = parseWorktreeList(worktreeList);
      const targetWorktree = worktrees.find(
        (wt) => wt.path === worktreePath
      );

      if (targetWorktree === undefined) {
        return err({
          code: 'WORKTREE_NOT_FOUND',
          message: `Worktree not found at path: ${worktreePath}`,
        });
      }

      branchName = targetWorktree.branch;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err({
        code: 'GIT_ERROR',
        message: `Failed to list worktrees: ${errorMessage}`,
        cause: error instanceof Error ? error : new Error(errorMessage),
      });
    }

    // Worktree 제거
    try {
      const removeArgs = ['worktree', 'remove', worktreePath];
      if (force) {
        removeArgs.push('--force');
      }
      await git.raw(removeArgs);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err({
        code: 'GIT_ERROR',
        message: `Failed to remove worktree: ${errorMessage}`,
        cause: error instanceof Error ? error : new Error(errorMessage),
      });
    }

    // 브랜치 삭제 (요청된 경우)
    if (deleteBranch && branchName !== undefined && branchName !== '') {
      try {
        const deleteArgs = ['branch'];
        if (force) {
          deleteArgs.push('-D');
        } else {
          deleteArgs.push('-d');
        }
        deleteArgs.push(branchName);
        await git.raw(deleteArgs);
      } catch (error) {
        // 브랜치 삭제 실패는 경고로 처리 (Worktree는 이미 제거됨)
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `Warning: Failed to delete branch '${branchName}': ${errorMessage}`
        );
      }
    }

    return ok(undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err({
      code: 'UNKNOWN_ERROR',
      message: `Unexpected error while removing worktree: ${errorMessage}`,
      cause: error instanceof Error ? error : new Error(errorMessage),
    });
  }
}

/**
 * Worktree 목록 파싱
 */
interface ParsedWorktree {
  path: string;
  branch?: string;
}

function parseWorktreeList(output: string): ParsedWorktree[] {
  const worktrees: ParsedWorktree[] = [];
  const lines = output.split('\n');
  let currentWorktree: Partial<ParsedWorktree> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (
        currentWorktree.path !== undefined &&
        currentWorktree.path !== ''
      ) {
        worktrees.push(currentWorktree as ParsedWorktree);
      }
      currentWorktree = { path: line.substring(9) };
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring(7).replace('refs/heads/', '');
    } else if (line === '') {
      if (
        currentWorktree.path !== undefined &&
        currentWorktree.path !== ''
      ) {
        worktrees.push(currentWorktree as ParsedWorktree);
        currentWorktree = {};
      }
    }
  }

  if (
    currentWorktree.path !== undefined &&
    currentWorktree.path !== ''
  ) {
    worktrees.push(currentWorktree as ParsedWorktree);
  }

  return worktrees;
}
