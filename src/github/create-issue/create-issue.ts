/**
 * @module github/create-issue/create-issue
 * @description Core logic for creating GitHub issues
 */

import { Octokit } from '@octokit/rest';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { Issue } from '../../common/types/index.js';
import type { CreateIssueParams, GitHubApiError } from './types.js';
import { toGitHubApiError, isRetryableError, getRetryDelay } from './error-handling.js';
import { findDuplicates, type DuplicateCheckOptions } from './duplicate-check.js';
import { inferLabels, mergeLabels, filterValidLabels } from './labels.js';

/**
 * Options for issue creation
 */
export interface CreateIssueOptions {
  /** GitHub token for authentication */
  readonly token: string;
  /** Whether to check for duplicates before creating */
  readonly checkDuplicates?: boolean;
  /** Options for duplicate detection */
  readonly duplicateCheckOptions?: DuplicateCheckOptions;
  /** Whether to auto-infer labels from issue data */
  readonly autoInferLabels?: boolean;
  /** Maximum number of retry attempts */
  readonly maxRetries?: number;
}

/**
 * Create a new GitHub issue
 *
 * @param params - Issue creation parameters
 * @param options - Creation options
 * @returns Result containing the created issue or an error
 */
export async function createIssue(
  params: CreateIssueParams,
  options: CreateIssueOptions
): Promise<Result<Issue, GitHubApiError>> {
  const {
    token,
    checkDuplicates = false,
    duplicateCheckOptions,
    autoInferLabels = true,
    maxRetries = 3,
  } = options;

  // Initialize Octokit client
  const octokit = new Octokit({ auth: token });

  try {
    // Check for duplicates if enabled
    if (checkDuplicates) {
      const duplicates = await findDuplicates(octokit, params, duplicateCheckOptions);

      if (duplicates.length > 0) {
        return err({
          message: `Found ${duplicates.length} potential duplicate issue(s)`,
          code: 'DUPLICATE_ISSUE',
          cause: duplicates,
        });
      }
    }

    // Prepare labels
    let labels = params.labels ?? [];
    if (autoInferLabels && labels.length === 0) {
      // If no labels provided, try to infer from issue data
      // This requires additional context which would come from a full Issue object
      // For now, just use the provided labels
    }

    // Validate and filter labels
    labels = filterValidLabels(labels);

    // Create the issue with retry logic
    const result = await createIssueWithRetry(
      octokit,
      {
        ...params,
        labels,
      },
      maxRetries
    );

    return result;
  } catch (error) {
    return err(toGitHubApiError(error));
  }
}

/**
 * Create issue with retry logic
 */
async function createIssueWithRetry(
  octokit: Octokit,
  params: CreateIssueParams,
  maxRetries: number
): Promise<Result<Issue, GitHubApiError>> {
  let lastError: GitHubApiError | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const createParams: {
        owner: string;
        repo: string;
        title: string;
        body: string;
        labels?: string[];
        assignees?: string[];
        milestone?: number;
      } = {
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
      };

      if (params.labels !== undefined && params.labels.length > 0) {
        createParams.labels = params.labels as string[];
      }

      if (params.assignees !== undefined && params.assignees.length > 0) {
        createParams.assignees = params.assignees as string[];
      }

      if (params.milestone !== undefined) {
        createParams.milestone = params.milestone;
      }

      const { data } = await octokit.rest.issues.create(createParams);

      // Convert Octokit response to our Issue type
      const issue = convertOctokitIssueToIssue(data);
      return ok(issue);
    } catch (error) {
      lastError = toGitHubApiError(error);

      // Check if error is retryable
      if (!isRetryableError(lastError) || attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      const delay = getRetryDelay(lastError, attempt);
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  return err(lastError!);
}

/**
 * Convert Octokit issue response to our Issue type
 */
function convertOctokitIssueToIssue(octokitIssue: any): Issue {
  return {
    number: octokitIssue.number,
    title: octokitIssue.title,
    body: octokitIssue.body ?? '',
    state: octokitIssue.state === 'open' ? 'open' : 'closed',
    type: inferTypeFromLabels(octokitIssue.labels),
    labels: octokitIssue.labels?.map((l: any) => l.name) ?? [],
    assignees: octokitIssue.assignees?.map((a: any) => a.login) ?? [],
    context: {
      component: inferComponentFromLabels(octokitIssue.labels),
      priority: inferPriorityFromLabels(octokitIssue.labels),
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(octokitIssue.created_at),
    updatedAt: new Date(octokitIssue.updated_at),
    url: octokitIssue.html_url,
  };
}

/**
 * Infer issue type from labels
 */
function inferTypeFromLabels(labels: any[]): Issue['type'] {
  const labelNames = labels.map((l: any) => l.name.toLowerCase());

  if (labelNames.some(name => name.includes('bug'))) return 'bug';
  if (labelNames.some(name => name.includes('feature'))) return 'feature';
  if (labelNames.some(name => name.includes('refactor'))) return 'refactor';
  if (labelNames.some(name => name.includes('docs'))) return 'docs';
  if (labelNames.some(name => name.includes('test'))) return 'test';
  if (labelNames.some(name => name.includes('chore'))) return 'chore';

  return 'bug'; // Default
}

/**
 * Infer component from labels
 */
function inferComponentFromLabels(labels: any[]): string {
  const labelNames = labels.map((l: any) => l.name);

  const componentLabel = labelNames.find(name =>
    name.toLowerCase().startsWith('component:')
  );

  if (componentLabel) {
    return componentLabel.split(':')[1] ?? 'unknown';
  }

  return 'unknown';
}

/**
 * Infer priority from labels
 */
function inferPriorityFromLabels(labels: any[]): Issue['context']['priority'] {
  const labelNames = labels.map((l: any) => l.name.toLowerCase());

  if (labelNames.some(name => name.includes('critical'))) return 'critical';
  if (labelNames.some(name => name.includes('high'))) return 'high';
  if (labelNames.some(name => name.includes('low'))) return 'low';

  return 'medium'; // Default
}

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create issue from partial Issue object
 *
 * @param issue - Partial issue with at least title and body
 * @param params - Additional parameters (owner, repo, token)
 * @returns Result containing the created issue
 */
export async function createIssueFromPartial(
  issue: Partial<Issue> & { title: string; body: string },
  params: {
    readonly owner: string;
    readonly repo: string;
    readonly token: string;
  }
): Promise<Result<Issue, GitHubApiError>> {
  const createParams: CreateIssueParams = {
    owner: params.owner,
    repo: params.repo,
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    assignees: issue.assignees,
  };

  return createIssue(createParams, {
    token: params.token,
    autoInferLabels: true,
  });
}
