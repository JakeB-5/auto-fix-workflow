/**
 * @module git/manage-worktree/create
 * @description Git Worktree 생성 기능
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import { resolve, isAbsolute } from 'path';
import type {
  CreateWorktreeParams,
  WorktreeInfo,
} from '../../common/types/index.js';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { WorktreeError, WorktreeOptions } from './types.js';

/**
 * Worktree 생성
 *
 * @param params - 생성 파라미터
 * @param options - Worktree 옵션
 * @returns 생성된 Worktree 정보
 */
export async function createWorktree(
  params: CreateWorktreeParams,
  options: WorktreeOptions
): Promise<Result<WorktreeInfo, WorktreeError>> {
  // 파라미터 검증
  if (!params.branchName || params.branchName.trim() === '') {
    return err({
      code: 'INVALID_BRANCH',
      message: 'Branch name is required',
    });
  }

  if (params.issueNumbers.length === 0) {
    return err({
      code: 'INVALID_BRANCH',
      message: 'At least one issue number is required',
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const git: SimpleGit = simpleGit(options.repoPath ?? process.cwd());

    // 브랜치 이름 정규화
    const branchName = params.branchName.trim();
    const baseBranch = params.baseBranch ?? options.defaultBaseBranch;

    // Worktree 경로 결정
    const worktreePath =
      params.path !== undefined && params.path !== null && params.path !== ''
        ? isAbsolute(params.path)
          ? params.path
          : resolve(options.basePath, params.path)
        : resolve(options.basePath, branchName);

    // 베이스 브랜치 존재 확인
    try {
      await git.revparse([baseBranch]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err({
        code: 'BRANCH_NOT_FOUND',
        message: `Base branch '${baseBranch}' not found`,
        cause: error instanceof Error ? error : new Error(errorMessage),
      });
    }

    // 브랜치가 이미 존재하는지 확인
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      return err({
        code: 'BRANCH_EXISTS',
        message: `Branch '${branchName}' already exists`,
      });
    }

    // Worktree 생성 (새 브랜치와 함께)
    try {
      await git.raw([
        'worktree',
        'add',
        '-b',
        branchName,
        worktreePath,
        baseBranch,
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err({
        code: 'GIT_ERROR',
        message: `Failed to create worktree: ${errorMessage}`,
        cause: error instanceof Error ? error : new Error(errorMessage),
      });
    }

    // 생성된 Worktree의 HEAD 커밋 조회
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const worktreeGit: SimpleGit = simpleGit(worktreePath);
    const log = await worktreeGit.log({ maxCount: 1 });
    const headCommit = log.latest?.hash;

    const now = new Date();
    const worktreeInfo: WorktreeInfo = {
      path: worktreePath,
      branch: branchName,
      status: 'ready',
      issueNumbers: params.issueNumbers,
      createdAt: now,
      lastActivityAt: now,
      headCommit,
    };

    return ok(worktreeInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err({
      code: 'UNKNOWN_ERROR',
      message: `Unexpected error while creating worktree: ${errorMessage}`,
      cause: error instanceof Error ? error : new Error(errorMessage),
    });
  }
}
