/**
 * @module github/create-issue/types
 * @description Type definitions for GitHub issue creation
 */

/**
 * Parameters for creating a GitHub issue
 */
export interface CreateIssueParams {
  /** Repository owner */
  readonly owner: string;
  /** Repository name */
  readonly repo: string;
  /** Issue title */
  readonly title: string;
  /** Issue body content (Markdown) */
  readonly body: string;
  /** Labels to apply to the issue */
  readonly labels?: readonly string[];
  /** Assignees for the issue */
  readonly assignees?: readonly string[];
  /** Milestone number */
  readonly milestone?: number;
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
