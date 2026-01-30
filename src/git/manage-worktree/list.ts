/**
 * @module git/manage-worktree/list
 * @description Git Worktree 목록 조회 기능
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import type {
  ListWorktreesParams,
  WorktreeInfo,
} from '../../common/types/index.js';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { WorktreeError } from './types.js';

/**
 * Worktree 목록 조회
 *
 * @param params - 조회 파라미터
 * @returns Worktree 목록
 */
export async function listWorktrees(
  params?: ListWorktreesParams,
  repoPath?: string
): Promise<Result<WorktreeInfo[], WorktreeError>> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const git: SimpleGit = simpleGit(repoPath ?? process.cwd());

    // git worktree list --porcelain 실행
    let output: string;
    try {
      output = await git.raw(['worktree', 'list', '--porcelain']);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err({
        code: 'GIT_ERROR',
        message: `Failed to list worktrees: ${errorMessage}`,
        cause: error instanceof Error ? error : new Error(errorMessage),
      });
    }

    // 출력 파싱
    const worktrees = parseWorktreeListOutput(output);

    // 필터링 적용
    let filteredWorktrees = worktrees;

    if (params?.status !== undefined) {
      filteredWorktrees = filteredWorktrees.filter(
        (wt) => wt.status === params.status
      );
    }

    if (params?.issueNumber !== undefined) {
      filteredWorktrees = filteredWorktrees.filter((wt) =>
        wt.issueNumbers.includes(params.issueNumber!)
      );
    }

    return ok(filteredWorktrees);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err({
      code: 'UNKNOWN_ERROR',
      message: `Unexpected error while listing worktrees: ${errorMessage}`,
      cause: error instanceof Error ? error : new Error(errorMessage),
    });
  }
}

/**
 * git worktree list --porcelain 출력 파싱
 *
 * 출력 형식:
 * ```
 * worktree /path/to/worktree
 * HEAD <commit-sha>
 * branch refs/heads/branch-name
 *
 * worktree /path/to/another
 * HEAD <commit-sha>
 * detached
 * ```
 */
function parseWorktreeListOutput(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const lines = output.split('\n');

  let currentPath = '';
  let currentBranch = '';
  let currentHead = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('worktree ')) {
      currentPath = trimmedLine.substring(9);
    } else if (trimmedLine.startsWith('HEAD ')) {
      currentHead = trimmedLine.substring(5);
    } else if (trimmedLine.startsWith('branch ')) {
      currentBranch = trimmedLine.substring(7).replace('refs/heads/', '');
    } else if (trimmedLine === 'detached') {
      currentBranch = 'detached';
    } else if (trimmedLine === '') {
      // 빈 줄 = 하나의 worktree 정보 완료
      if (currentPath !== '' && currentPath !== undefined) {
        const now = new Date();
        worktrees.push({
          path: currentPath,
          branch: currentBranch,
          status: 'ready', // 기본값, 실제 상태는 별도 확인 필요
          issueNumbers: [], // 이슈 번호는 별도 메타데이터에서 조회 필요
          createdAt: now, // 생성 시간은 별도 메타데이터에서 조회 필요
          lastActivityAt: now,
          headCommit: currentHead,
        });
      }

      // 리셋
      currentPath = '';
      currentBranch = '';
      currentHead = '';
    }
  }

  // 마지막 worktree 처리 (파일이 빈 줄 없이 끝나는 경우)
  if (currentPath !== '' && currentPath !== undefined) {
    const now = new Date();
    worktrees.push({
      path: currentPath,
      branch: currentBranch,
      status: 'ready',
      issueNumbers: [],
      createdAt: now,
      lastActivityAt: now,
      headCommit: currentHead,
    });
  }

  return worktrees;
}
