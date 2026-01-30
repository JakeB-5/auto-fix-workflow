/**
 * @module github/get-issue/get-issue
 * @description Core logic for retrieving GitHub issues
 */

import type { Octokit } from '@octokit/rest';
import type {
  Issue,
  IssueType,
  IssuePriority,
  IssueStatus,
} from '../../common/types/index.js';
import { ok, err, type Result } from '../../common/types/index.js';
import type { GitHubApiError } from '../update-issue/types.js';
import type { GetIssueParams, GetIssueResult, IssueComment } from './types.js';
import { createGitHubError } from './error-handling.js';
import { extractRelatedIssues } from './related-issues.js';
import { extractTaskList } from './markdown-parser.js';

/**
 * Get a GitHub issue with all related information
 *
 * @param octokit - Octokit instance
 * @param params - Get issue parameters
 * @returns Result containing issue data or error
 *
 * @example
 * ```typescript
 * const result = await getIssue(octokit, {
 *   owner: 'org',
 *   repo: 'repo',
 *   issueNumber: 123
 * });
 *
 * if (result.success) {
 *   console.log(result.data.issue.title);
 *   console.log(result.data.relatedIssues);
 *   console.log(result.data.comments);
 * }
 * ```
 */
export async function getIssue(
  octokit: Octokit,
  params: GetIssueParams
): Promise<Result<GetIssueResult, GitHubApiError>> {
  try {
    const { owner, repo, issueNumber } = params;

    // Fetch issue data
    const issueResponse = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    // Fetch comments
    const commentsResponse = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const githubIssue = issueResponse.data;
    const githubComments = commentsResponse.data;

    // Transform GitHub issue to our Issue type
    const issue = transformGitHubIssue(githubIssue, owner, repo);

    // Transform comments
    const comments: IssueComment[] = githubComments.map((comment) => ({
      id: comment.id,
      author: comment.user?.login ?? 'unknown',
      body: comment.body ?? '',
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.updated_at),
      url: comment.html_url,
    }));

    // Extract related issues from body and comments
    const relatedIssues = extractRelatedIssues(
      githubIssue.body ?? '',
      comments.map((c) => c.body)
    );

    return ok({
      issue,
      relatedIssues,
      comments,
    });
  } catch (error) {
    return err(
      createGitHubError(
        error,
        `Failed to get issue #${params.issueNumber} from ${params.owner}/${params.repo}`
      )
    );
  }
}

/**
 * Transform GitHub API issue response to our Issue type
 */
function transformGitHubIssue(
  githubIssue: any,
  owner: string,
  repo: string
): Issue {
  const labels = githubIssue.labels.map((label: string | { name?: string }) =>
    typeof label === 'string' ? label : label.name ?? ''
  );
  const assignees = (githubIssue.assignees ?? [])
    .filter((a: any): a is { login: string } => a !== null)
    .map((a: { login: string }) => a.login);

  const body = githubIssue.body ?? '';

  // Determine issue type from labels
  const type = determineIssueType(labels);

  // Determine priority from labels
  const priority = determinePriority(labels);

  // Map GitHub state to our IssueStatus
  const state = mapGitHubState(githubIssue.state, labels);

  // Extract acceptance criteria from task list
  const acceptanceCriteria = extractTaskList(body).map((task) => ({
    description: task.text,
    completed: task.completed,
  }));

  // Extract related issues from body
  const relatedIssues = extractRelatedIssues(body, []);

  return {
    number: githubIssue.number,
    title: githubIssue.title,
    body,
    state,
    type,
    labels,
    assignees,
    context: {
      component: extractComponent(labels) || 'unknown',
      priority,
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
      sourceId: `${owner}/${repo}#${githubIssue.number}`,
      sourceUrl: githubIssue.html_url,
    },
    acceptanceCriteria,
    relatedIssues,
    createdAt: new Date(githubIssue.created_at),
    updatedAt: new Date(githubIssue.updated_at),
    url: githubIssue.html_url,
  };
}

/**
 * Determine issue type from labels
 */
function determineIssueType(labels: readonly string[]): IssueType {
  const lowerLabels = labels.map((l) => l.toLowerCase());

  if (lowerLabels.some((l) => l.includes('bug') || l.includes('fix'))) {
    return 'bug';
  }
  if (
    lowerLabels.some((l) => l.includes('feature') || l.includes('enhancement'))
  ) {
    return 'feature';
  }
  if (lowerLabels.some((l) => l.includes('refactor'))) {
    return 'refactor';
  }
  if (lowerLabels.some((l) => l.includes('doc'))) {
    return 'docs';
  }
  if (lowerLabels.some((l) => l.includes('test'))) {
    return 'test';
  }

  return 'chore';
}

/**
 * Determine priority from labels
 */
function determinePriority(labels: readonly string[]): IssuePriority {
  const lowerLabels = labels.map((l) => l.toLowerCase());

  if (lowerLabels.some((l) => l.includes('critical') || l.includes('urgent'))) {
    return 'critical';
  }
  if (lowerLabels.some((l) => l.includes('high'))) {
    return 'high';
  }
  if (lowerLabels.some((l) => l.includes('low'))) {
    return 'low';
  }

  return 'medium';
}

/**
 * Map GitHub issue state to our IssueStatus
 */
function mapGitHubState(
  githubState: string,
  labels: readonly string[]
): IssueStatus {
  if (githubState === 'closed') {
    return 'closed';
  }

  const lowerLabels = labels.map((l) => l.toLowerCase());

  if (
    lowerLabels.some(
      (l) => l.includes('in progress') || l.includes('in-progress')
    )
  ) {
    return 'in_progress';
  }

  if (lowerLabels.some((l) => l.includes('resolved'))) {
    return 'resolved';
  }

  return 'open';
}

/**
 * Extract component name from labels
 */
function extractComponent(labels: readonly string[]): string | undefined {
  const componentPrefix = 'component:';
  const areaPrefix = 'area:';

  for (const label of labels) {
    const lower = label.toLowerCase();
    if (lower.startsWith(componentPrefix)) {
      return label.substring(componentPrefix.length).trim();
    }
    if (lower.startsWith(areaPrefix)) {
      return label.substring(areaPrefix.length).trim();
    }
  }

  return undefined;
}
