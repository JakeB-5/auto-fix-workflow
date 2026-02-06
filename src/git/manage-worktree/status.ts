/**
 * @module git/manage-worktree/status
 * @description Worktree 상태 조회 기능
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { stat } from 'fs/promises';
import type { WorktreeInfo } from '../../common/types/index.js';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { WorktreeError } from './types.js';

/**
 * Worktree 상태 조회
 *
 * @param path - Worktree 경로
 * @returns Worktree 상태 정보
 */
export async function getWorktreeStatus(
  path: string
): Promise<Result<WorktreeInfo, WorktreeError>> {
  // 경로 검증
  if (path === '' || path.trim() === '') {
    return err({
      code: 'INVALID_PATH',
      message: 'Worktree path is required',
    });
  }

  try {

    const worktreePath = path.trim();

    // 경로 존재 확인
    if (!existsSync(worktreePath)) {
      return err({
        code: 'WORKTREE_NOT_FOUND',
        message: `Worktree not found at path: ${worktreePath}`,
      });
    }

    // Git 저장소 확인
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const git: SimpleGit = simpleGit(worktreePath);
    let isRepo: boolean;
    try {
      await git.revparse(['--git-dir']);
      isRepo = true;
    } catch {
      isRepo = false;
    }

    if (!isRepo) {
      return err({
        code: 'INVALID_PATH',
        message: `Path is not a git worktree: ${worktreePath}`,
      });
    }

    // 브랜치 정보 조회
    let branch: string;
    try {
      const branchInfo = await git.revparse(['--abbrev-ref', 'HEAD']);
      branch = branchInfo.trim();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err({
        code: 'GIT_ERROR',
        message: `Failed to get branch info: ${errorMessage}`,
        cause: error instanceof Error ? error : new Error(errorMessage),
      });
    }

    // HEAD 커밋 조회
    let headCommit: string | undefined;
    try {
      const log = await git.log({ maxCount: 1 });
      headCommit = log.latest?.hash;
    } catch (error) {
      // HEAD 커밋 조회 실패는 경고로 처리
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to get HEAD commit: ${errorMessage}`);
    }

    // Git 상태 조회 (변경사항 확인)
    let hasChanges = false;
    try {
      const status = await git.status();
      hasChanges =
        status.files.length > 0 ||
        status.staged.length > 0 ||
        status.modified.length > 0 ||
        status.created.length > 0 ||
        status.deleted.length > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to get git status: ${errorMessage}`);
    }

    // 디렉토리 수정 시간 조회 (최근 활동 추정)
    let lastActivityAt = new Date();
    try {
      const stats = await stat(worktreePath);
      lastActivityAt = stats.mtime;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to get directory stats: ${errorMessage}`);
    }

    // Worktree 정보 구성
    const worktreeInfo: WorktreeInfo = {
      path: worktreePath,
      branch,
      status: hasChanges ? 'in_use' : 'ready',
      issueNumbers: [], // 이슈 번호는 별도 메타데이터에서 조회 필요
      createdAt: new Date(), // 생성 시간은 별도 메타데이터에서 조회 필요
      lastActivityAt,
      headCommit: headCommit ?? '',
    };

    return ok(worktreeInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err({
      code: 'UNKNOWN_ERROR',
      message: `Unexpected error while getting worktree status: ${errorMessage}`,
      cause: error instanceof Error ? error : new Error(errorMessage),
    });
  }
}
