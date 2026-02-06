/**
 * @module github/get-issue/__tests__/error-handling
 * @description Unit tests for GitHub issue retrieval error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  createGitHubError,
  isNotFoundError,
  isRateLimitError,
} from '../error-handling.js';
import type { GitHubApiError } from '../../update-issue/types.js';

describe('error-handling', () => {
  describe('createGitHubError', () => {
    it('should return GitHubApiError as-is', () => {
      const error: GitHubApiError = {
        message: 'Test error',
        status: 404,
        code: 'NOT_FOUND',
      };

      const result = createGitHubError(error, 'Test context');

      expect(result).toBe(error);
    });

    it('should create error from Error with status and code', () => {
      const error = new Error('API Error');
      (error as any).status = 500;
      (error as any).code = 'INTERNAL_ERROR';

      const result = createGitHubError(error, 'Fetching issue');

      // Error objects pass isGitHubApiError check (have string message property)
      // So they are returned as-is without adding context
      expect(result.message).toBe('API Error');
      expect(result).toHaveProperty('status', 500);
      expect(result).toHaveProperty('code', 'INTERNAL_ERROR');
    });

    it('should create error from Error with only status', () => {
      const error = new Error('Not found');
      (error as any).status = 404;

      const result = createGitHubError(error, 'Getting issue');

      // Error objects are returned as-is
      expect(result.message).toBe('Not found');
      expect(result).toHaveProperty('status', 404);
    });

    it('should create error from Error with only code', () => {
      const error = new Error('Connection error');
      (error as any).code = 'ECONNREFUSED';

      const result = createGitHubError(error, 'Network request');

      // Error objects are returned as-is
      expect(result.message).toBe('Connection error');
      expect(result).toHaveProperty('code', 'ECONNREFUSED');
    });

    it('should create error from Error without status or code', () => {
      const error = new Error('Generic error');

      const result = createGitHubError(error, 'Operation');

      // Error objects are returned as-is
      expect(result.message).toBe('Generic error');
    });

    it('should create error from string', () => {
      const result = createGitHubError('String error', 'Context');

      expect(result.message).toBe('Context: Unknown error');
      expect(result.cause).toBe('String error');
    });

    it('should create error from number', () => {
      const result = createGitHubError(500, 'HTTP Status');

      expect(result.message).toBe('HTTP Status: Unknown error');
      expect(result.cause).toBe(500);
    });

    it('should create error from null', () => {
      const result = createGitHubError(null, 'Null error');

      expect(result.message).toBe('Null error: Unknown error');
      expect(result.cause).toBeNull();
    });

    it('should create error from undefined', () => {
      const result = createGitHubError(undefined, 'Undefined error');

      expect(result.message).toBe('Undefined error: Unknown error');
      expect(result.cause).toBeUndefined();
    });

    it('should create error from object', () => {
      const obj = { custom: 'data' };
      const result = createGitHubError(obj, 'Object error');

      expect(result.message).toBe('Object error: Unknown error');
      expect(result.cause).toBe(obj);
    });

    it('should include context in message for non-Error objects', () => {
      // Use a plain object to bypass the isGitHubApiError check
      const error = { notAMessage: 'Test' };
      const context = 'Failed to fetch issue #123';

      const result = createGitHubError(error, context);

      expect(result.message).toBe('Failed to fetch issue #123: Unknown error');
      expect(result).toHaveProperty('cause', error);
    });

    it('should handle empty context for non-Error objects', () => {
      const error = 'string error';

      const result = createGitHubError(error, '');

      expect(result.message).toBe(': Unknown error');
      expect(result).toHaveProperty('cause', error);
    });

    it('should handle long context for non-Error objects', () => {
      const error = 123;
      const longContext = 'A'.repeat(200);

      const result = createGitHubError(error, longContext);

      expect(result.message).toBe(`${longContext}: Unknown error`);
      expect(result).toHaveProperty('cause', error);
    });

    it('should handle Error with non-numeric status', () => {
      const error = new Error('Test');
      (error as any).status = 'not-a-number';

      const result = createGitHubError(error, 'Context');

      // The implementation doesn't validate the type
      // but non-undefined values are still included
      expect(result).toHaveProperty('status');
    });

    it('should handle Error with non-string code', () => {
      const error = new Error('Test');
      (error as any).code = 123;

      const result = createGitHubError(error, 'Context');

      // The implementation doesn't validate the type
      // but non-undefined values are still included
      expect(result).toHaveProperty('code');
    });

    it('should not spread status when undefined', () => {
      const error = new Error('Test');

      const result = createGitHubError(error, 'Context');

      expect('status' in result).toBe(false);
    });

    it('should not spread code when undefined', () => {
      const error = new Error('Test');

      const result = createGitHubError(error, 'Context');

      expect('code' in result).toBe(false);
    });

    it('should spread status when 0', () => {
      const error = new Error('Test');
      (error as any).status = 0;

      const result = createGitHubError(error, 'Context');

      // 0 is a valid number, so it should be included
      expect(result.status).toBe(0);
    });
  });

  describe('isNotFoundError', () => {
    it('should return true for 404 status', () => {
      const error = { status: 404, message: 'Not found' };

      expect(isNotFoundError(error)).toBe(true);
    });

    it('should return false for 403 status', () => {
      const error = { status: 403, message: 'Forbidden' };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for 401 status', () => {
      const error = { status: 401, message: 'Unauthorized' };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for 500 status', () => {
      const error = { status: 500, message: 'Server error' };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNotFoundError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isNotFoundError(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isNotFoundError('error')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isNotFoundError(404)).toBe(false);
    });

    it('should return false for object without status', () => {
      const error = { message: 'Error' };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should return false for object with non-numeric status', () => {
      const error = { status: 'not-a-number', message: 'Error' };

      expect(isNotFoundError(error)).toBe(false);
    });

    it('should handle Error instance with status', () => {
      const error = new Error('Not found');
      (error as any).status = 404;

      expect(isNotFoundError(error)).toBe(true);
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for 403 status', () => {
      const error = { status: 403, message: 'Rate limit' };

      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for 404 status', () => {
      const error = { status: 404, message: 'Not found' };

      expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for 401 status', () => {
      const error = { status: 401, message: 'Unauthorized' };

      expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for 429 status', () => {
      const error = { status: 429, message: 'Too many requests' };

      expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for 500 status', () => {
      const error = { status: 500, message: 'Server error' };

      expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isRateLimitError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRateLimitError(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isRateLimitError('error')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isRateLimitError(403)).toBe(false);
    });

    it('should return false for object without status', () => {
      const error = { message: 'Error' };

      expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for object with non-numeric status', () => {
      const error = { status: 'not-a-number', message: 'Error' };

      expect(isRateLimitError(error)).toBe(false);
    });

    it('should handle Error instance with 403 status', () => {
      const error = new Error('Forbidden');
      (error as any).status = 403;

      expect(isRateLimitError(error)).toBe(true);
    });
  });
});
