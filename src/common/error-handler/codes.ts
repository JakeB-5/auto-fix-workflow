/**
 * @module common/error-handler/codes
 * @description Error code type definitions for the autofix workflow
 */

/**
 * Configuration error codes
 */
export type ConfigErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID_FORMAT'
  | 'CONFIG_PARSE_ERROR'
  | 'CONFIG_VALIDATION_ERROR'
  | 'CONFIG_MISSING_REQUIRED'
  | 'CONFIG_TYPE_MISMATCH';

/**
 * GitHub API error codes
 */
export type GitHubErrorCode =
  | 'GITHUB_AUTH_FAILED'
  | 'GITHUB_RATE_LIMITED'
  | 'GITHUB_NOT_FOUND'
  | 'GITHUB_FORBIDDEN'
  | 'GITHUB_NETWORK_ERROR'
  | 'GITHUB_VALIDATION_ERROR'
  | 'GITHUB_CONFLICT'
  | 'GITHUB_SERVER_ERROR'
  | 'GITHUB_UNKNOWN';

/**
 * Asana API error codes
 */
export type AsanaErrorCode =
  | 'ASANA_AUTH_FAILED'
  | 'ASANA_RATE_LIMITED'
  | 'ASANA_NOT_FOUND'
  | 'ASANA_FORBIDDEN'
  | 'ASANA_NETWORK_ERROR'
  | 'ASANA_VALIDATION_ERROR'
  | 'ASANA_SERVER_ERROR'
  | 'ASANA_UNKNOWN';

/**
 * Worktree error codes
 */
export type WorktreeErrorCode =
  | 'WORKTREE_CREATE_FAILED'
  | 'WORKTREE_REMOVE_FAILED'
  | 'WORKTREE_NOT_FOUND'
  | 'WORKTREE_ALREADY_EXISTS'
  | 'WORKTREE_LOCKED'
  | 'WORKTREE_DIRTY'
  | 'WORKTREE_GIT_ERROR'
  | 'WORKTREE_PATH_INVALID';

/**
 * Check execution error codes
 */
export type CheckErrorCode =
  | 'CHECK_TIMEOUT'
  | 'CHECK_FAILED'
  | 'CHECK_NOT_FOUND'
  | 'CHECK_INVALID_CONFIG'
  | 'CHECK_DEPENDENCY_ERROR'
  | 'CHECK_PERMISSION_DENIED'
  | 'CHECK_UNKNOWN';

/**
 * Parse error codes
 */
export type ParseErrorCode =
  | 'PARSE_SYNTAX_ERROR'
  | 'PARSE_UNEXPECTED_TOKEN'
  | 'PARSE_INVALID_JSON'
  | 'PARSE_INVALID_YAML'
  | 'PARSE_INVALID_FORMAT'
  | 'PARSE_ENCODING_ERROR';

/**
 * Pipeline error codes
 */
export type PipelineErrorCode =
  | 'PIPELINE_INIT_FAILED'
  | 'PIPELINE_FAILED'
  | 'PIPELINE_INTERRUPTED'
  | 'PIPELINE_TIMEOUT'
  | 'AI_ANALYSIS_FAILED'
  | 'AI_FIX_FAILED'
  | 'INSTALL_DEPS_FAILED';

/**
 * Issue error codes
 */
export type IssueErrorCode =
  | 'ISSUE_NOT_FOUND'
  | 'NO_ISSUES_FOUND'
  | 'ISSUE_UPDATE_FAILED'
  | 'PR_EXISTS'
  | 'PR_CREATE_FAILED';

/**
 * Union of all error codes
 */
export type ErrorCode =
  | ConfigErrorCode
  | GitHubErrorCode
  | AsanaErrorCode
  | WorktreeErrorCode
  | CheckErrorCode
  | ParseErrorCode
  | PipelineErrorCode
  | IssueErrorCode;

/**
 * Error code category mapping
 */
export const ERROR_CODE_CATEGORIES = {
  CONFIG: [
    'CONFIG_NOT_FOUND',
    'CONFIG_INVALID_FORMAT',
    'CONFIG_PARSE_ERROR',
    'CONFIG_VALIDATION_ERROR',
    'CONFIG_MISSING_REQUIRED',
    'CONFIG_TYPE_MISMATCH',
  ] as const,
  GITHUB: [
    'GITHUB_AUTH_FAILED',
    'GITHUB_RATE_LIMITED',
    'GITHUB_NOT_FOUND',
    'GITHUB_FORBIDDEN',
    'GITHUB_NETWORK_ERROR',
    'GITHUB_VALIDATION_ERROR',
    'GITHUB_CONFLICT',
    'GITHUB_SERVER_ERROR',
    'GITHUB_UNKNOWN',
  ] as const,
  ASANA: [
    'ASANA_AUTH_FAILED',
    'ASANA_RATE_LIMITED',
    'ASANA_NOT_FOUND',
    'ASANA_FORBIDDEN',
    'ASANA_NETWORK_ERROR',
    'ASANA_VALIDATION_ERROR',
    'ASANA_SERVER_ERROR',
    'ASANA_UNKNOWN',
  ] as const,
  WORKTREE: [
    'WORKTREE_CREATE_FAILED',
    'WORKTREE_REMOVE_FAILED',
    'WORKTREE_NOT_FOUND',
    'WORKTREE_ALREADY_EXISTS',
    'WORKTREE_LOCKED',
    'WORKTREE_DIRTY',
    'WORKTREE_GIT_ERROR',
    'WORKTREE_PATH_INVALID',
  ] as const,
  CHECK: [
    'CHECK_TIMEOUT',
    'CHECK_FAILED',
    'CHECK_NOT_FOUND',
    'CHECK_INVALID_CONFIG',
    'CHECK_DEPENDENCY_ERROR',
    'CHECK_PERMISSION_DENIED',
    'CHECK_UNKNOWN',
  ] as const,
  PARSE: [
    'PARSE_SYNTAX_ERROR',
    'PARSE_UNEXPECTED_TOKEN',
    'PARSE_INVALID_JSON',
    'PARSE_INVALID_YAML',
    'PARSE_INVALID_FORMAT',
    'PARSE_ENCODING_ERROR',
  ] as const,
  PIPELINE: [
    'PIPELINE_INIT_FAILED',
    'PIPELINE_FAILED',
    'PIPELINE_INTERRUPTED',
    'PIPELINE_TIMEOUT',
    'AI_ANALYSIS_FAILED',
    'AI_FIX_FAILED',
    'INSTALL_DEPS_FAILED',
  ] as const,
  ISSUE: [
    'ISSUE_NOT_FOUND',
    'NO_ISSUES_FOUND',
    'ISSUE_UPDATE_FAILED',
    'PR_EXISTS',
    'PR_CREATE_FAILED',
  ] as const,
} as const;

/**
 * Type for error code categories
 */
export type ErrorCodeCategory = keyof typeof ERROR_CODE_CATEGORIES;

/**
 * Check if an error code belongs to a specific category
 */
export function isErrorCodeInCategory(
  code: ErrorCode,
  category: ErrorCodeCategory
): boolean {
  return (ERROR_CODE_CATEGORIES[category] as readonly string[]).includes(code);
}

/**
 * Get the category of an error code
 */
export function getErrorCodeCategory(code: ErrorCode): ErrorCodeCategory | undefined {
  for (const [category, codes] of Object.entries(ERROR_CODE_CATEGORIES)) {
    if ((codes as readonly string[]).includes(code)) {
      return category as ErrorCodeCategory;
    }
  }
  return undefined;
}
