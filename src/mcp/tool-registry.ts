/**
 * @module mcp/tool-registry
 * @description Tool definitions and registration for MCP server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Import tool definitions
import { listIssuesTool } from '../github/list-issues/index.js';
import { getIssueTool } from '../github/get-issue/index.js';
import { createIssueTool } from '../github/create-issue/index.js';
import { updateIssueTool, addProgressCommentTool } from '../github/update-issue/index.js';
import { getToolDefinition as getListTasksToolDef } from '../asana/list-tasks/index.js';
import { getToolDefinition as getGetTaskToolDef } from '../asana/get-task/index.js';
import { getToolDefinition as getUpdateTaskToolDef } from '../asana/update-task/index.js';
import { getToolDefinition as getAnalyzeTaskToolDef } from '../asana/analyze-task/index.js';

/**
 * GitHub Create PR tool definition
 */
export const createPRTool: Tool = {
  name: 'github_create_pr',
  description: `Create a GitHub Pull Request with automatic title and body generation.

Features:
- Auto-generate PR title from linked issues
- Auto-generate PR body with changes summary
- Link to GitHub issues
- Add labels and reviewers
- Support for draft PRs
- Detect existing PRs to prevent duplicates

Example usage:
{
  "owner": "myorg",
  "repo": "myrepo",
  "head": "feature-branch",
  "base": "main",
  "issueNumbers": [123, 456],
  "draft": false,
  "token": "ghp_..."
}`,
  inputSchema: {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'GitHub repository owner',
      },
      repo: {
        type: 'string',
        description: 'GitHub repository name',
      },
      title: {
        type: 'string',
        description: 'PR title (auto-generated if not provided)',
      },
      body: {
        type: 'string',
        description: 'PR body (auto-generated if not provided)',
      },
      head: {
        type: 'string',
        description: 'Source branch (current branch if not provided)',
      },
      base: {
        type: 'string',
        description: 'Target branch (default: main)',
        default: 'main',
      },
      draft: {
        type: 'boolean',
        description: 'Create as draft PR',
        default: false,
      },
      issueNumbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Issue numbers to link',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to add (auto-generated if not provided)',
      },
      reviewers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reviewers to request',
      },
      token: {
        type: 'string',
        description: 'GitHub personal access token',
      },
      workingDir: {
        type: 'string',
        description: 'Git working directory (default: current directory)',
      },
    },
    required: ['owner', 'repo', 'token'],
  },
};

/**
 * Get all tool definitions for MCP server
 */
export function getAllTools(): Tool[] {
  return [
    // GitHub tools
    listIssuesTool,
    getIssueTool,
    createIssueTool,
    updateIssueTool,
    addProgressCommentTool,
    createPRTool,
    // Asana tools
    getListTasksToolDef(),
    getGetTaskToolDef(),
    getUpdateTaskToolDef(),
    getAnalyzeTaskToolDef(),
  ];
}
