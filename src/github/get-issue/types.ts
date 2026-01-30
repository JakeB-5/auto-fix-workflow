/**
 * @module github/get-issue/types
 * @description Type definitions for GitHub issue retrieval operations
 */

import type { Issue } from '../../common/types/index.js';

/**
 * Parameters for getting a GitHub issue
 */
export interface GetIssueParams {
  /** Repository owner */
  readonly owner: string;
  /** Repository name */
  readonly repo: string;
  /** Issue number to retrieve */
  readonly issueNumber: number;
}

/**
 * GitHub issue comment
 */
export interface IssueComment {
  /** Comment ID */
  readonly id: number;
  /** Comment author username */
  readonly author: string;
  /** Comment body (markdown) */
  readonly body: string;
  /** Comment creation timestamp */
  readonly createdAt: Date;
  /** Comment update timestamp */
  readonly updatedAt: Date;
  /** Comment URL */
  readonly url: string;
}

/**
 * Result of getting an issue
 */
export interface GetIssueResult {
  /** The retrieved issue */
  readonly issue: Issue;
  /** Related issue numbers extracted from the issue body and comments */
  readonly relatedIssues: readonly number[];
  /** All comments on the issue */
  readonly comments: readonly IssueComment[];
}
