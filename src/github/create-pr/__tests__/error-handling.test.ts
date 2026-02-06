/**
 * @module github/create-pr/__tests__/error-handling
 * @description Unit tests for PR creation error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  GitHubApiError,
  GitHubApiErrorCode,
  GitError,
  handleOctokitError,
  handleGitError,
} from '../error-handling.js';

describe('error-handling', () => {
  describe('GitHubApiError', () => {
    it('should create error with all properties', () => {
      const error = new GitHubApiError(
        GitHubApiErrorCode.NOT_FOUND,
        'Resource not found',
        404,
        { extra: 'data' }
      );

      expect(error.code).toBe(GitHubApiErrorCode.NOT_FOUND);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ extra: 'data' });
      expect(error.name).toBe('GitHubApiError');
    });

    it('should create error without optional properties', () => {
      const error = new GitHubApiError(
        GitHubApiErrorCode.UNKNOWN,
        'Unknown error'
      );

      expect(error.code).toBe(GitHubApiErrorCode.UNKNOWN);
      expect(error.message).toBe('Unknown error');
      expect(error.statusCode).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it('should be instance of Error', () => {
      const error = new GitHubApiError(
        GitHubApiErrorCode.UNKNOWN,
        'Test'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GitHubApiError);
    });

    describe('toUserMessage', () => {
      it('should return auth message for UNAUTHORIZED', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.UNAUTHORIZED,
          'Bad token'
        );

        expect(error.toUserMessage()).toBe(
          'Authentication failed. Please check your GitHub token.'
        );
      });

      it('should return not found message for NOT_FOUND', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.NOT_FOUND,
          'Repo not found'
        );

        expect(error.toUserMessage()).toBe(
          'Repository or branch not found. Please check the owner, repo, and branch names.'
        );
      });

      it('should return validation message for VALIDATION_FAILED', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.VALIDATION_FAILED,
          'Invalid data'
        );

        expect(error.toUserMessage()).toBe('Validation failed: Invalid data');
      });

      it('should return already exists message for ALREADY_EXISTS', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.ALREADY_EXISTS,
          'PR exists'
        );

        expect(error.toUserMessage()).toBe(
          'A pull request already exists for this branch.'
        );
      });

      it('should return network message for NETWORK_ERROR', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.NETWORK_ERROR,
          'Connection failed'
        );

        expect(error.toUserMessage()).toBe(
          'Network error occurred. Please check your internet connection.'
        );
      });

      it('should return rate limit message for RATE_LIMIT', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.RATE_LIMIT,
          'Too many requests'
        );

        expect(error.toUserMessage()).toBe(
          'GitHub API rate limit exceeded. Please try again later.'
        );
      });

      it('should return generic message for UNKNOWN', () => {
        const error = new GitHubApiError(
          GitHubApiErrorCode.UNKNOWN,
          'Something went wrong'
        );

        expect(error.toUserMessage()).toBe(
          'An error occurred: Something went wrong'
        );
      });
    });
  });

  describe('handleOctokitError', () => {
    it('should return GitHubApiError as-is', () => {
      const error = new GitHubApiError(
        GitHubApiErrorCode.NOT_FOUND,
        'Not found'
      );

      const result = handleOctokitError(error);

      expect(result).toBe(error);
    });

    it('should handle 401 error', () => {
      const error = { status: 401, message: 'Unauthorized' };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.UNAUTHORIZED);
      expect(result.message).toBe('Unauthorized: Invalid or missing GitHub token');
      expect(result.statusCode).toBe(401);
      expect(result.details).toBe(error);
    });

    it('should handle 404 error', () => {
      const error = { status: 404, message: 'Not Found' };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.NOT_FOUND);
      expect(result.message).toBe('Not found: Repository, branch, or resource does not exist');
      expect(result.statusCode).toBe(404);
    });

    it('should handle 422 validation error', () => {
      const error = { status: 422, message: 'Validation Failed' };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.VALIDATION_FAILED);
      expect(result.message).toBe('Validation Failed');
      expect(result.statusCode).toBe(422);
    });

    it('should handle 422 already exists error', () => {
      const error = {
        status: 422,
        message: 'A pull request already exists for user:branch',
      };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.ALREADY_EXISTS);
      expect(result.message).toBe('A pull request already exists for this head and base');
      expect(result.statusCode).toBe(422);
    });

    it('should handle 403 rate limit error', () => {
      const error = {
        status: 403,
        message: 'API rate limit exceeded',
      };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.RATE_LIMIT);
      expect(result.message).toBe('API rate limit exceeded');
      expect(result.statusCode).toBe(403);
    });

    it('should handle 403 forbidden error', () => {
      const error = {
        status: 403,
        message: 'Forbidden',
      };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.UNAUTHORIZED);
      expect(result.message).toBe('Forbidden: Insufficient permissions');
      expect(result.statusCode).toBe(403);
    });

    it('should handle unknown status code', () => {
      const error = {
        status: 500,
        message: 'Internal Server Error',
      };

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.UNKNOWN);
      expect(result.message).toBe('Internal Server Error');
      expect(result.statusCode).toBe(500);
    });

    it('should handle network error', () => {
      const error = new Error('connect ECONNREFUSED');

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.NETWORK_ERROR);
      expect(result.message).toBe('Network error: Unable to reach GitHub API');
    });

    it('should detect ENOTFOUND as network error', () => {
      const error = new Error('getaddrinfo ENOTFOUND api.github.com');

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.NETWORK_ERROR);
    });

    it('should detect ETIMEDOUT as network error', () => {
      const error = new Error('Connection timeout error');

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.NETWORK_ERROR);
    });

    it('should detect timeout in message', () => {
      const error = new Error('Request timeout occurred');

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.NETWORK_ERROR);
    });

    it('should handle generic Error', () => {
      const error = new Error('Generic error');

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.UNKNOWN);
      expect(result.message).toBe('Generic error');
      expect(result.statusCode).toBeUndefined();
    });

    it('should handle non-error object', () => {
      const error = 'string error';

      const result = handleOctokitError(error);

      expect(result.code).toBe(GitHubApiErrorCode.UNKNOWN);
      expect(result.message).toBe('An unknown error occurred');
    });

    it('should handle null', () => {
      const result = handleOctokitError(null);

      expect(result.code).toBe(GitHubApiErrorCode.UNKNOWN);
    });

    it('should handle undefined', () => {
      const result = handleOctokitError(undefined);

      expect(result.code).toBe(GitHubApiErrorCode.UNKNOWN);
    });

    it('should handle error without message', () => {
      const error = { status: 500 };

      const result = handleOctokitError(error);

      expect(result.message).toBe('Unknown GitHub API error');
    });
  });

  describe('GitError', () => {
    it('should create error with all properties', () => {
      const error = new GitError(
        'Command failed',
        'git push',
        { exitCode: 1 }
      );

      expect(error.message).toBe('Command failed');
      expect(error.command).toBe('git push');
      expect(error.details).toEqual({ exitCode: 1 });
      expect(error.name).toBe('GitError');
    });

    it('should create error without optional properties', () => {
      const error = new GitError('Git error');

      expect(error.message).toBe('Git error');
      expect(error.command).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it('should be instance of Error', () => {
      const error = new GitError('Test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GitError);
    });

    describe('toUserMessage', () => {
      it('should include command in message', () => {
        const error = new GitError('Failed', 'git push origin main');

        expect(error.toUserMessage()).toBe(
          'Git command failed (git push origin main): Failed'
        );
      });

      it('should omit command if not provided', () => {
        const error = new GitError('Failed');

        expect(error.toUserMessage()).toBe('Git error: Failed');
      });
    });
  });

  describe('handleGitError', () => {
    it('should return GitError as-is', () => {
      const error = new GitError('Test', 'git commit');

      const result = handleGitError(error);

      expect(result).toBe(error);
    });

    it('should convert Error to GitError', () => {
      const error = new Error('Command failed');

      const result = handleGitError(error, 'git push');

      expect(result).toBeInstanceOf(GitError);
      expect(result.message).toBe('Command failed');
      expect(result.command).toBe('git push');
      expect(result.details).toBe(error);
    });

    it('should convert Error without command', () => {
      const error = new Error('Generic error');

      const result = handleGitError(error);

      expect(result).toBeInstanceOf(GitError);
      expect(result.message).toBe('Generic error');
      expect(result.command).toBeUndefined();
    });

    it('should handle string error', () => {
      const result = handleGitError('string error', 'git pull');

      expect(result).toBeInstanceOf(GitError);
      expect(result.message).toBe('Unknown git error');
      expect(result.command).toBe('git pull');
      expect(result.details).toBe('string error');
    });

    it('should handle null', () => {
      const result = handleGitError(null, 'git fetch');

      expect(result).toBeInstanceOf(GitError);
      expect(result.message).toBe('Unknown git error');
      expect(result.command).toBe('git fetch');
      expect(result.details).toBeNull();
    });

    it('should handle undefined', () => {
      const result = handleGitError(undefined);

      expect(result).toBeInstanceOf(GitError);
      expect(result.message).toBe('Unknown git error');
      expect(result.command).toBeUndefined();
      expect(result.details).toBeUndefined();
    });

    it('should handle object error', () => {
      const error = { custom: 'data' };

      const result = handleGitError(error, 'git status');

      expect(result).toBeInstanceOf(GitError);
      expect(result.message).toBe('Unknown git error');
      expect(result.details).toBe(error);
    });
  });
});
