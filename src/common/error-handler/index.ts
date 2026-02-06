/**
 * @module common/error-handler
 * @description Error handling module for the autofix workflow
 *
 * This module provides a comprehensive error handling system with:
 * - Type-safe error codes organized by domain
 * - Immutable error classes with rich context
 * - Sensitive data masking for logging
 * - Serialization for storage and transmission
 * - Type guards and formatting utilities
 *
 * @example
 * ```typescript
 * import {
 *   ConfigError,
 *   GitHubApiError,
 *   isAutofixError,
 *   maskSensitiveData,
 *   err,
 * } from './common/error-handler/index.js';
 *
 * // Create domain-specific errors
 * const configErr = ConfigError.notFound('/path/to/config.yaml');
 * const githubErr = GitHubApiError.rateLimited(new Date(), 5000, 0);
 *
 * // Type guard usage
 * if (isAutofixError(error)) {
 *   console.log(`[${error.code}] ${error.message}`);
 * }
 *
 * // Result pattern
 * function loadConfig(path: string): Result<Config, ConfigError> {
 *   if (!exists(path)) {
 *     return err(ConfigError.notFound(path));
 *   }
 *   // ...
 * }
 *
 * // Mask sensitive data before logging
 * const safeData = maskSensitiveData({ apiKey: 'secret123' });
 * ```
 */

// Error codes
export type {
  ErrorCode,
  ErrorCodeCategory,
  ConfigErrorCode,
  GitHubErrorCode,
  AsanaErrorCode,
  WorktreeErrorCode,
  CheckErrorCode,
  ParseErrorCode,
  PipelineErrorCode,
  IssueErrorCode,
} from './codes.js';

export {
  ERROR_CODE_CATEGORIES,
  isErrorCodeInCategory,
  getErrorCodeCategory,
} from './codes.js';

// Base error
export { AutofixError, isAutofixError, wrapError } from './base.js';
export type { BaseErrorContext } from './base.js';

// Domain errors
export { ConfigError } from './config-error.js';
export type { ConfigErrorContext } from './config-error.js';

export { GitHubApiError } from './github-error.js';
export type { GitHubApiErrorContext } from './github-error.js';

export { AsanaApiError } from './asana-error.js';
export type { AsanaApiErrorContext } from './asana-error.js';

export { WorktreeError } from './worktree-error.js';
export type { WorktreeErrorContext } from './worktree-error.js';

export { CheckExecutionError } from './check-error.js';
export type { CheckExecutionErrorContext } from './check-error.js';

export { ParseError } from './parse-error.js';
export type { ParseErrorContext } from './parse-error.js';

export { PipelineError } from './pipeline-error.js';
export type { PipelineErrorContext } from './pipeline-error.js';

export { IssueError } from './issue-error.js';
export type { IssueErrorContext } from './issue-error.js';

// Serialization
export {
  serializeError,
  stringifyError,
  parseSerializedError,
} from './serializer.js';
export type { SerializedError, SerializeOptions } from './serializer.js';

// Masking
export {
  maskSensitiveData,
  createMasker,
  looksLikeSensitiveValue,
} from './masking.js';

// Type guards and utilities
export {
  isConfigError,
  isGitHubApiError,
  isAsanaApiError,
  isWorktreeError,
  isCheckExecutionError,
  isParseError,
  isPipelineError,
  isIssueError,
  isConfigErrorCode,
  isGitHubErrorCode,
  isAsanaErrorCode,
  isWorktreeErrorCode,
  isCheckErrorCode,
  isParseErrorCode,
  isPipelineErrorCode,
  isIssueErrorCode,
  getErrorCategory,
  isRetryableError,
  isClientError,
  isAuthError,
  formatErrorForLog,
  formatErrorForUser,
  getErrorChain,
  getRootCause,
} from './type-guards.js';
