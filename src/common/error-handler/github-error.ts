/**
 * @module common/error-handler/github-error
 * @description GitHub API error class
 */

import { AutofixError } from './base.js';
import type { GitHubErrorCode } from './codes.js';

/**
 * Context for GitHub API errors
 */
export interface GitHubApiErrorContext {
  /** HTTP status code */
  readonly statusCode?: number | undefined;
  /** GitHub API endpoint */
  readonly endpoint?: string | undefined;
  /** HTTP method used */
  readonly method?: string | undefined;
  /** Repository owner */
  readonly owner?: string | undefined;
  /** Repository name */
  readonly repo?: string | undefined;
  /** Resource identifier (issue number, PR number, etc.) */
  readonly resourceId?: string | number | undefined;
  /** Rate limit info */
  readonly rateLimit?: {
    readonly limit: number;
    readonly remaining: number;
    readonly reset: Date;
  } | undefined;
  /** Request ID from GitHub */
  readonly requestId?: string | undefined;
  /** Documentation URL from GitHub */
  readonly documentationUrl?: string | undefined;
}

/**
 * Error class for GitHub API errors
 *
 * @example
 * ```typescript
 * throw new GitHubApiError(
 *   'GITHUB_NOT_FOUND',
 *   'Repository not found',
 *   { owner: 'user', repo: 'repo', statusCode: 404 }
 * );
 * ```
 */
export class GitHubApiError extends AutofixError {
  readonly code: GitHubErrorCode;
  readonly context: Readonly<GitHubApiErrorContext>;

  constructor(
    code: GitHubErrorCode,
    message: string,
    context: GitHubApiErrorContext = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code;
    this.context = Object.freeze({
      ...context,
      rateLimit: context.rateLimit
        ? Object.freeze({ ...context.rateLimit })
        : undefined,
    });
    Object.freeze(this);
  }

  /**
   * Create from an Octokit/GitHub API response error
   */
  static fromResponse(
    statusCode: number,
    message: string,
    context: Omit<GitHubApiErrorContext, 'statusCode'> = {},
    cause?: unknown
  ): GitHubApiError {
    const code = GitHubApiError.statusToCode(statusCode);
    return new GitHubApiError(
      code,
      message,
      { ...context, statusCode },
      cause ? { cause } : undefined
    );
  }

  /**
   * Map HTTP status code to error code
   */
  static statusToCode(statusCode: number): GitHubErrorCode {
    switch (statusCode) {
      case 401:
        return 'GITHUB_AUTH_FAILED';
      case 403:
        return 'GITHUB_FORBIDDEN';
      case 404:
        return 'GITHUB_NOT_FOUND';
      case 409:
        return 'GITHUB_CONFLICT';
      case 422:
        return 'GITHUB_VALIDATION_ERROR';
      case 429:
        return 'GITHUB_RATE_LIMITED';
      default:
        if (statusCode >= 500) {
          return 'GITHUB_SERVER_ERROR';
        }
        return 'GITHUB_UNKNOWN';
    }
  }

  /**
   * Create a GitHubApiError for authentication failures
   */
  static authFailed(message = 'GitHub authentication failed'): GitHubApiError {
    return new GitHubApiError(
      'GITHUB_AUTH_FAILED',
      message,
      { statusCode: 401 }
    );
  }

  /**
   * Create a GitHubApiError for rate limiting
   */
  static rateLimited(
    resetTime: Date,
    limit: number,
    remaining: number
  ): GitHubApiError {
    return new GitHubApiError(
      'GITHUB_RATE_LIMITED',
      `GitHub API rate limit exceeded. Resets at ${resetTime.toISOString()}`,
      {
        statusCode: 429,
        rateLimit: { limit, remaining, reset: resetTime },
      }
    );
  }

  /**
   * Create a GitHubApiError for not found resources
   */
  static notFound(
    resourceType: string,
    context: Pick<GitHubApiErrorContext, 'owner' | 'repo' | 'resourceId'>
  ): GitHubApiError {
    const identifier = context.resourceId
      ? `${context.owner}/${context.repo}#${context.resourceId}`
      : `${context.owner}/${context.repo}`;

    return new GitHubApiError(
      'GITHUB_NOT_FOUND',
      `${resourceType} not found: ${identifier}`,
      { ...context, statusCode: 404 }
    );
  }

  /**
   * Create a GitHubApiError for network errors
   */
  static networkError(message: string, cause?: unknown): GitHubApiError {
    return new GitHubApiError(
      'GITHUB_NETWORK_ERROR',
      `GitHub API network error: ${message}`,
      {},
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a GitHubApiError for validation errors
   */
  static validationError(
    message: string,
    context: Omit<GitHubApiErrorContext, 'statusCode'> = {}
  ): GitHubApiError {
    return new GitHubApiError(
      'GITHUB_VALIDATION_ERROR',
      message,
      { ...context, statusCode: 422 }
    );
  }

  /**
   * Create a GitHubApiError for conflict errors
   */
  static conflict(
    message: string,
    context: Omit<GitHubApiErrorContext, 'statusCode'> = {}
  ): GitHubApiError {
    return new GitHubApiError(
      'GITHUB_CONFLICT',
      message,
      { ...context, statusCode: 409 }
    );
  }

  /**
   * Check if the error indicates rate limiting
   */
  get isRateLimited(): boolean {
    return this.code === 'GITHUB_RATE_LIMITED';
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  get rateLimitResetIn(): number | undefined {
    if (this.context.rateLimit?.reset) {
      return Math.max(0, this.context.rateLimit.reset.getTime() - Date.now());
    }
    return undefined;
  }
}
