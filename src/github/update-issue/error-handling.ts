/**
 * @module github/update-issue/error-handling
 * @description Error handling utilities for GitHub issue updates
 */

import type { GitHubApiError } from './types.js';

/**
 * Convert an unknown error to a GitHubApiError
 *
 * @param error - Unknown error object
 * @returns Standardized GitHubApiError
 */
export function toGitHubApiError(error: unknown): GitHubApiError {
  if (isGitHubApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: getErrorStatus(error),
      code: getErrorCode(error),
      cause: error,
    };
  }

  return {
    message: String(error),
    cause: error,
  };
}

/**
 * Check if an error is already a GitHubApiError
 */
function isGitHubApiError(error: unknown): error is GitHubApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Extract HTTP status code from error
 */
function getErrorStatus(error: Error): number | undefined {
  const errorObj = error as { status?: number };
  return typeof errorObj.status === 'number' ? errorObj.status : undefined;
}

/**
 * Extract error code from error
 */
function getErrorCode(error: Error): string | undefined {
  const errorObj = error as { code?: string };
  return typeof errorObj.code === 'string' ? errorObj.code : undefined;
}

/**
 * Check if an error is a "not found" error
 */
export function isNotFoundError(error: GitHubApiError): boolean {
  return error.status === 404;
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: GitHubApiError): boolean {
  return error.status === 401 || error.status === 403;
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: GitHubApiError): boolean {
  return error.status === 422;
}

/**
 * Format an error for user-friendly display
 */
export function formatError(error: GitHubApiError): string {
  const parts: string[] = [error.message];

  if (error.status) {
    parts.push(`(HTTP ${error.status})`);
  }

  if (error.code) {
    parts.push(`[${error.code}]`);
  }

  return parts.join(' ');
}
