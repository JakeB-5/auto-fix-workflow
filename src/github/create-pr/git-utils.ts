/**
 * @module github/create-pr/git-utils
 * @description Git 유틸리티 함수
 */

import { simpleGit, type SimpleGit } from 'simple-git';
import { ok, err, type Result } from '../../common/types/index.js';
import type { BranchInfo } from './types.js';

/**
 * SimpleGit 인스턴스 생성
 *
 * @param workingDir - Git 작업 디렉토리 (선택사항)
 * @returns SimpleGit 인스턴스
 */
export function createGit(workingDir?: string): SimpleGit {
  return simpleGit(workingDir);
}

/**
 * 현재 브랜치 이름 가져오기
 *
 * @param git - SimpleGit 인스턴스
 * @returns 브랜치 이름
 */
export async function getCurrentBranch(
  git: SimpleGit
): Promise<Result<string, Error>> {
  try {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return ok(branch.trim());
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to get current branch')
    );
  }
}

/**
 * 브랜치 정보 가져오기
 *
 * @param git - SimpleGit 인스턴스
 * @param branchName - 브랜치 이름
 * @returns 브랜치 정보
 */
export async function getBranchInfo(
  git: SimpleGit,
  branchName: string
): Promise<Result<BranchInfo, Error>> {
  try {
    // 브랜치 존재 확인
    const branches = await git.branch();
    const branch = branches.all.find((b) => b === branchName || b === `remotes/origin/${branchName}`);

    if (!branch) {
      return err(new Error(`Branch not found: ${branchName}`));
    }

    // 최신 커밋 해시 가져오기
    const commit = await git.revparse([branchName]);

    // 리모트 추적 확인
    const trackingBranch = await git.revparse(['--abbrev-ref', `${branchName}@{upstream}`])
      .then(() => true)
      .catch(() => false);

    return ok({
      name: branchName,
      commit: commit.trim(),
      isTracking: trackingBranch,
    });
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to get branch info: ${branchName}`)
    );
  }
}

/**
 * 커밋 메시지 목록 가져오기
 *
 * @param git - SimpleGit 인스턴스
 * @param from - 시작 지점 (base 브랜치)
 * @param to - 종료 지점 (head 브랜치, 기본값: HEAD)
 * @returns 커밋 메시지 목록
 */
export async function getCommitMessages(
  git: SimpleGit,
  from: string,
  to: string = 'HEAD'
): Promise<Result<string[], Error>> {
  try {
    const log = await git.log({
      from,
      to,
    });

    const messages = log.all.map((commit) => commit.message);
    return ok(messages);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to get commit messages')
    );
  }
}

/**
 * 브랜치가 최신 상태인지 확인
 *
 * @param git - SimpleGit 인스턴스
 * @param branchName - 브랜치 이름
 * @returns 최신 상태 여부
 */
export async function isBranchUpToDate(
  git: SimpleGit,
  branchName: string
): Promise<Result<boolean, Error>> {
  try {
    // fetch 먼저 실행
    await git.fetch();

    // 로컬과 리모트 커밋 비교
    const localCommit = await git.revparse([branchName]);
    const remoteCommit = await git.revparse([`origin/${branchName}`])
      .catch(() => localCommit); // 리모트가 없으면 로컬과 동일하다고 간주

    return ok(localCommit.trim() === remoteCommit.trim());
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to check branch status')
    );
  }
}

/**
 * 변경사항이 있는지 확인
 *
 * @param git - SimpleGit 인스턴스
 * @returns 변경사항 존재 여부
 */
export async function hasChanges(
  git: SimpleGit
): Promise<Result<boolean, Error>> {
  try {
    const status = await git.status();
    const hasChanges =
      status.files.length > 0 ||
      status.staged.length > 0 ||
      status.modified.length > 0;

    return ok(hasChanges);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error('Failed to check git status')
    );
  }
}

/**
 * 브랜치를 리모트에 푸시
 *
 * @param git - SimpleGit 인스턴스
 * @param branchName - 브랜치 이름
 * @param force - 강제 푸시 여부 (기본값: false)
 * @returns 푸시 성공 여부
 */
export async function pushBranch(
  git: SimpleGit,
  branchName: string,
  force: boolean = false
): Promise<Result<void, Error>> {
  try {
    const options = force ? ['--force'] : [];
    await git.push('origin', branchName, options);
    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to push branch: ${branchName}`)
    );
  }
}

/**
 * 브랜치 간 차이점 확인
 *
 * @param git - SimpleGit 인스턴스
 * @param base - 베이스 브랜치
 * @param head - 헤드 브랜치
 * @returns 차이가 있는지 여부
 */
export async function hasDifference(
  git: SimpleGit,
  base: string,
  head: string
): Promise<Result<boolean, Error>> {
  try {
    const diff = await git.diff([`${base}...${head}`]);
    return ok(diff.length > 0);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to check difference between branches')
    );
  }
}

/**
 * Git 리포지토리 초기화 여부 확인
 *
 * @param git - SimpleGit 인스턴스
 * @returns Git 리포지토리 여부
 */
export async function isGitRepository(
  git: SimpleGit
): Promise<Result<boolean, Error>> {
  try {
    const isRepo = await git.checkIsRepo();
    return ok(isRepo);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to check if directory is a git repository')
    );
  }
}

/**
 * 리모트 URL 가져오기
 *
 * @param git - SimpleGit 인스턴스
 * @param remoteName - 리모트 이름 (기본값: origin)
 * @returns 리모트 URL
 */
export async function getRemoteUrl(
  git: SimpleGit,
  remoteName: string = 'origin'
): Promise<Result<string, Error>> {
  try {
    const remotes = await git.getRemotes(true);
    const remote = remotes.find((r) => r.name === remoteName);

    if (!remote) {
      return err(new Error(`Remote not found: ${remoteName}`));
    }

    return ok(remote.refs.fetch);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error('Failed to get remote URL')
    );
  }
}
