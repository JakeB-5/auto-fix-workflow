/**
 * @module github/create-pr/tool
 * @description MCP Tool 등록
 */

import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import type { Issue } from '../../common/types/index.js';
import { createPR, addLabels, addReviewers, findExistingPR } from './create-pr.js';
import { createGit, getCurrentBranch } from './git-utils.js';
import { generatePRTitle } from './title-generator.js';
import { generatePRBody } from './body-generator.js';
import { extractChanges } from './changes-extractor.js';
import { generateLabels } from './labels.js';
import type { CreatePRParams } from './types.js';
import { isSuccess, isFailure } from '../../common/types/index.js';

/**
 * create-pr Tool 입력 스키마
 */
export const createPRInputSchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  title: z.string().optional().describe('PR title (auto-generated if not provided)'),
  body: z.string().optional().describe('PR body (auto-generated if not provided)'),
  head: z.string().optional().describe('Source branch (current branch if not provided)'),
  base: z.string().default('autofixing').describe('Target branch (default: autofixing)'),
  draft: z.boolean().default(false).describe('Create as draft PR'),
  issueNumbers: z.array(z.number()).optional().describe('Issue numbers to link'),
  labels: z.array(z.string()).optional().describe('Labels to add (auto-generated if not provided)'),
  reviewers: z.array(z.string()).optional().describe('Reviewers to request'),
  token: z.string().describe('GitHub personal access token'),
  workingDir: z.string().optional().describe('Git working directory (default: current directory)'),
});

export type CreatePRInput = z.infer<typeof createPRInputSchema>;

/**
 * create-pr Tool 실행
 *
 * @param input - Tool 입력 파라미터
 * @returns Tool 실행 결과
 */
export async function executeCreatePRTool(input: CreatePRInput): Promise<{
  success: boolean;
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    state: string;
  };
  error?: string;
}> {
  try {
    const octokit = new Octokit({ auth: input.token });
    const git = createGit(input.workingDir);

    // 1. 현재 브랜치 가져오기 (head가 제공되지 않은 경우)
    let headBranch = input.head;
    if (!headBranch) {
      const branchResult = await getCurrentBranch(git);
      if (isFailure(branchResult)) {
        return {
          success: false,
          error: `Failed to get current branch: ${branchResult.error.message}`,
        };
      }
      headBranch = branchResult.data;
    }

    // 2. 기존 PR 확인
    const existingPRResult = await findExistingPR(
      octokit,
      input.owner,
      input.repo,
      headBranch,
      input.base
    );

    if (existingPRResult.success && existingPRResult.data) {
      return {
        success: false,
        error: `A pull request already exists: ${existingPRResult.data.url}`,
      };
    }

    // 3. 이슈 정보 가져오기 (제목/본문 자동 생성을 위해)
    let issues: Issue[] = [];
    if (input.issueNumbers && input.issueNumbers.length > 0) {
      issues = await fetchIssues(octokit, input.owner, input.repo, input.issueNumbers);
    }

    // 4. 변경사항 추출 (본문 자동 생성을 위해)
    const changesResult = await extractChanges(git, input.base, headBranch);
    const changes = isSuccess(changesResult) ? changesResult.data : undefined;

    // 5. 제목 생성 (제공되지 않은 경우)
    const title = input.title || (issues.length > 0
      ? generatePRTitle(issues)
      : `chore: update from ${headBranch}`);

    // 6. 본문 생성 (제공되지 않은 경우)
    const body = input.body || generatePRBody(issues, changes);

    // 7. 라벨 생성 (제공되지 않은 경우)
    const labels = input.labels || (issues.length > 0 || changes
      ? generateLabels(issues, changes)
      : []);

    // 8. PR 생성
    const params: CreatePRParams = {
      owner: input.owner,
      repo: input.repo,
      title,
      body,
      head: headBranch,
      base: input.base,
      draft: input.draft,
      ...(input.issueNumbers && { issueNumbers: input.issueNumbers }),
    };

    const createResult = await createPR(octokit, params);

    if (isFailure(createResult)) {
      return {
        success: false,
        error: createResult.error.toUserMessage(),
      };
    }

    const pr = createResult.data;

    // 9. 라벨 추가
    if (labels.length > 0) {
      await addLabels(octokit, input.owner, input.repo, pr.number, labels);
    }

    // 10. 리뷰어 추가
    if (input.reviewers && input.reviewers.length > 0) {
      await addReviewers(octokit, input.owner, input.repo, pr.number, input.reviewers);
    }

    return {
      success: true,
      pullRequest: {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * 이슈 목록 가져오기
 */
async function fetchIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumbers: number[]
): Promise<Issue[]> {
  const issues: Issue[] = [];

  for (const number of issueNumbers) {
    try {
      const response = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: number,
      });

      const issue = response.data;

      // GitHub Issue를 우리의 Issue 타입으로 변환
      issues.push({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? '',
        state: 'open',
        type: inferIssueType(issue.labels),
        labels: issue.labels.map((label) =>
          typeof label === 'string' ? label : label.name ?? ''
        ),
        assignees: issue.assignees?.map((a) => a.login) ?? [],
        context: {
          component: '',
          priority: 'medium',
          relatedFiles: [],
          relatedSymbols: [],
          source: 'github',
          sourceId: issue.id.toString(),
          sourceUrl: issue.html_url,
        },
        acceptanceCriteria: [],
        relatedIssues: [],
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
        url: issue.html_url,
      });
    } catch (error) {
      // 이슈를 가져올 수 없으면 무시
      console.warn(`Failed to fetch issue #${number}:`, error);
    }
  }

  return issues;
}

/**
 * 라벨로부터 이슈 타입 추론
 */
function inferIssueType(labels: Array<{ name?: string } | string>): Issue['type'] {
  const labelNames = labels.map((label) =>
    typeof label === 'string' ? label.toLowerCase() : (label.name ?? '').toLowerCase()
  );

  if (labelNames.includes('bug')) return 'bug';
  if (labelNames.includes('enhancement') || labelNames.includes('feature')) return 'feature';
  if (labelNames.includes('refactor')) return 'refactor';
  if (labelNames.includes('documentation')) return 'docs';
  if (labelNames.includes('test')) return 'test';

  return 'chore';
}
