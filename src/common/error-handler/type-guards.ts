/**
 * @module common/error-handler/type-guards
 * @description Type guards and formatting utilities for errors
 */

import { AutofixError, isAutofixError } from './base.js';
import type {
  ErrorCode,
  ErrorCodeCategory,
  ConfigErrorCode,
  GitHubErrorCode,
  AsanaErrorCode,
  WorktreeErrorCode,
  CheckErrorCode,
  ParseErrorCode,
} from './codes.js';
import { ERROR_CODE_CATEGORIES, getErrorCodeCategory } from './codes.js';

// Import domain errors (will be available after they're created)
import type { ConfigError } from './config-error.js';
import type { GitHubApiError } from './github-error.js';
import type { AsanaApiError } from './asana-error.js';
import type { WorktreeError } from './worktree-error.js';
import type { CheckExecutionError } from './check-error.js';
import type { ParseError } from './parse-error.js';

/**
 * Type guard for ConfigError
 */
export function isConfigError(error: unknown): error is ConfigError {
  return (
    isAutofixError(error) &&
    error.name === 'ConfigError' &&
    isConfigErrorCode(error.code)
  );
}

/**
 * Type guard for GitHubApiError
 */
export function isGitHubApiError(error: unknown): error is GitHubApiError {
  return (
    isAutofixError(error) &&
    error.name === 'GitHubApiError' &&
    isGitHubErrorCode(error.code)
  );
}

/**
 * Type guard for AsanaApiError
 */
export function isAsanaApiError(error: unknown): error is AsanaApiError {
  return (
    isAutofixError(error) &&
    error.name === 'AsanaApiError' &&
    isAsanaErrorCode(error.code)
  );
}

/**
 * Type guard for WorktreeError
 */
export function isWorktreeError(error: unknown): error is WorktreeError {
  return (
    isAutofixError(error) &&
    error.name === 'WorktreeError' &&
    isWorktreeErrorCode(error.code)
  );
}

/**
 * Type guard for CheckExecutionError
 */
export function isCheckExecutionError(error: unknown): error is CheckExecutionError {
  return (
    isAutofixError(error) &&
    error.name === 'CheckExecutionError' &&
    isCheckErrorCode(error.code)
  );
}

/**
 * Type guard for ParseError
 */
export function isParseError(error: unknown): error is ParseError {
  return (
    isAutofixError(error) &&
    error.name === 'ParseError' &&
    isParseErrorCode(error.code)
  );
}

/**
 * Type guard for ConfigErrorCode
 */
export function isConfigErrorCode(code: ErrorCode): code is ConfigErrorCode {
  return (ERROR_CODE_CATEGORIES.CONFIG as readonly string[]).includes(code);
}

/**
 * Type guard for GitHubErrorCode
 */
export function isGitHubErrorCode(code: ErrorCode): code is GitHubErrorCode {
  return (ERROR_CODE_CATEGORIES.GITHUB as readonly string[]).includes(code);
}

/**
 * Type guard for AsanaErrorCode
 */
export function isAsanaErrorCode(code: ErrorCode): code is AsanaErrorCode {
  return (ERROR_CODE_CATEGORIES.ASANA as readonly string[]).includes(code);
}

/**
 * Type guard for WorktreeErrorCode
 */
export function isWorktreeErrorCode(code: ErrorCode): code is WorktreeErrorCode {
  return (ERROR_CODE_CATEGORIES.WORKTREE as readonly string[]).includes(code);
}

/**
 * Type guard for CheckErrorCode
 */
export function isCheckErrorCode(code: ErrorCode): code is CheckErrorCode {
  return (ERROR_CODE_CATEGORIES.CHECK as readonly string[]).includes(code);
}

/**
 * Type guard for ParseErrorCode
 */
export function isParseErrorCode(code: ErrorCode): code is ParseErrorCode {
  return (ERROR_CODE_CATEGORIES.PARSE as readonly string[]).includes(code);
}

/**
 * Get the category of an error
 */
export function getErrorCategory(error: AutofixError): ErrorCodeCategory | undefined {
  return getErrorCodeCategory(error.code);
}

/**
 * Check if an error is retryable based on its code
 */
export function isRetryableError(error: AutofixError): boolean {
  const retryableCodes: ErrorCode[] = [
    'GITHUB_RATE_LIMITED',
    'GITHUB_NETWORK_ERROR',
    'GITHUB_SERVER_ERROR',
    'ASANA_RATE_LIMITED',
    'ASANA_NETWORK_ERROR',
    'ASANA_SERVER_ERROR',
    'CHECK_TIMEOUT',
    'WORKTREE_LOCKED',
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Check if an error is a client error (user/input error)
 */
export function isClientError(error: AutofixError): boolean {
  const clientErrorCodes: ErrorCode[] = [
    'CONFIG_NOT_FOUND',
    'CONFIG_INVALID_FORMAT',
    'CONFIG_PARSE_ERROR',
    'CONFIG_VALIDATION_ERROR',
    'CONFIG_MISSING_REQUIRED',
    'CONFIG_TYPE_MISMATCH',
    'GITHUB_NOT_FOUND',
    'GITHUB_VALIDATION_ERROR',
    'ASANA_NOT_FOUND',
    'ASANA_VALIDATION_ERROR',
    'WORKTREE_NOT_FOUND',
    'WORKTREE_PATH_INVALID',
    'CHECK_NOT_FOUND',
    'CHECK_INVALID_CONFIG',
    'PARSE_SYNTAX_ERROR',
    'PARSE_UNEXPECTED_TOKEN',
    'PARSE_INVALID_JSON',
    'PARSE_INVALID_YAML',
    'PARSE_INVALID_FORMAT',
  ];

  return clientErrorCodes.includes(error.code);
}

/**
 * Check if an error is an authentication error
 */
export function isAuthError(error: AutofixError): boolean {
  const authErrorCodes: ErrorCode[] = [
    'GITHUB_AUTH_FAILED',
    'GITHUB_FORBIDDEN',
    'ASANA_AUTH_FAILED',
    'ASANA_FORBIDDEN',
  ];

  return authErrorCodes.includes(error.code);
}

/**
 * Format an error for logging
 */
export function formatErrorForLog(error: unknown): string {
  if (isAutofixError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return `[${error.name}] ${error.message}`;
  }

  return String(error);
}

/**
 * Format an error for user display (minimal technical details)
 */
export function formatErrorForUser(error: unknown): string {
  if (isAutofixError(error)) {
    // Provide user-friendly messages based on error category
    const category = getErrorCodeCategory(error.code);

    switch (category) {
      case 'CONFIG':
        return `Configuration error: ${error.message}`;
      case 'GITHUB':
        return `GitHub operation failed: ${error.message}`;
      case 'ASANA':
        return `Asana operation failed: ${error.message}`;
      case 'WORKTREE':
        return `Worktree operation failed: ${error.message}`;
      case 'CHECK':
        return `Check execution failed: ${error.message}`;
      case 'PARSE':
        return `Parse error: ${error.message}`;
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Extract error chain as an array
 */
export function getErrorChain(error: unknown): Error[] {
  const chain: Error[] = [];
  let current: unknown = error;

  while (current instanceof Error) {
    chain.push(current);
    current = current.cause;
  }

  return chain;
}

/**
 * Find the root cause of an error
 */
export function getRootCause(error: unknown): unknown {
  let current: unknown = error;

  while (current instanceof Error && current.cause !== undefined) {
    current = current.cause;
  }

  return current;
}
