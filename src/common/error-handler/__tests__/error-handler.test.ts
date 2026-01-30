/**
 * @module common/error-handler/__tests__/error-handler.test
 * @description Unit tests for error handler module
 */

import { describe, it, expect } from 'vitest';
import {
  AutofixError,
  isAutofixError,
  wrapError,
  ConfigError,
  GitHubApiError,
  AsanaApiError,
  WorktreeError,
  CheckExecutionError,
  ParseError,
  isConfigError,
  isGitHubApiError,
  isAsanaApiError,
  isWorktreeError,
  isCheckExecutionError,
  isParseError,
  isRetryableError,
  isClientError,
  isAuthError,
  getErrorCategory,
  formatErrorForLog,
  formatErrorForUser,
  getErrorChain,
  getRootCause,
  serializeError,
} from '../index.js';

describe('AutofixError base class', () => {
  it('should have correct name', () => {
    const error = ConfigError.notFound('/path/to/config');
    expect(error.name).toBe('ConfigError');
  });

  it('should have timestamp', () => {
    const before = new Date();
    const error = ConfigError.notFound('/path/to/config');
    const after = new Date();

    expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should support cause chaining', () => {
    const cause = new Error('Original error');
    const error = ConfigError.parseError('/path/to/config', cause);

    expect(error.cause).toBe(cause);
  });

  it('should be instanceof Error', () => {
    const error = ConfigError.notFound('/path/to/config');
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AutofixError).toBe(true);
  });

  it('should have proper toString', () => {
    const error = ConfigError.notFound('/path/to/config');
    expect(error.toString()).toContain('ConfigError');
    expect(error.toString()).toContain('CONFIG_NOT_FOUND');
  });

  it('should serialize to JSON', () => {
    const error = ConfigError.notFound('/path/to/config');
    const json = error.toJSON();

    expect(json.name).toBe('ConfigError');
    expect(json.code).toBe('CONFIG_NOT_FOUND');
    expect(json.timestamp).toBeDefined();
  });
});

describe('ConfigError', () => {
  it('should create notFound error', () => {
    const error = ConfigError.notFound('/path/to/config.yaml');

    expect(error.code).toBe('CONFIG_NOT_FOUND');
    expect(error.context.path).toBe('/path/to/config.yaml');
    expect(error.message).toContain('/path/to/config.yaml');
  });

  it('should create invalidFormat error', () => {
    const error = ConfigError.invalidFormat('/path', 'object', 'array');

    expect(error.code).toBe('CONFIG_INVALID_FORMAT');
    expect(error.context.expected).toBe('object');
    expect(error.context.actual).toBe('array');
  });

  it('should create validationError with multiple errors', () => {
    const errors = ['field1 is required', 'field2 must be a number'];
    const error = ConfigError.validationError('Validation failed', errors);

    expect(error.code).toBe('CONFIG_VALIDATION_ERROR');
    expect(error.context.validationErrors).toEqual(errors);
  });

  it('should create typeMismatch error', () => {
    const error = ConfigError.typeMismatch('port', 'number', 'string', 'abc');

    expect(error.code).toBe('CONFIG_TYPE_MISMATCH');
    expect(error.context.field).toBe('port');
    expect(error.context.value).toBe('abc');
  });

  it('should be immutable', () => {
    const error = ConfigError.notFound('/path');

    expect(() => {
      (error as { code: string }).code = 'MODIFIED';
    }).toThrow();

    expect(() => {
      (error.context as { path: string }).path = 'modified';
    }).toThrow();
  });
});

describe('GitHubApiError', () => {
  it('should create from response', () => {
    const error = GitHubApiError.fromResponse(404, 'Not found', {
      owner: 'user',
      repo: 'repo',
    });

    expect(error.code).toBe('GITHUB_NOT_FOUND');
    expect(error.context.statusCode).toBe(404);
  });

  it('should map status codes correctly', () => {
    expect(GitHubApiError.statusToCode(401)).toBe('GITHUB_AUTH_FAILED');
    expect(GitHubApiError.statusToCode(403)).toBe('GITHUB_FORBIDDEN');
    expect(GitHubApiError.statusToCode(404)).toBe('GITHUB_NOT_FOUND');
    expect(GitHubApiError.statusToCode(409)).toBe('GITHUB_CONFLICT');
    expect(GitHubApiError.statusToCode(422)).toBe('GITHUB_VALIDATION_ERROR');
    expect(GitHubApiError.statusToCode(429)).toBe('GITHUB_RATE_LIMITED');
    expect(GitHubApiError.statusToCode(500)).toBe('GITHUB_SERVER_ERROR');
    expect(GitHubApiError.statusToCode(418)).toBe('GITHUB_UNKNOWN');
  });

  it('should create rateLimited error with reset time', () => {
    const resetTime = new Date(Date.now() + 60000);
    const error = GitHubApiError.rateLimited(resetTime, 5000, 0);

    expect(error.code).toBe('GITHUB_RATE_LIMITED');
    expect(error.isRateLimited).toBe(true);
    expect(error.context.rateLimit?.reset).toEqual(resetTime);
    expect(error.rateLimitResetIn).toBeGreaterThan(0);
  });

  it('should create notFound error', () => {
    const error = GitHubApiError.notFound('Repository', {
      owner: 'user',
      repo: 'repo',
    });

    expect(error.code).toBe('GITHUB_NOT_FOUND');
    expect(error.message).toContain('user/repo');
  });
});

describe('AsanaApiError', () => {
  it('should create rateLimited error', () => {
    const error = AsanaApiError.rateLimited(30);

    expect(error.code).toBe('ASANA_RATE_LIMITED');
    expect(error.isRateLimited).toBe(true);
    expect(error.context.retryAfter).toBe(30);
    expect(error.retryDelayMs).toBe(30000);
  });

  it('should create notFound error', () => {
    const error = AsanaApiError.notFound('Task', '12345');

    expect(error.code).toBe('ASANA_NOT_FOUND');
    expect(error.message).toContain('12345');
  });
});

describe('WorktreeError', () => {
  it('should create createFailed error', () => {
    const error = WorktreeError.createFailed(
      '/path/to/worktree',
      'feature-branch',
      'Branch already exists'
    );

    expect(error.code).toBe('WORKTREE_CREATE_FAILED');
    expect(error.context.path).toBe('/path/to/worktree');
    expect(error.context.branch).toBe('feature-branch');
  });

  it('should create dirty error with uncommitted files', () => {
    const files = ['file1.ts', 'file2.ts'];
    const error = WorktreeError.dirty('/path', files);

    expect(error.code).toBe('WORKTREE_DIRTY');
    expect(error.context.uncommittedFiles).toEqual(files);
    expect(error.needsCleanup).toBe(true);
  });

  it('should create locked error', () => {
    const error = WorktreeError.locked('/path', '/path/.git/worktrees/foo/locked');

    expect(error.code).toBe('WORKTREE_LOCKED');
    expect(error.canRetryAfterUnlock).toBe(true);
  });
});

describe('CheckExecutionError', () => {
  it('should create timeout error', () => {
    const error = CheckExecutionError.timeout('type-check', 'tsc', 30000, 30500);

    expect(error.code).toBe('CHECK_TIMEOUT');
    expect(error.isTimeout).toBe(true);
    expect(error.context.timeout).toBe(30000);
  });

  it('should create failed error with output', () => {
    const error = CheckExecutionError.failed(
      'lint',
      'eslint .',
      1,
      'Error: no-unused-vars',
      ''
    );

    expect(error.code).toBe('CHECK_FAILED');
    expect(error.context.exitCode).toBe(1);
    expect(error.context.stderr).toContain('no-unused-vars');
  });

  it('should create dependency error', () => {
    const error = CheckExecutionError.dependencyError('test', 'jest');

    expect(error.code).toBe('CHECK_DEPENDENCY_ERROR');
    expect(error.needsDependencies).toBe(true);
  });

  it('should provide summary', () => {
    const error = CheckExecutionError.failed('lint', 'eslint', 1);
    expect(error.summary).toContain('lint');
    expect(error.summary).toContain('exit code 1');
  });
});

describe('ParseError', () => {
  it('should create syntaxError with position', () => {
    const error = ParseError.syntaxError('Unexpected end of input', 'config.json', 10, 5);

    expect(error.code).toBe('PARSE_SYNTAX_ERROR');
    expect(error.location).toBe('config.json:10:5');
    expect(error.hasPosition).toBe(true);
  });

  it('should create unexpectedToken error', () => {
    const error = ParseError.unexpectedToken('}', 'EOF', 'test.json', 5);

    expect(error.code).toBe('PARSE_UNEXPECTED_TOKEN');
    expect(error.context.expected).toBe('}');
    expect(error.context.found).toBe('EOF');
  });

  it('should create invalidJson error', () => {
    const cause = new SyntaxError('Unexpected token');
    const error = ParseError.invalidJson('Unexpected token', 'config.json', cause);

    expect(error.code).toBe('PARSE_INVALID_JSON');
    expect(error.context.parser).toBe('json');
    expect(error.cause).toBe(cause);
  });

  it('should truncate long input', () => {
    const longInput = 'a'.repeat(200);
    const error = ParseError.invalidFormat('object', 'string', 'test.json', longInput);

    expect(error.context.input?.length).toBeLessThan(150);
    expect(error.context.input).toContain('...');
  });
});

describe('Type guards', () => {
  it('should identify AutofixError', () => {
    const autofixError = ConfigError.notFound('/path');
    const regularError = new Error('test');

    expect(isAutofixError(autofixError)).toBe(true);
    expect(isAutofixError(regularError)).toBe(false);
    expect(isAutofixError(null)).toBe(false);
    expect(isAutofixError('string')).toBe(false);
  });

  it('should identify specific error types', () => {
    const configErr = ConfigError.notFound('/path');
    const githubErr = GitHubApiError.authFailed();
    const asanaErr = AsanaApiError.authFailed();
    const worktreeErr = WorktreeError.notFound('/path');
    const checkErr = CheckExecutionError.timeout('test', 'cmd', 1000);
    const parseErr = ParseError.invalidJson('error');

    expect(isConfigError(configErr)).toBe(true);
    expect(isConfigError(githubErr)).toBe(false);

    expect(isGitHubApiError(githubErr)).toBe(true);
    expect(isGitHubApiError(configErr)).toBe(false);

    expect(isAsanaApiError(asanaErr)).toBe(true);
    expect(isWorktreeError(worktreeErr)).toBe(true);
    expect(isCheckExecutionError(checkErr)).toBe(true);
    expect(isParseError(parseErr)).toBe(true);
  });
});

describe('Error utilities', () => {
  it('should identify retryable errors', () => {
    expect(isRetryableError(GitHubApiError.rateLimited(new Date(), 5000, 0))).toBe(true);
    expect(isRetryableError(GitHubApiError.networkError('timeout'))).toBe(true);
    expect(isRetryableError(AsanaApiError.rateLimited(30))).toBe(true);
    expect(isRetryableError(CheckExecutionError.timeout('test', 'cmd', 1000))).toBe(true);
    expect(isRetryableError(ConfigError.notFound('/path'))).toBe(false);
  });

  it('should identify client errors', () => {
    expect(isClientError(ConfigError.notFound('/path'))).toBe(true);
    expect(isClientError(ConfigError.validationError('error', []))).toBe(true);
    expect(isClientError(GitHubApiError.rateLimited(new Date(), 5000, 0))).toBe(false);
  });

  it('should identify auth errors', () => {
    expect(isAuthError(GitHubApiError.authFailed())).toBe(true);
    expect(isAuthError(AsanaApiError.authFailed())).toBe(true);
    expect(isAuthError(ConfigError.notFound('/path'))).toBe(false);
  });

  it('should get error category', () => {
    expect(getErrorCategory(ConfigError.notFound('/path'))).toBe('CONFIG');
    expect(getErrorCategory(GitHubApiError.authFailed())).toBe('GITHUB');
    expect(getErrorCategory(AsanaApiError.authFailed())).toBe('ASANA');
    expect(getErrorCategory(WorktreeError.notFound('/path'))).toBe('WORKTREE');
    expect(getErrorCategory(CheckExecutionError.timeout('test', 'cmd', 1000))).toBe('CHECK');
    expect(getErrorCategory(ParseError.invalidJson('error'))).toBe('PARSE');
  });

  it('should format error for log', () => {
    const error = ConfigError.notFound('/path');
    const formatted = formatErrorForLog(error);

    expect(formatted).toContain('CONFIG_NOT_FOUND');
    expect(formatted).toContain('/path');
  });

  it('should format error for user', () => {
    const error = ConfigError.notFound('/path');
    const formatted = formatErrorForUser(error);

    expect(formatted).toContain('Configuration error');
    expect(formatted).not.toContain('CONFIG_NOT_FOUND');
  });

  it('should get error chain', () => {
    const root = new Error('Root cause');
    const middle = new Error('Middle error', { cause: root });
    const top = ConfigError.parseError('/path', middle);

    const chain = getErrorChain(top);

    expect(chain).toHaveLength(3);
    expect(chain[0]).toBe(top);
    expect(chain[1]).toBe(middle);
    expect(chain[2]).toBe(root);
  });

  it('should get root cause', () => {
    const root = new Error('Root cause');
    const middle = new Error('Middle error', { cause: root });
    const top = ConfigError.parseError('/path', middle);

    expect(getRootCause(top)).toBe(root);
    expect(getRootCause(root)).toBe(root);
    expect(getRootCause('string')).toBe('string');
  });
});

describe('wrapError', () => {
  it('should return original if already AutofixError', () => {
    const original = ConfigError.notFound('/path');
    const wrapped = wrapError(original, (msg, cause) =>
      ConfigError.parseError('/path', cause)
    );

    expect(wrapped).toBe(original);
  });

  it('should wrap regular Error', () => {
    const original = new Error('Something went wrong');
    const wrapped = wrapError(original, (msg, cause) =>
      new ConfigError('CONFIG_PARSE_ERROR', msg, {}, { cause })
    );

    expect(wrapped).not.toBe(original);
    expect(wrapped.message).toBe('Something went wrong');
    expect(wrapped.cause).toBe(original);
  });

  it('should wrap non-Error values', () => {
    const wrapped = wrapError('string error', (msg, cause) =>
      new ConfigError('CONFIG_PARSE_ERROR', msg, {}, { cause })
    );

    expect(wrapped.message).toBe('string error');
  });
});

describe('serializeError', () => {
  it('should serialize AutofixError', () => {
    const error = ConfigError.notFound('/path/to/config');
    const serialized = serializeError(error);

    expect(serialized.name).toBe('ConfigError');
    expect(serialized.code).toBe('CONFIG_NOT_FOUND');
    expect(serialized.context?.path).toBe('/path/to/config');
    expect(serialized.timestamp).toBeDefined();
  });

  it('should serialize with cause chain', () => {
    const cause = new Error('Root cause');
    const error = ConfigError.parseError('/path', cause);
    const serialized = serializeError(error);

    expect(serialized.cause).toBeDefined();
    expect(serialized.cause?.name).toBe('Error');
    expect(serialized.cause?.message).toBe('Root cause');
  });

  it('should handle non-Error values', () => {
    const serialized = serializeError('string error');

    expect(serialized.name).toBe('UnknownError');
    expect(serialized.message).toBe('string error');
  });

  it('should handle null/undefined', () => {
    expect(serializeError(null).message).toBe('null');
    expect(serializeError(undefined).message).toBe('undefined');
  });
});
