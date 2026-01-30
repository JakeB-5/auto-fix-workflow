/**
 * @module github/list-issues/list-issues
 * @description Core logic for listing GitHub issues
 */

import type { Octokit } from '@octokit/rest';
import type { Result } from '../../common/types/index.js';
import type { Issue, IssueContext } from '../../common/types/index.js';
import type { ListIssuesParams, ListIssuesResult, GitHubApiError } from './types.js';
import { ok } from '../../common/types/index.js';
import { createGitHubClient } from './client.js';
import { parseIssueBody, mapIssueState } from './body-parser.js';
import { handleGitHubError, validateListIssuesParams } from './error-handling.js';

/**
 * List GitHub issues with filtering and pagination
 *
 * @param params - List issues parameters
 * @param token - GitHub authentication token
 * @returns Result containing list of issues or error
 */
export async function listIssues(
  params: ListIssuesParams,
  token: string
): Promise<Result<ListIssuesResult, GitHubApiError>> {
  // Validate parameters
  const validation = validateListIssuesParams(params);
  if (!validation.success) {
    return validation as Result<ListIssuesResult, GitHubApiError>;
  }

  try {
    const client = createGitHubClient(token);
    const result = await fetchIssuesFromGitHub(client, params);
    return result;
  } catch (error) {
    return handleGitHubError(error);
  }
}

/**
 * Fetch issues from GitHub API
 *
 * @param client - Octokit client instance
 * @param params - List issues parameters
 * @returns Result containing list of issues
 */
async function fetchIssuesFromGitHub(
  client: Octokit,
  params: ListIssuesParams
): Promise<Result<ListIssuesResult, GitHubApiError>> {
  try {
    // Build request parameters
    const requestParams: any = {
      owner: params.owner,
      repo: params.repo,
      state: params.state ?? 'open',
      per_page: params.perPage ?? 30,
      page: params.page ?? 1,
    };

    // Add optional filters
    if (params.labels && params.labels.length > 0) {
      requestParams.labels = params.labels.join(',');
    }

    if (params.assignee) {
      requestParams.assignee = params.assignee;
    }

    if (params.since) {
      requestParams.since = params.since;
    }

    // Fetch issues from GitHub
    const response = await client.issues.listForRepo(requestParams);

    // Convert GitHub issues to our Issue type
    const issues = response.data
      .filter((ghIssue) => !ghIssue.pull_request) // Exclude pull requests
      .map((ghIssue) => convertGitHubIssue(ghIssue, params.owner, params.repo))
      .filter((issue) => {
        // Apply exclude_labels filter
        const excludeLabels = params.excludeLabels ?? ['auto-fix-skip'];
        if (excludeLabels.length === 0) {
          return true;
        }
        // Exclude issue if it has any of the excluded labels
        return !issue.labels.some((label) => excludeLabels.includes(label));
      });

    // Check if there are more pages
    const hasMore = response.data.length === (params.perPage ?? 30);

    return ok({
      issues,
      totalCount: issues.length,
      hasMore,
    });
  } catch (error) {
    return handleGitHubError(error);
  }
}

/**
 * Convert GitHub issue to our Issue type
 *
 * @param ghIssue - GitHub issue from API
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Converted Issue
 */
function convertGitHubIssue(ghIssue: any, owner: string, repo: string): Issue {
  const body = ghIssue.body ?? '';
  const labels = ghIssue.labels?.map((l: any) => (typeof l === 'string' ? l : l.name)) ?? [];
  const assignees = ghIssue.assignees?.map((a: any) => a.login) ?? [];

  // Parse issue body for structured data
  const parsed = parseIssueBody(body);

  // Map GitHub state to our IssueStatus
  const state = mapIssueState(ghIssue.state, labels);

  // Build issue context
  const context: IssueContext = {
    component: parsed.component,
    priority: parsed.priority,
    relatedFiles: parsed.relatedFiles,
    relatedSymbols: parsed.relatedSymbols,
    source: 'github',
    sourceId: String(ghIssue.id),
    sourceUrl: ghIssue.html_url,
  };

  return {
    number: ghIssue.number,
    title: ghIssue.title,
    body,
    state,
    type: parsed.type,
    labels,
    assignees,
    context,
    codeAnalysis: parsed.codeAnalysis,
    suggestedFix: parsed.suggestedFix,
    acceptanceCriteria: parsed.acceptanceCriteria,
    relatedIssues: parsed.relatedIssues,
    createdAt: new Date(ghIssue.created_at),
    updatedAt: new Date(ghIssue.updated_at),
    url: ghIssue.html_url,
  };
}

/**
 * List all issues (with automatic pagination)
 *
 * @param params - List issues parameters (without page)
 * @param token - GitHub authentication token
 * @param maxPages - Maximum number of pages to fetch (default: 10)
 * @returns Result containing all issues or error
 */
export async function listAllIssues(
  params: Omit<ListIssuesParams, 'page'>,
  token: string,
  maxPages: number = 10
): Promise<Result<ListIssuesResult, GitHubApiError>> {
  const allIssues: Issue[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const result = await listIssues({ ...params, page }, token);

    if (!result.success) {
      return result;
    }

    allIssues.push(...result.data.issues);
    hasMore = result.data.hasMore;
    page++;
  }

  return ok({
    issues: allIssues,
    totalCount: allIssues.length,
    hasMore: hasMore && page > maxPages,
  });
}
