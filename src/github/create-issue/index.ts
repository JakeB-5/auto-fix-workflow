/**
 * @module github/create-issue
 * @description Public API for GitHub issue creation module
 */

// Core functionality
export { createIssue, createIssueFromPartial, type CreateIssueOptions } from './create-issue.js';

// Types
export type { CreateIssueParams, GitHubApiError } from './types.js';

// Template utilities
export { generateIssueBody, generateIssueTitle } from './template.js';

// Label utilities
export {
  inferLabels,
  mergeLabels,
  isValidLabel,
  filterValidLabels,
} from './labels.js';

// Duplicate detection
export {
  findDuplicates,
  calculateSimilarity,
  containsStackTrace,
  type DuplicateCheckOptions,
} from './duplicate-check.js';

// Asana integration
export {
  linkToAsanaTask,
  updateAsanaTaskWithIssue,
  extractAsanaTaskId,
  isAsanaConfigured,
} from './asana-link.js';

// Error handling
export {
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
} from './error-handling.js';

// MCP Tool
export {
  createIssueTool,
  handleCreateIssueTool,
  formatToolResult,
  CreateIssueInputSchema,
  type CreateIssueInput,
} from './tool.js';
