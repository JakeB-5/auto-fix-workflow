/**
 * @module github/create-pr/create-pr
 * @description PR 생성 핵심 로직
 */

import { Octokit } from '@octokit/rest';
import type { SimpleGit } from 'simple-git';
import { ok, err, isFailure, type Result } from '../../common/types/index.js';
import type { PullRequest } from '../../common/types/index.js';
import type { CreatePRParams } from './types.js';
import {
  GitHubApiError,
  GitHubApiErrorCode,
  handleOctokitError,
} from './error-handling.js';

/**
 * GitHub Pull Request 생성
 *
 * @param octokit - Octokit 인스턴스
 * @param params - PR 생성 파라미터
 * @returns 생성된 Pull Request
 *
 * @example
 * ```typescript
 * const result = await createPR(octokit, {
 *   owner: 'myorg',
 *   repo: 'myrepo',
 *   title: 'Fix: resolve #123',
 *   body: 'This PR fixes issue #123',
 *   head: 'feature/fix-123',
 *   base: 'main',
 *   draft: false,
 *   issueNumbers: [123]
 * });
 *
 * if (result.success) {
 *   console.log('PR created:', result.data.url);
 * }
 * ```
 */
export async function createPR(
  octokit: Octokit,
  params: CreatePRParams
): Promise<Result<PullRequest, GitHubApiError>> {
  try {
    // 1. 브랜치 존재 확인
    const branchCheckResult = await checkBranchExists(
      octokit,
      params.owner,
      params.repo,
      params.head
    );

    if (isFailure(branchCheckResult)) {
      return err(branchCheckResult.error);
    }

    // 2. PR 생성
    const response = await octokit.rest.pulls.create({
      owner: params.owner,
      repo: params.repo,
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
      draft: params.draft ?? false,
    });

    const pr = response.data;

    if (!pr) {
      return err(
        new GitHubApiError(
          GitHubApiErrorCode.UNKNOWN,
          'Failed to create PR: No data returned from GitHub API'
        )
      );
    }

    // 3. 라벨 추가 (있는 경우)
    // Note: labels는 params에 포함되어야 하지만 CreatePRParams에 없으므로 생략
    // 실제 사용 시 params에 labels를 추가하거나 별도 함수로 처리

    // 4. PullRequest 객체 변환
    const pullRequest: PullRequest = {
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      state: mapPRState(pr.state, pr.draft),
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      linkedIssues: params.issueNumbers ?? [],
      labels: pr.labels.map((label) =>
        typeof label === 'string' ? label : label.name ?? ''
      ),
      reviewers: pr.requested_reviewers?.map((r) => r.login) ?? [],
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      url: pr.html_url,
      changedFiles: pr.changed_files ?? 0,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
    };

    return ok(pullRequest);
  } catch (error) {
    return err(handleOctokitError(error));
  }
}

/**
 * 브랜치 존재 확인
 */
async function checkBranchExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<Result<void, GitHubApiError>> {
  try {
    await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch,
    });
    return ok(undefined);
  } catch (error) {
    if (isOctokitError(error) && error.status === 404) {
      return err(
        new GitHubApiError(
          GitHubApiErrorCode.NOT_FOUND,
          `Branch not found: ${branch}`,
          404
        )
      );
    }
    return err(handleOctokitError(error));
  }
}

/**
 * PR 상태 매핑
 */
function mapPRState(
  state: string,
  draft?: boolean
): PullRequest['state'] {
  if (draft) {
    return 'draft';
  }

  switch (state) {
    case 'open':
      return 'open';
    case 'closed':
      return 'closed';
    default:
      return 'open';
  }
}

/**
 * PR에 라벨 추가
 *
 * @param octokit - Octokit 인스턴스
 * @param owner - 리포지토리 소유자
 * @param repo - 리포지토리 이름
 * @param prNumber - PR 번호
 * @param labels - 추가할 라벨 목록
 * @returns 성공 여부
 */
export async function addLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  labels: readonly string[]
): Promise<Result<void, GitHubApiError>> {
  if (labels.length === 0) {
    return ok(undefined);
  }

  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: [...labels],
    });
    return ok(undefined);
  } catch (error) {
    return err(handleOctokitError(error));
  }
}

/**
 * PR에 리뷰어 추가
 *
 * @param octokit - Octokit 인스턴스
 * @param owner - 리포지토리 소유자
 * @param repo - 리포지토리 이름
 * @param prNumber - PR 번호
 * @param reviewers - 리뷰어 username 목록
 * @returns 성공 여부
 */
export async function addReviewers(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewers: readonly string[]
): Promise<Result<void, GitHubApiError>> {
  if (reviewers.length === 0) {
    return ok(undefined);
  }

  try {
    await octokit.rest.pulls.requestReviewers({
      owner,
      repo,
      pull_number: prNumber,
      reviewers: [...reviewers],
    });
    return ok(undefined);
  } catch (error) {
    return err(handleOctokitError(error));
  }
}

/**
 * 기존 PR 확인 (동일한 head와 base)
 *
 * @param octokit - Octokit 인스턴스
 * @param owner - 리포지토리 소유자
 * @param repo - 리포지토리 이름
 * @param head - 헤드 브랜치
 * @param base - 베이스 브랜치
 * @returns 존재하는 PR (없으면 null)
 */
export async function findExistingPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  head: string,
  base: string
): Promise<Result<PullRequest | null, GitHubApiError>> {
  try {
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${head}`,
      base,
      state: 'open',
    });

    if (response.data.length === 0) {
      return ok(null);
    }

    const pr = response.data[0]!;
    const pullRequest: PullRequest = {
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      state: mapPRState(pr.state, pr.draft),
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      linkedIssues: [],
      labels: pr.labels.map((label) =>
        typeof label === 'string' ? label : label.name ?? ''
      ),
      reviewers: pr.requested_reviewers?.map((r) => r.login) ?? [],
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
      url: pr.html_url,
      changedFiles: 0,
      additions: 0,
      deletions: 0,
    };

    return ok(pullRequest);
  } catch (error) {
    return err(handleOctokitError(error));
  }
}

/**
 * Octokit 오류 타입 가드
 */
function isOctokitError(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}
