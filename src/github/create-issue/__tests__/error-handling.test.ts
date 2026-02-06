/**
 * @module github/create-issue/__tests__/error-handling
 * @description Unit tests for GitHub issue creation error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  toGitHubApiError,
  isNotFoundError,
  isAuthError,
  isValidationError,
  isRateLimitError,
  isNetworkError,
  formatError,
  getUserFriendlyMessage,
  isRetryableError,
  getRetryDelay,
} from '../error-handling.js';
import type { GitHubApiError } from '../types.js';

describe('error-handling', () => {
  describe('toGitHubApiError', () => {
    it('should return GitHubApiError as-is', () => {
      const error: GitHubApiError = {
        message: 'Test error',
        status: 404,
        code: 'NOT_FOUND',
      };

      const result = toGitHubApiError(error);

      expect(result).toBe(error);
      expect(result.message).toBe('Test error');
      expect(result.status).toBe(404);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('should convert Error with status to GitHubApiError', () => {
      const error = new Error('API Error');
      (error as any).status = 500;
      (error as any).code = 'INTERNAL_ERROR';

      const result = toGitHubApiError(error);

      // Error objects pass isGitHubApiError check (have string message property)
      // So they are returned as-is
      expect(result).toBe(error);
      expect(result.message).toBe('API Error');
      expect(result).toHaveProperty('status', 500);
      expect(result).toHaveProperty('code', 'INTERNAL_ERROR');
    });

    it('should convert Error without status to GitHubApiError', () => {
      const error = new Error('Generic error');

      const result = toGitHubApiError(error);

      // Error objects are returned as-is
      expect(result).toBe(error);
      expect(result.message).toBe('Generic error');
    });

    it('should convert string to GitHubApiError', () => {
      const error = 'Simple error message';

      const result = toGitHubApiError(error);

      expect(result.message).toBe('Simple error message');
      expect(result.status).toBeUndefined();
      expect(result.code).toBeUndefined();
      expect(result.cause).toBe(error);
    });

    it('should convert number to GitHubApiError', () => {
      const error = 500;

      const result = toGitHubApiError(error);

      expect(result.message).toBe('500');
      expect(result.cause).toBe(error);
    });

    it('should convert null to GitHubApiError', () => {
      const result = toGitHubApiError(null);

      expect(result.message).toBe('null');
      expect(result.cause).toBeNull();
    });

    it('should convert undefined to GitHubApiError', () => {
      const result = toGitHubApiError(undefined);

      expect(result.message).toBe('undefined');
      expect(result.cause).toBeUndefined();
    });

    it('should handle Error with non-numeric status', () => {
      const error = new Error('Test');
      (error as any).status = 'invalid';

      const result = toGitHubApiError(error);

      // The implementation doesn't validate the type, it just extracts it
      // So a non-numeric status will be included as-is
      expect(result).toHaveProperty('status');
    });

    it('should handle Error with non-string code', () => {
      const error = new Error('Test');
      (error as any).code = 123;

      const result = toGitHubApiError(error);

      // The implementation doesn't validate the type, it just extracts it
      // So a non-string code will be included as-is
      expect(result).toHaveProperty('code');
    });
  });

  describe('isNotFoundError', () => {
    it('should return true for 404 status', () => {
      const error: GitHubApiError = { message: 'Not found', status: 404 };

      expect(isNotFoundError(error)).toBe(true);
    });

    it('should return false for non-404 status', () => {
      const error: GitHubApiError = { message: 'Error', status: 500 };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for missing status', () => {
      const error: GitHubApiError = { message: 'Error' };

      expect(isNotFoundError(error)).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401 status', () => {
      const error: GitHubApiError = { message: 'Unauthorized', status: 401 };

      expect(isAuthError(error)).toBe(true);
    });

    it('should return true for 403 status', () => {
      const error: GitHubApiError = { message: 'Forbidden', status: 403 };

      expect(isAuthError(error)).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error: GitHubApiError = { message: 'Error', status: 500 };

      expect(isAuthError(error)).toBe(false);
    });

    it('should return false for missing status', () => {
      const error: GitHubApiError = { message: 'Error' };

      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('should return true for 422 status', () => {
      const error: GitHubApiError = {
        message: 'Validation failed',
        status: 422,
      };

      expect(isValidationError(error)).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error: GitHubApiError = { message: 'Error', status: 400 };

      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for missing status', () => {
      const error: GitHubApiError = { message: 'Error' };

      expect(isValidationError(error)).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for 429 status', () => {
      const error: GitHubApiError = {
        message: 'Rate limit exceeded',
        status: 429,
      };

      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return true for message containing "rate limit"', () => {
      const error: GitHubApiError = {
        message: 'API rate limit exceeded',
      };

      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return true for message with uppercase RATE LIMIT', () => {
      const error: GitHubApiError = {
        message: 'RATE LIMIT exceeded',
      };

      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error: GitHubApiError = { message: 'Server error', status: 500 };

      expect(isRateLimitError(error)).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for ECONNREFUSED', () => {
      const error: GitHubApiError = {
        message: 'Connection refused',
        code: 'ECONNREFUSED',
      };

      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for ENOTFOUND', () => {
      const error: GitHubApiError = {
        message: 'Not found',
        code: 'ENOTFOUND',
      };

      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for ETIMEDOUT', () => {
      const error: GitHubApiError = {
        message: 'Timeout',
        code: 'ETIMEDOUT',
      };

      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for ECONNRESET', () => {
      const error: GitHubApiError = {
        message: 'Connection reset',
        code: 'ECONNRESET',
      };

      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for other error codes', () => {
      const error: GitHubApiError = {
        message: 'Error',
        code: 'OTHER_ERROR',
      };

      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for missing code', () => {
      const error: GitHubApiError = { message: 'Error' };

      expect(isNetworkError(error)).toBe(false);
    });
  });

  describe('formatError', () => {
    it('should format error with message only', () => {
      const error: GitHubApiError = { message: 'Simple error' };

      const result = formatError(error);

      expect(result).toBe('Simple error');
    });

    it('should format error with message and status', () => {
      const error: GitHubApiError = {
        message: 'Not found',
        status: 404,
      };

      const result = formatError(error);

      expect(result).toBe('Not found (HTTP 404)');
    });

    it('should format error with message and code', () => {
      const error: GitHubApiError = {
        message: 'Connection error',
        code: 'ECONNREFUSED',
      };

      const result = formatError(error);

      expect(result).toBe('Connection error [ECONNREFUSED]');
    });

    it('should format error with all fields', () => {
      const error: GitHubApiError = {
        message: 'Request failed',
        status: 500,
        code: 'INTERNAL_ERROR',
      };

      const result = formatError(error);

      expect(result).toBe('Request failed (HTTP 500) [INTERNAL_ERROR]');
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return auth message for 401', () => {
      const error: GitHubApiError = {
        message: 'Unauthorized',
        status: 401,
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Authentication failed. Please check your GitHub token.');
    });

    it('should return auth message for 403', () => {
      const error: GitHubApiError = {
        message: 'Forbidden',
        status: 403,
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Authentication failed. Please check your GitHub token.');
    });

    it('should return not found message for 404', () => {
      const error: GitHubApiError = {
        message: 'Not Found',
        status: 404,
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Repository not found. Please verify the owner and repo name.');
    });

    it('should return rate limit message for 429', () => {
      const error: GitHubApiError = {
        message: 'Rate limit',
        status: 429,
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('GitHub API rate limit exceeded. Please try again later.');
    });

    it('should return rate limit message for rate limit text', () => {
      const error: GitHubApiError = {
        message: 'API rate limit exceeded',
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('GitHub API rate limit exceeded. Please try again later.');
    });

    it('should return validation message for 422', () => {
      const error: GitHubApiError = {
        message: 'Validation failed',
        status: 422,
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Invalid issue data. Please check the title, body, and labels.');
    });

    it('should return network message for network errors', () => {
      const error: GitHubApiError = {
        message: 'Connection refused',
        code: 'ECONNREFUSED',
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Network error. Please check your internet connection.');
    });

    it('should return original message for unknown errors', () => {
      const error: GitHubApiError = {
        message: 'Custom error message',
      };

      const result = getUserFriendlyMessage(error);

      expect(result).toBe('Custom error message');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error: GitHubApiError = {
        message: 'Connection timeout',
        code: 'ETIMEDOUT',
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      const error: GitHubApiError = {
        message: 'Rate limit exceeded',
        status: 429,
      };

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for auth errors', () => {
      const error: GitHubApiError = {
        message: 'Unauthorized',
        status: 401,
      };

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for validation errors', () => {
      const error: GitHubApiError = {
        message: 'Validation failed',
        status: 422,
      };

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return 60s for first rate limit retry', () => {
      const error: GitHubApiError = {
        message: 'Rate limit',
        status: 429,
      };

      const delay = getRetryDelay(error, 1);

      expect(delay).toBe(60000);
    });

    it('should use exponential backoff for rate limits', () => {
      const error: GitHubApiError = {
        message: 'Rate limit',
        status: 429,
      };

      const delay1 = getRetryDelay(error, 1);
      const delay2 = getRetryDelay(error, 2);
      const delay3 = getRetryDelay(error, 3);

      expect(delay1).toBe(60000);
      expect(delay2).toBe(120000);
      expect(delay3).toBe(240000);
    });

    it('should cap rate limit delay at 600s', () => {
      const error: GitHubApiError = {
        message: 'Rate limit',
        status: 429,
      };

      const delay = getRetryDelay(error, 10);

      expect(delay).toBe(600000);
    });

    it('should return 1s for first network retry', () => {
      const error: GitHubApiError = {
        message: 'Connection error',
        code: 'ECONNREFUSED',
      };

      const delay = getRetryDelay(error, 1);

      expect(delay).toBe(1000);
    });

    it('should use exponential backoff for network errors', () => {
      const error: GitHubApiError = {
        message: 'Network error',
        code: 'ETIMEDOUT',
      };

      const delay1 = getRetryDelay(error, 1);
      const delay2 = getRetryDelay(error, 2);
      const delay3 = getRetryDelay(error, 3);

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
    });

    it('should cap network delay at 30s', () => {
      const error: GitHubApiError = {
        message: 'Network error',
        code: 'ECONNRESET',
      };

      const delay = getRetryDelay(error, 10);

      expect(delay).toBe(30000);
    });

    it('should return 0 for non-retryable errors', () => {
      const error: GitHubApiError = {
        message: 'Validation failed',
        status: 422,
      };

      const delay = getRetryDelay(error, 1);

      expect(delay).toBe(0);
    });
  });
});
