/**
 * @module github/update-issue
 * @description Public API for GitHub issue update operations
 */

// Core functionality
export { updateIssue, addProgressComment } from './update-issue.js';

// Label management utilities
export { addLabels, removeLabels, syncLabels } from './labels-manager.js';

// Comment generation
export { generateProgressComment, generateNeedsInfoComment } from './comment-generator.js';
export type { NeedsInfoAnalysisResult, ConfidenceBreakdown, NeedsInfoCommentOptions } from './comment-generator.js';

// Error handling
export {
  toGitHubApiError,
  isNotFoundError,
  isAuthError,
  isValidationError,
  formatError,
} from './error-handling.js';

// MCP tool definitions and handlers
export {
  updateIssueTool,
  addProgressCommentTool,
  handleUpdateIssue,
  handleAddProgressComment,
} from './tool.js';

// Types
export type { UpdateIssueParams, GitHubApiError } from './types.js';
