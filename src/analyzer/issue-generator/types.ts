/**
 * @module analyzer/issue-generator/types
 * @description Type definitions for GitHub Issue generation
 */

import type { IssueType } from '../../common/types/index.js';

/**
 * Generated GitHub Issue
 */
export interface GeneratedIssue {
  /** Issue title */
  readonly title: string;
  /** Issue body in Markdown format */
  readonly body: string;
  /** Labels to apply */
  readonly labels: readonly string[];
  /** Issue type */
  readonly type: IssueType;
}

/**
 * Error codes for issue generator
 */
export enum GeneratorErrorCode {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Error object for generator operations
 */
export interface GeneratorError {
  readonly code: GeneratorErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
