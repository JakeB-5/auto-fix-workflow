/**
 * @module common/error-handler/__tests__/integration.test
 * @description Integration tests for error handler module
 */

import { describe, it, expect } from 'vitest';
import {
  ConfigError,
  GitHubApiError,
  WorktreeError,
  CheckExecutionError,
  ParseError,
  serializeError,
  stringifyError,
  parseSerializedError,
  maskSensitiveData,
  isAutofixError,
  isRetryableError,
  formatErrorForLog,
  formatErrorForUser,
  getErrorChain,
  wrapError,
} from '../index.js';
import { ok, err, isSuccess, isFailure, type Result } from '../../types/result.js';

describe('Error serialization round-trip', () => {
  it('should serialize and parse ConfigError', () => {
    const original = ConfigError.validationError('Invalid config', ['field1 required', 'field2 invalid']);
    const serialized = serializeError(original);
    const json = stringifyError(serialized);
    const parsed = parseSerializedError(json);

    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('ConfigError');
    expect(parsed?.code).toBe('CONFIG_VALIDATION_ERROR');
    expect(parsed?.context?.validationErrors).toEqual(['field1 required', 'field2 invalid']);
  });

  it('should serialize error chain', () => {
    const root = new Error('Database connection failed');
    const middle = ConfigError.parseError('/config.yaml', root);

    const serialized = serializeError(middle);
    const json = stringifyError(serialized, true);
    const parsed = parseSerializedError(json);

    expect(parsed?.cause).toBeDefined();
    expect(parsed?.cause?.message).toBe('Database connection failed');
  });

  it('should mask sensitive data during serialization', () => {
    const error = new ConfigError(
      'CONFIG_VALIDATION_ERROR',
      'API key validation failed for key: ghp_secret123',
      { path: '/config.yaml' }
    );

    const serialized = serializeError(error, { maskSensitive: true });
    const json = stringifyError(serialized);

    expect(json).not.toContain('ghp_secret123');
    expect(json).toContain('***MASKED***');
  });

  it('should preserve stack in development mode', () => {
    const error = ConfigError.notFound('/path');
    const serialized = serializeError(error, { includeStack: true });

    expect(serialized.stack).toBeDefined();
    expect(serialized.stack).toContain('ConfigError');
  });

  it('should omit stack in production mode', () => {
    const error = ConfigError.notFound('/path');
    const serialized = serializeError(error, { includeStack: false });

    expect(serialized.stack).toBeUndefined();
  });
});

describe('Result pattern integration', () => {
  function loadConfig(path: string): Result<{ name: string }, ConfigError> {
    if (path === 'invalid') {
      return err(ConfigError.notFound(path));
    }
    if (path === 'malformed') {
      return err(ConfigError.parseError(path, new SyntaxError('Unexpected token')));
    }
    return ok({ name: 'test-config' });
  }

  it('should handle success case', () => {
    const result = loadConfig('/valid/config.yaml');

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.name).toBe('test-config');
    }
  });

  it('should handle error case with type narrowing', () => {
    const result = loadConfig('invalid');

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(isAutofixError(result.error)).toBe(true);
      expect(result.error.code).toBe('CONFIG_NOT_FOUND');
    }
  });

  it('should chain operations with error propagation', () => {
    function processConfig(path: string): Result<string, ConfigError> {
      const configResult = loadConfig(path);
      if (isFailure(configResult)) {
        return configResult;
      }
      return ok(`processed: ${configResult.data.name}`);
    }

    const successResult = processConfig('/valid');
    expect(isSuccess(successResult)).toBe(true);

    const errorResult = processConfig('invalid');
    expect(isFailure(errorResult)).toBe(true);
  });
});

describe('Error handling workflow', () => {
  function simulateGitHubOperation(): Result<void, GitHubApiError> {
    // Simulate rate limiting
    const resetTime = new Date(Date.now() + 60000);
    return err(GitHubApiError.rateLimited(resetTime, 5000, 0));
  }

  function simulateWorktreeOperation(): Result<void, WorktreeError> {
    return err(WorktreeError.dirty('/worktree', ['file1.ts', 'file2.ts']));
  }

  it('should handle retryable errors', () => {
    const result = simulateGitHubOperation();

    if (isFailure(result)) {
      expect(isRetryableError(result.error)).toBe(true);
      expect(result.error.isRateLimited).toBe(true);
      expect(result.error.rateLimitResetIn).toBeGreaterThan(0);
    }
  });

  it('should provide actionable error information', () => {
    const result = simulateWorktreeOperation();

    if (isFailure(result)) {
      expect(result.error.needsCleanup).toBe(true);
      expect(result.error.context.uncommittedFiles).toHaveLength(2);
    }
  });

  it('should format errors appropriately for different audiences', () => {
    const error = CheckExecutionError.failed('lint', 'eslint .', 1, 'src/file.ts: error');

    const logMessage = formatErrorForLog(error);
    expect(logMessage).toContain('CHECK_FAILED');
    expect(logMessage).toContain('lint');

    const userMessage = formatErrorForUser(error);
    expect(userMessage).toContain('Check execution failed');
    expect(userMessage).not.toContain('CHECK_FAILED');
  });
});

describe('Complex error scenarios', () => {
  it('should handle nested error wrapping', () => {
    // Simulate a complex error chain
    const networkError = new Error('ECONNREFUSED');
    const apiError = GitHubApiError.networkError('Connection refused', networkError);

    const chain = getErrorChain(apiError);
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(apiError);
    expect(chain[1]).toBe(networkError);
  });

  it('should wrap unknown errors safely', () => {
    const unknownError = { weird: 'error object' };

    const wrapped = wrapError(unknownError, (msg, cause) =>
      CheckExecutionError.unknown('test', msg, cause)
    );

    expect(isAutofixError(wrapped)).toBe(true);
    expect(wrapped.code).toBe('CHECK_UNKNOWN');
  });

  it('should handle parse errors with location info', () => {
    const error = ParseError.syntaxError('Unexpected }', 'config.json', 15, 23);

    expect(error.location).toBe('config.json:15:23');
    expect(error.hasPosition).toBe(true);

    const serialized = serializeError(error);
    expect(serialized.context?.line).toBe(15);
    expect(serialized.context?.column).toBe(23);
  });
});

describe('Masking in error context', () => {
  it('should mask sensitive data in error context', () => {
    const errorWithSensitiveContext = {
      message: 'Auth failed',
      context: {
        apiKey: 'ghp_secret123456789012345678901234567890',
        endpoint: '/api/repos',
        headers: {
          authorization: 'Bearer secret-token',
        },
      },
    };

    const masked = maskSensitiveData(errorWithSensitiveContext) as Record<string, unknown>;
    const context = masked['context'] as Record<string, unknown>;
    const headers = context['headers'] as Record<string, unknown>;

    expect(context['apiKey']).toBe('***MASKED***');
    expect(headers['authorization']).toBe('***MASKED***');
    expect(context['endpoint']).toBe('/api/repos');
  });

  it('should mask in serialized error output', () => {
    const error = new GitHubApiError(
      'GITHUB_AUTH_FAILED',
      'Authentication failed with token: ghp_secret',
      {
        endpoint: '/api/repos',
        method: 'GET',
      }
    );

    const serialized = serializeError(error, { maskSensitive: true });
    const json = stringifyError(serialized);

    expect(json).not.toContain('ghp_secret');
    expect(json).toContain('/api/repos'); // Non-sensitive data preserved
  });
});

describe('Error immutability', () => {
  it('should prevent modification of error properties', () => {
    const error = ConfigError.validationError('Error', ['issue1', 'issue2']);

    // Attempting to modify should throw
    expect(() => {
      (error as { code: string }).code = 'MODIFIED';
    }).toThrow();

    expect(() => {
      (error.context as { validationErrors: string[] }).validationErrors = [];
    }).toThrow();
  });

  it('should prevent modification of nested context', () => {
    const error = GitHubApiError.rateLimited(new Date(), 5000, 0);

    expect(() => {
      (error.context.rateLimit as { limit: number }).limit = 9999;
    }).toThrow();
  });
});

describe('Type safety', () => {
  it('should narrow error types correctly', () => {
    const errors: unknown[] = [
      ConfigError.notFound('/path'),
      GitHubApiError.authFailed(),
      new Error('regular error'),
      'string error',
    ];

    const autofixErrors = errors.filter(isAutofixError);
    expect(autofixErrors).toHaveLength(2);

    // Type narrowing should work
    autofixErrors.forEach(error => {
      expect(error.code).toBeDefined();
      expect(error.context).toBeDefined();
    });
  });
});
