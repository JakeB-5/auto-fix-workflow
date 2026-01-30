/**
 * @module github/list-issues/tool
 * @description MCP Tool registration for list_issues
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ListIssuesParams } from './types.js';
import { listIssues } from './list-issues.js';
import { getUserFriendlyErrorMessage } from './error-handling.js';
import { isFailure } from '../../common/types/index.js';

/**
 * MCP Tool definition for listing GitHub issues
 */
export const listIssuesTool: Tool = {
  name: 'list_issues',
  description: `List GitHub issues with filtering and pagination.

Returns a list of issues from a GitHub repository with optional filters for state, labels, assignees, and date ranges.

Features:
- Filter by state (open/closed/all)
- Filter by labels (multiple)
- Filter by assignee
- Filter by update date
- Pagination support
- Automatic parsing of issue metadata`,
  inputSchema: {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner (username or organization)',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      state: {
        type: 'string',
        enum: ['open', 'closed', 'all'],
        description: 'Filter by issue state (default: open)',
        default: 'open',
      },
      labels: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Filter by labels (AND logic - issue must have all labels)',
      },
      exclude_labels: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Exclude issues with any of these labels (default: ["auto-fix-skip"])',
        default: ['auto-fix-skip'],
      },
      assignee: {
        type: 'string',
        description: 'Filter by assignee username (use "none" for unassigned, "*" for any assignee)',
      },
      since: {
        type: 'string',
        description: 'Filter issues updated after this ISO 8601 timestamp (e.g., 2024-01-01T00:00:00Z)',
      },
      perPage: {
        type: 'number',
        description: 'Results per page (1-100, default: 50)',
        minimum: 1,
        maximum: 100,
        default: 50,
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (default: 1)',
        minimum: 1,
        default: 1,
      },
      token: {
        type: 'string',
        description: 'GitHub personal access token for authentication',
      },
    },
    required: ['owner', 'repo', 'token'],
  },
};

/**
 * Handler function for the list_issues tool
 *
 * @param params - Tool parameters
 * @returns Tool execution result
 */
export async function handleListIssues(params: ListIssuesParams & { token: string }): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const { token, ...listParams } = params;

  const result = await listIssues(listParams, token);

  if (isFailure(result)) {
    const errorMessage = getUserFriendlyErrorMessage(result.error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: errorMessage,
              details: result.error,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  // Format the response
  const response = {
    success: true,
    data: {
      issues: result.data.issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        type: issue.type,
        labels: issue.labels,
        assignees: issue.assignees,
        priority: issue.context.priority,
        component: issue.context.component,
        url: issue.url,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        relatedFiles: issue.context.relatedFiles,
        acceptanceCriteria: issue.acceptanceCriteria,
      })),
      totalCount: result.data.totalCount,
      hasMore: result.data.hasMore,
      page: listParams.page ?? 1,
      perPage: listParams.perPage ?? 50,
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}
