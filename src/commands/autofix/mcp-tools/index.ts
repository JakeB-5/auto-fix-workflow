/**
 * @module commands/autofix/mcp-tools
 * @description MCP tools barrel export
 */

// GitHub Issues Tool
export {
  GitHubIssuesTool,
  createGitHubIssuesTool,
  FetchIssuesParamsSchema,
  type FetchIssuesParams,
  type FetchIssuesResult,
  type GitHubIssuesError,
  type GitHubIssuesErrorCode,
  type GitHubIssuesConfig,
} from './github-issues.js';

// Group Issues Tool
export {
  GroupIssuesTool,
  createGroupIssuesTool,
  GroupIssuesInputSchema,
  type GroupIssuesInput,
  type GroupIssuesError,
  type GroupIssuesErrorCode,
} from './group-issues.js';

// Worktree Tool
export {
  WorktreeTool,
  createWorktreeTool,
  WorktreeOperationSchema,
  type WorktreeOperation,
  type WorktreeError,
  type WorktreeErrorCode,
  type WorktreeConfig,
} from './worktree.js';

// Run Checks Tool
export {
  RunChecksTool,
  createRunChecksTool,
  RunChecksInputSchema,
  type RunChecksInput,
  type RunChecksError,
  type RunChecksErrorCode,
  type ChecksToolConfig,
} from './run-checks.js';

// Create PR Tool
export {
  CreatePRTool,
  createCreatePRTool,
  CreatePRInputSchema,
  type CreatePRInput,
  type CreatePRError,
  type CreatePRErrorCode,
  type CreatePRConfig,
} from './create-pr.js';

// Update Issue Tool
export {
  UpdateIssueTool,
  createUpdateIssueTool,
  UpdateIssueInputSchema,
  type UpdateIssueInput,
  type UpdateIssueResult,
  type UpdateIssueError,
  type UpdateIssueErrorCode,
  type UpdateIssueConfig,
} from './update-issue.js';
