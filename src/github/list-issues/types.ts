/**
 * @module github/list-issues/types
 * @description Type definitions for GitHub issue listing operations
 */

import type { Issue } from '../../common/types/index.js';

/**
 * Parameters for listing GitHub issues
 */
export interface ListIssuesParams {
  /** Repository owner */
  readonly owner: string;
  /** Repository name */
  readonly repo: string;
  /** Issue state filter */
  readonly state?: 'open' | 'closed' | 'all';
  /** Filter by labels */
  readonly labels?: readonly string[];
  /** Exclude issues with these labels */
  readonly excludeLabels?: readonly string[];
  /** Filter by assignee */
  readonly assignee?: string;
  /** Filter issues updated after this ISO 8601 timestamp */
  readonly since?: string;
  /** Results per page (default: 30, max: 100) */
  readonly perPage?: number;
  /** Page number for pagination */
  readonly page?: number;
}

/**
 * Result of listing GitHub issues
 */
export interface ListIssuesResult {
  /** Array of issues */
  readonly issues: readonly Issue[];
  /** Total count of issues matching the filter */
  readonly totalCount: number;
  /** Whether more pages are available */
  readonly hasMore: boolean;
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
