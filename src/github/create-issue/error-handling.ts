/**
 * @module github/create-issue/error-handling
 * @description Error handling utilities for GitHub issue creation
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
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: GitHubApiError): boolean {
  return error.status === 429 || error.message.toLowerCase().includes('rate limit');
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: GitHubApiError): boolean {
  const networkErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
  return error.code !== undefined && networkErrorCodes.includes(error.code);
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

/**
 * Get a user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: GitHubApiError): string {
  if (isAuthError(error)) {
    return 'Authentication failed. Please check your GitHub token.';
  }

  if (isNotFoundError(error)) {
    return 'Repository not found. Please verify the owner and repo name.';
  }

  if (isRateLimitError(error)) {
    return 'GitHub API rate limit exceeded. Please try again later.';
  }

  if (isValidationError(error)) {
    return 'Invalid issue data. Please check the title, body, and labels.';
  }

  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection.';
  }

  return error.message;
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: GitHubApiError): boolean {
  // Retry on network errors and rate limits
  return isNetworkError(error) || isRateLimitError(error);
}

/**
 * Get suggested retry delay in milliseconds
 */
export function getRetryDelay(error: GitHubApiError, attemptNumber: number): number {
  if (isRateLimitError(error)) {
    // Exponential backoff for rate limits, starting at 60 seconds
    return Math.min(60000 * Math.pow(2, attemptNumber - 1), 600000);
  }

  if (isNetworkError(error)) {
    // Exponential backoff for network errors, starting at 1 second
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000);
  }

  return 0;
}
