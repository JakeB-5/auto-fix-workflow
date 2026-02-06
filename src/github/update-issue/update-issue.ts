/**
 * @module github/update-issue/update-issue
 * @description Core logic for updating GitHub issues
 */

import { Octokit } from '@octokit/rest';
import type { Issue } from '../../common/types/index.js';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { UpdateIssueParams, GitHubApiError } from './types.js';
import { toGitHubApiError } from './error-handling.js';
import { syncLabels } from './labels-manager.js';
import { generateProgressComment } from './comment-generator.js';

/**
 * Update a GitHub issue
 *
 * @param params - Update parameters
 * @returns Result containing updated Issue or GitHubApiError
 *
 * @example
 * ```typescript
 * const result = await updateIssue({
 *   owner: 'octocat',
 *   repo: 'hello-world',
 *   issueNumber: 42,
 *   title: 'Updated title',
 *   labels: ['bug', 'fixed'],
 *   addComment: 'Fix has been deployed'
 * });
 * ```
 */
export async function updateIssue(
  params: UpdateIssueParams
): Promise<Result<Issue, GitHubApiError>> {
  try {
    const octokit = new Octokit({
      auth: process.env['GITHUB_TOKEN'],
    });

    const { owner, repo, issueNumber, title, body, state, labels, assignees, addComment } = params;

    // Update issue if any fields are provided
    if (title !== undefined || body !== undefined || state !== undefined || assignees !== undefined) {
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        ...(title !== undefined && { title }),
        ...(body !== undefined && { body }),
        ...(state !== undefined && { state }),
        ...(assignees !== undefined && { assignees: [...assignees] }),
      });
    }

    // Update labels if provided
    if (labels !== undefined) {
      await syncLabels(octokit, owner, repo, issueNumber, labels);
    }

    // Add comment if provided
    if (addComment !== undefined && addComment.trim() !== '') {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: addComment,
      });
    }

    // Fetch updated issue
    const response = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const issue = mapGitHubIssueToIssue(response.data);
    return ok(issue);
  } catch (error) {
    return err(toGitHubApiError(error));
  }
}

/**
 * Map GitHub API issue to our Issue type
 */
function mapGitHubIssueToIssue(githubIssue: {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  labels: Array<{ name?: string } | string>;
  assignees?: Array<{ login: string }> | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}): Issue {
  return {
    number: githubIssue.number,
    title: githubIssue.title,
    body: githubIssue.body ?? '',
    state: mapGitHubStateToIssueStatus(githubIssue.state),
    type: 'bug', // Default type, should be parsed from labels
    labels: githubIssue.labels.map((label) =>
      typeof label === 'string' ? label : label.name ?? ''
    ),
    assignees: (githubIssue.assignees ?? []).map((assignee) => assignee.login),
    context: {
      component: 'unknown',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(githubIssue.created_at),
    updatedAt: new Date(githubIssue.updated_at),
    url: githubIssue.html_url,
  };
}

/**
 * Map GitHub state to our IssueStatus type
 */
function mapGitHubStateToIssueStatus(state: string): Issue['state'] {
  switch (state.toLowerCase()) {
    case 'open':
      return 'open';
    case 'closed':
      return 'closed';
    default:
      return 'open';
  }
}

/**
 * Add a progress comment to an issue
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param status - Progress status message
 * @param details - Optional details object
 * @returns Result containing success or error
 */
export async function addProgressComment(
  owner: string,
  repo: string,
  issueNumber: number,
  status: string,
  details?: Record<string, unknown>
): Promise<Result<void, GitHubApiError>> {
  try {
    const octokit = new Octokit({
      auth: process.env['GITHUB_TOKEN'],
    });

    const comment = generateProgressComment(status, details);

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: comment,
    });

    return ok(undefined);
  } catch (error) {
    return err(toGitHubApiError(error));
  }
}
