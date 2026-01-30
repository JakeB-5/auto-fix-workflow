/**
 * @module github/get-issue/error-handling
 * @description Error handling utilities for GitHub issue retrieval
 */

import type { GitHubApiError } from '../update-issue/types.js';

/**
 * Create a GitHub API error from a caught error
 *
 * @param error - The caught error
 * @param context - Additional context about the operation
 * @returns Structured GitHub API error
 */
export function createGitHubError(
  error: unknown,
  context: string
): GitHubApiError {
  if (isGitHubApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const status = (error as { status?: number }).status;
    const code = (error as { code?: string }).code;

    const result: GitHubApiError = {
      message: `${context}: ${error.message}`,
      cause: error,
      ...(status !== undefined && { status }),
      ...(code !== undefined && { code }),
    };

    return result;
  }

  return {
    message: `${context}: Unknown error`,
    cause: error,
  };
}

/**
 * Type guard to check if an error is a GitHubApiError
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
 * Check if an error is a 404 Not Found error
 *
 * @param error - The error to check
 * @returns True if the error is a 404 error
 */
export function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 404;
  }
  return false;
}

/**
 * Check if an error is a rate limit error
 *
 * @param error - The error to check
 * @returns True if the error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403;
  }
  return false;
}
