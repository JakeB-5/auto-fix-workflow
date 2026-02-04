/**
 * @module github/create-issue/tool
 * @description MCP Tool registration for GitHub issue creation
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Result } from '../../common/types/index.js';
import type { Issue } from '../../common/types/index.js';
import type { CreateIssueParams, GitHubApiError } from './types.js';
import { createIssue, type CreateIssueOptions } from './create-issue.js';
import { generateIssueBody, generateIssueTitle } from './template.js';
import { inferLabels, mergeLabels } from './labels.js';
import {
  linkToAsanaTask,
  updateAsanaTaskWithIssue,
  extractAsanaTaskId,
  isAsanaConfigured,
} from './asana-link.js';
import { isSuccess } from '../../common/types/index.js';

/**
 * Zod schema for create-issue tool input
 */
export const CreateIssueInputSchema = z.object({
  owner: z.string().describe('Repository owner (organization or user)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Issue title'),
  body: z.string().describe('Issue body content (Markdown)'),
  labels: z.array(z.string()).optional().describe('Labels to apply'),
  assignees: z.array(z.string()).optional().describe('GitHub usernames to assign'),
  milestone: z.number().optional().describe('Milestone number'),
  checkDuplicates: z.boolean().optional().default(true).describe('Check for duplicate issues'),
  autoInferLabels: z.boolean().optional().default(true).describe('Automatically infer labels'),
  source: z.enum(['asana', 'sentry', 'manual']).optional().describe('Issue source for automatic label application'),
  useAutoFixLabels: z.boolean().optional().default(true).describe('Apply auto-fix workflow labels from config'),
});

export type CreateIssueInput = z.infer<typeof CreateIssueInputSchema>;

/**
 * MCP Tool definition for creating GitHub issues
 */
export const createIssueTool: Tool = {
  name: 'github_create_issue',
  description: `Create a new GitHub issue with automatic label inference and duplicate detection.

Features:
- Automatic label generation based on issue type and priority
- Duplicate detection to prevent creating similar issues
- Support for linking to Asana tasks (if configured)
- Markdown support in issue body
- Assignee and milestone management

Example usage:
{
  "owner": "myorg",
  "repo": "myrepo",
  "title": "[BUG] API endpoint returns 500 error",
  "body": "## Description\\n\\nThe /api/users endpoint is returning 500 errors...",
  "labels": ["bug", "api"],
  "assignees": ["developer1"],
  "checkDuplicates": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner (organization or user)',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      title: {
        type: 'string',
        description: 'Issue title',
      },
      body: {
        type: 'string',
        description: 'Issue body content (Markdown)',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to apply',
      },
      assignees: {
        type: 'array',
        items: { type: 'string' },
        description: 'GitHub usernames to assign',
      },
      milestone: {
        type: 'number',
        description: 'Milestone number',
      },
      checkDuplicates: {
        type: 'boolean',
        description: 'Check for duplicate issues',
        default: true,
      },
      autoInferLabels: {
        type: 'boolean',
        description: 'Automatically infer labels',
        default: true,
      },
      source: {
        type: 'string',
        enum: ['asana', 'sentry', 'manual'],
        description: 'Issue source - automatically applies appropriate labels (e.g., "asana" adds source:asana label)',
      },
      useAutoFixLabels: {
        type: 'boolean',
        description: 'Apply auto-fix workflow labels (auto-fix, auto-fix-processing) from config',
        default: true,
      },
    },
    required: ['owner', 'repo', 'title', 'body'],
  },
};

/** Auto-fix workflow label configuration */
export interface AutoFixLabelConfig {
  readonly autoFix?: string;
  readonly skip?: string;
  readonly failed?: string;
  readonly processing?: string;
}

/**
 * Handler for the create-issue tool
 *
 * @param input - Tool input parameters
 * @param token - GitHub authentication token
 * @param asanaConfig - Optional Asana configuration for linking
 * @param labelConfig - Optional auto-fix label configuration
 * @returns Result containing the created issue or error
 */
export async function handleCreateIssueTool(
  input: CreateIssueInput,
  token: string,
  asanaConfig?: {
    readonly token: string;
    readonly workspaceGid: string;
    readonly projectGids: readonly string[];
    readonly syncedTag?: string;
  },
  labelConfig?: AutoFixLabelConfig
): Promise<Result<Issue, GitHubApiError>> {
  // Validate input
  const validationResult = CreateIssueInputSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: {
        message: `Invalid input: ${validationResult.error.message}`,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  // Build labels array with automatic additions
  let labels = [...(input.labels ?? [])];

  // Add source-based label
  if (input.source) {
    labels.push(`source:${input.source}`);
  }

  // Add auto-fix workflow labels from config
  if (input.useAutoFixLabels !== false && labelConfig) {
    if (labelConfig.autoFix) {
      labels.push(labelConfig.autoFix);
    }
    if (labelConfig.processing) {
      labels.push(labelConfig.processing);
    }
  }

  // Deduplicate labels
  labels = [...new Set(labels)];

  const params: CreateIssueParams = {
    owner: input.owner,
    repo: input.repo,
    title: input.title,
    body: input.body,
    labels,
    assignees: input.assignees,
    milestone: input.milestone,
  };

  const options: CreateIssueOptions = {
    token,
    checkDuplicates: input.checkDuplicates ?? true,
    autoInferLabels: input.autoInferLabels ?? true,
    maxRetries: 3,
  };

  // Create the issue
  const result = await createIssue(params, options);

  // If successful and Asana is configured, try to link
  if (isSuccess(result) && isAsanaConfigured(asanaConfig)) {
    // Check if this issue has an Asana context
    const asanaTaskId = extractAsanaTaskId(result.data);

    if (asanaTaskId) {
      // Link to Asana task (non-blocking)
      await linkToAsanaTask(result.data, asanaTaskId, asanaConfig).catch(err =>
        console.warn('Failed to link to Asana:', err)
      );

      // Update Asana task (non-blocking)
      await updateAsanaTaskWithIssue(result.data, asanaTaskId, asanaConfig).catch(err =>
        console.warn('Failed to update Asana task:', err)
      );
    }
  }

  return result;
}

/**
 * Format tool result for display
 */
export function formatToolResult(result: Result<Issue, GitHubApiError>): string {
  if (isSuccess(result)) {
    const issue = result.data;
    return `✅ Created issue #${issue.number}: ${issue.title}

**URL**: ${issue.url}
**State**: ${issue.state}
**Labels**: ${issue.labels.join(', ') || 'none'}
**Assignees**: ${issue.assignees.join(', ') || 'none'}
**Created**: ${issue.createdAt.toISOString()}`;
  } else {
    const error = result.error;
    return `❌ Failed to create issue: ${error.message}
${error.status ? `HTTP ${error.status}` : ''}
${error.code ? `[${error.code}]` : ''}`;
  }
}
