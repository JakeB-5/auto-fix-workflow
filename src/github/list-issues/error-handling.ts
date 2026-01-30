/**
 * @module github/list-issues/error-handling
 * @description Error handling utilities for GitHub API operations
 */

import type { GitHubApiError } from './types.js';
import type { Result } from '../../common/types/index.js';
import { err } from '../../common/types/index.js';

/**
 * Convert an unknown error to a GitHubApiError
 *
 * @param error - Error to convert
 * @returns Standardized GitHub API error
 */
export function toGitHubApiError(error: unknown): GitHubApiError {
  // Handle Octokit errors
  if (error && typeof error === 'object') {
    if ('status' in error && 'message' in error) {
      const octokitError = error as any;
      return {
        message: String(octokitError.message ?? 'Unknown GitHub API error'),
        status: typeof octokitError.status === 'number' ? octokitError.status : undefined,
        code: typeof octokitError.code === 'string' ? octokitError.code : undefined,
        cause: error,
      };
    }

    if ('message' in error) {
      return {
        message: String((error as any).message),
        cause: error,
      };
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      cause: error,
    };
  }

  // Handle unknown errors
  return {
    message: 'Unknown error occurred',
    cause: error,
  };
}

/**
 * Handle GitHub API errors and convert to Result
 *
 * @param error - Error to handle
 * @returns Failure result with GitHub API error
 */
export function handleGitHubError<T>(error: unknown): Result<T, GitHubApiError> {
  const apiError = toGitHubApiError(error);
  return err(apiError);
}

/**
 * Check if an error is a not found error (404)
 *
 * @param error - Error to check
 * @returns True if the error is a 404
 */
export function isNotFoundError(error: GitHubApiError): boolean {
  return error.status === 404;
}

/**
 * Check if an error is an unauthorized error (401)
 *
 * @param error - Error to check
 * @returns True if the error is a 401
 */
export function isUnauthorizedError(error: GitHubApiError): boolean {
  return error.status === 401;
}

/**
 * Check if an error is a forbidden error (403)
 *
 * @param error - Error to check
 * @returns True if the error is a 403
 */
export function isForbiddenError(error: GitHubApiError): boolean {
  return error.status === 403;
}

/**
 * Check if an error is a rate limit error
 *
 * @param error - Error to check
 * @returns True if the error is a rate limit error
 */
export function isRateLimitError(error: GitHubApiError): boolean {
  return error.status === 403 || error.status === 429;
}

/**
 * Check if an error is a validation error (422)
 *
 * @param error - Error to check
 * @returns True if the error is a 422
 */
export function isValidationError(error: GitHubApiError): boolean {
  return error.status === 422;
}

/**
 * Get a user-friendly error message
 *
 * @param error - GitHub API error
 * @returns User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: GitHubApiError): string {
  if (isNotFoundError(error)) {
    return 'Repository or resource not found. Please check the owner and repository name.';
  }

  if (isUnauthorizedError(error)) {
    return 'Authentication failed. Please check your GitHub token.';
  }

  if (isForbiddenError(error)) {
    return 'Access forbidden. You may not have permission to access this resource.';
  }

  if (isRateLimitError(error)) {
    return 'GitHub API rate limit exceeded. Please try again later.';
  }

  if (isValidationError(error)) {
    return `Validation error: ${error.message}`;
  }

  return error.message;
}

/**
 * Validate list issues parameters
 *
 * @param params - Parameters to validate
 * @returns Validation result
 */
export function validateListIssuesParams(params: {
  readonly owner: string;
  readonly repo: string;
  readonly perPage?: number;
  readonly page?: number;
}): Result<void, GitHubApiError> {
  if (!params.owner || params.owner.trim().length === 0) {
    return err({
      message: 'Owner is required and cannot be empty',
      status: 400,
      code: 'INVALID_OWNER',
    });
  }

  if (!params.repo || params.repo.trim().length === 0) {
    return err({
      message: 'Repository name is required and cannot be empty',
      status: 400,
      code: 'INVALID_REPO',
    });
  }

  if (params.perPage !== undefined) {
    if (params.perPage < 1 || params.perPage > 100) {
      return err({
        message: 'perPage must be between 1 and 100',
        status: 400,
        code: 'INVALID_PER_PAGE',
      });
    }
  }

  if (params.page !== undefined) {
    if (params.page < 1) {
      return err({
        message: 'page must be greater than 0',
        status: 400,
        code: 'INVALID_PAGE',
      });
    }
  }

  return { success: true, data: undefined };
}
