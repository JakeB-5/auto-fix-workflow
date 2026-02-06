/**
 * @module common/error-handler/issue-error
 * @description Issue and PR management errors
 */

import { AutofixError } from './base.js';
import type { IssueErrorCode } from './codes.js';
import type { BaseErrorContext } from './base.js';

/**
 * Issue error context
 */
export interface IssueErrorContext extends BaseErrorContext {
  readonly issueNumber?: number;
  readonly issueNumbers?: number[];
  readonly prNumber?: number;
  readonly url?: string;
  readonly state?: string;
}

/**
 * Issue and PR management error
 *
 * Represents errors related to GitHub issue and PR operations.
 *
 * @example
 * ```typescript
 * const error = IssueError.notFound(123, {
 *   url: 'https://github.com/owner/repo/issues/123'
 * });
 * ```
 */
export class IssueError extends AutofixError {
  readonly code: IssueErrorCode;
  readonly context: Readonly<IssueErrorContext>;

  constructor(
    code: IssueErrorCode,
    message: string,
    context: IssueErrorContext = {}
  ) {
    super(message);
    this.code = code;
    this.context = Object.freeze({ ...context });
    this.name = 'IssueError';
  }

  /**
   * Create error for issue not found
   */
  static notFound(issueNumber: number, context?: IssueErrorContext): IssueError {
    return new IssueError(
      'ISSUE_NOT_FOUND',
      `Issue #${issueNumber} not found`,
      { ...context, issueNumber }
    );
  }

  /**
   * Create error for no issues found
   */
  static noIssuesFound(message: string, context?: IssueErrorContext): IssueError {
    return new IssueError('NO_ISSUES_FOUND', message, context);
  }

  /**
   * Create error for issue update failure
   */
  static updateFailed(issueNumber: number, message: string, context?: IssueErrorContext): IssueError {
    return new IssueError(
      'ISSUE_UPDATE_FAILED',
      `Failed to update issue #${issueNumber}: ${message}`,
      { ...context, issueNumber }
    );
  }

  /**
   * Create error for PR already exists
   */
  static prExists(prNumber: number, url: string, context?: IssueErrorContext): IssueError {
    return new IssueError(
      'PR_EXISTS',
      `Pull request #${prNumber} already exists`,
      { ...context, prNumber, url }
    );
  }

  /**
   * Create error for PR creation failure
   */
  static prCreateFailed(message: string, context?: IssueErrorContext): IssueError {
    return new IssueError('PR_CREATE_FAILED', message, context);
  }
}
