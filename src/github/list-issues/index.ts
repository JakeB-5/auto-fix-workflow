/**
 * @module github/list-issues
 * @description Public API for listing GitHub issues
 */

// Types
export type {
  ListIssuesParams,
  ListIssuesResult,
  GitHubApiError,
} from './types.js';

// Core functionality
export { listIssues, listAllIssues } from './list-issues.js';

// Client utilities
export { createGitHubClient, isRateLimitError, getRateLimit } from './client.js';

// Parsing utilities
export { parseIssueBody, mapIssueState } from './body-parser.js';

// Error handling
export {
  toGitHubApiError,
  handleGitHubError,
  isNotFoundError,
  isUnauthorizedError,
  isForbiddenError,
  isValidationError,
  getUserFriendlyErrorMessage,
  validateListIssuesParams,
} from './error-handling.js';

// MCP Tool
export { listIssuesTool, handleListIssues } from './tool.js';
