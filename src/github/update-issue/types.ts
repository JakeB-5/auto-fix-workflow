/**
 * @module github/update-issue/types
 * @description Type definitions for GitHub issue update operations
 */

/**
 * Parameters for updating a GitHub issue
 */
export interface UpdateIssueParams {
  /** Repository owner */
  readonly owner: string;
  /** Repository name */
  readonly repo: string;
  /** Issue number to update */
  readonly issueNumber: number;
  /** New title for the issue */
  readonly title?: string;
  /** New body content for the issue */
  readonly body?: string;
  /** New state for the issue */
  readonly state?: 'open' | 'closed';
  /** Labels to set on the issue */
  readonly labels?: readonly string[];
  /** Assignees to set on the issue */
  readonly assignees?: readonly string[];
  /** Optional comment to add to the issue */
  readonly addComment?: string;
}

/**
 * GitHub API error details
 */
export interface GitHubApiError {
  /** Error message */
  readonly message: string;
  /** HTTP status code */
  readonly status?: number;
  /** Error code from GitHub API */
  readonly code?: string;
  /** Original error object */
  readonly cause?: unknown;
}
