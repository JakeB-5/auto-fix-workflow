/**
 * @module github/get-issue
 * @description Public API for GitHub issue retrieval operations
 */

// Core functionality
export { getIssue } from './get-issue.js';

// Markdown parsing utilities
export {
  extractCodeBlocks,
  extractLinks,
  extractIssueReferences,
  extractTaskList,
  extractHeaders,
} from './markdown-parser.js';

// Related issue extraction
export {
  extractRelatedIssues,
  extractClosingReferences,
  hasClosingKeyword,
} from './related-issues.js';

// Error handling
export {
  createGitHubError,
  isNotFoundError,
  isRateLimitError,
} from './error-handling.js';

// MCP tool definitions and handlers
export { getIssueTool, handleGetIssue } from './tool.js';

// Types
export type {
  GetIssueParams,
  GetIssueResult,
  IssueComment,
} from './types.js';

export type { CodeBlock, Link } from './markdown-parser.js';
