/**
 * @module github/update-issue/__tests__/error-handling
 * @description Unit tests for GitHub issue update error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  toGitHubApiError,
  isNotFoundError,
  isAuthError,
  isValidationError,
  formatError,
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

    it('should convert Error with status and code to GitHubApiError', () => {
      const error = new Error('API Error');
      (error as any).status = 500;
      (error as any).code = 'SERVER_ERROR';

      const result = toGitHubApiError(error);

      // Error objects pass isGitHubApiError check so are returned as-is
      expect(result).toBe(error);
      expect(result.message).toBe('API Error');
      expect(result).toHaveProperty('status', 500);
      expect(result).toHaveProperty('code', 'SERVER_ERROR');
    });

    it('should convert Error without status to GitHubApiError', () => {
      const error = new Error('Generic error');

      const result = toGitHubApiError(error);

      // Error objects are returned as-is
      expect(result).toBe(error);
      expect(result.message).toBe('Generic error');
    });

    it('should convert Error with only status to GitHubApiError', () => {
      const error = new Error('Status only error');
      (error as any).status = 403;

      const result = toGitHubApiError(error);

      // Error objects are returned as-is
      expect(result).toBe(error);
      expect(result.message).toBe('Status only error');
      expect(result).toHaveProperty('status', 403);
    });

    it('should convert Error with only code to GitHubApiError', () => {
      const error = new Error('Code only error');
      (error as any).code = 'TIMEOUT';

      const result = toGitHubApiError(error);

      // Error objects are returned as-is
      expect(result).toBe(error);
      expect(result.message).toBe('Code only error');
      expect(result).toHaveProperty('code', 'TIMEOUT');
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
      const error = 404;

      const result = toGitHubApiError(error);

      expect(result.message).toBe('404');
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

    it('should convert object to GitHubApiError', () => {
      const error = { custom: 'error' };

      const result = toGitHubApiError(error);

      expect(result.message).toBe('[object Object]');
      expect(result.cause).toBe(error);
    });

    it('should handle Error with non-numeric status', () => {
      const error = new Error('Test');
      (error as any).status = 'not-a-number';

      const result = toGitHubApiError(error);

      // The implementation doesn't validate the type
      expect(result).toHaveProperty('status');
    });

    it('should handle Error with non-string code', () => {
      const error = new Error('Test');
      (error as any).code = 123;

      const result = toGitHubApiError(error);

      // The implementation doesn't validate the type
      expect(result).toHaveProperty('code');
    });

    it('should recognize object with message as GitHubApiError', () => {
      const error = {
        message: 'Already GitHubApiError',
        status: 422,
      };

      const result = toGitHubApiError(error);

      expect(result).toBe(error);
    });
  });

  describe('isNotFoundError', () => {
    it('should return true for 404 status', () => {
      const error: GitHubApiError = { message: 'Not found', status: 404 };

      expect(isNotFoundError(error)).toBe(true);
    });

    it('should return false for 403 status', () => {
      const error: GitHubApiError = { message: 'Forbidden', status: 403 };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for 401 status', () => {
      const error: GitHubApiError = { message: 'Unauthorized', status: 401 };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for 500 status', () => {
      const error: GitHubApiError = { message: 'Server error', status: 500 };

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

    it('should return false for 404 status', () => {
      const error: GitHubApiError = { message: 'Not found', status: 404 };

      expect(isAuthError(error)).toBe(false);
    });

    it('should return false for 422 status', () => {
      const error: GitHubApiError = {
        message: 'Validation failed',
        status: 422,
      };

      expect(isAuthError(error)).toBe(false);
    });

    it('should return false for 500 status', () => {
      const error: GitHubApiError = { message: 'Server error', status: 500 };

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

    it('should return false for 400 status', () => {
      const error: GitHubApiError = { message: 'Bad request', status: 400 };

      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for 401 status', () => {
      const error: GitHubApiError = { message: 'Unauthorized', status: 401 };

      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for 404 status', () => {
      const error: GitHubApiError = { message: 'Not found', status: 404 };

      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for 500 status', () => {
      const error: GitHubApiError = { message: 'Server error', status: 500 };

      expect(isValidationError(error)).toBe(false);
    });

    it('should return false for missing status', () => {
      const error: GitHubApiError = { message: 'Error' };

      expect(isValidationError(error)).toBe(false);
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

    it('should handle empty message', () => {
      const error: GitHubApiError = {
        message: '',
        status: 500,
      };

      const result = formatError(error);

      expect(result).toBe(' (HTTP 500)');
    });

    it('should handle long message', () => {
      const longMessage = 'A'.repeat(200);
      const error: GitHubApiError = {
        message: longMessage,
        status: 500,
        code: 'ERROR',
      };

      const result = formatError(error);

      expect(result).toBe(`${longMessage} (HTTP 500) [ERROR]`);
    });

    it('should format status 0 correctly', () => {
      const error: GitHubApiError = {
        message: 'Error',
        status: 0,
      };

      const result = formatError(error);

      // status 0 is falsy, so it should not be included
      expect(result).toBe('Error');
    });
  });
});
