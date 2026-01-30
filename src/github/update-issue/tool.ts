/**
 * @module github/update-issue/tool
 * @description MCP Tool registration for GitHub issue updates
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { UpdateIssueParams } from './types.js';
import { updateIssue, addProgressComment } from './update-issue.js';
import { isSuccess } from '../../common/types/index.js';
import { formatError } from './error-handling.js';

/**
 * MCP Tool definition for updating GitHub issues
 */
export const updateIssueTool: Tool = {
  name: 'update_github_issue',
  description: `Update a GitHub issue with new title, body, state, labels, assignees, or add a comment.

Features:
- Update issue title and body
- Change issue state (open/closed)
- Update labels (replaces all labels)
- Update assignees
- Add a comment to the issue
- All fields are optional except owner, repo, and issueNumber`,
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
      issueNumber: {
        type: 'number',
        description: 'Issue number to update',
      },
      title: {
        type: 'string',
        description: 'New title for the issue',
      },
      body: {
        type: 'string',
        description: 'New body content for the issue',
      },
      state: {
        type: 'string',
        enum: ['open', 'closed'],
        description: 'New state for the issue',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels to set on the issue (replaces all existing labels)',
      },
      assignees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assignees to set on the issue',
      },
      addComment: {
        type: 'string',
        description: 'Comment to add to the issue',
      },
    },
    required: ['owner', 'repo', 'issueNumber'],
  },
};

/**
 * MCP Tool definition for adding progress comments
 */
export const addProgressCommentTool: Tool = {
  name: 'add_issue_progress_comment',
  description: `Add a formatted progress comment to a GitHub issue.

The comment will be automatically formatted with a timestamp and optional details in a structured markdown format.`,
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
      issueNumber: {
        type: 'number',
        description: 'Issue number',
      },
      status: {
        type: 'string',
        description: 'Progress status message',
      },
      details: {
        type: 'object',
        description: 'Optional details object to include in the comment',
      },
    },
    required: ['owner', 'repo', 'issueNumber', 'status'],
  },
};

/**
 * Handler function for the update_github_issue tool
 *
 * @param params - Tool parameters
 * @returns Tool execution result
 */
export async function handleUpdateIssue(params: UpdateIssueParams): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const result = await updateIssue(params);

  if (isSuccess(result)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              issue: {
                number: result.data.number,
                title: result.data.title,
                state: result.data.state,
                labels: result.data.labels,
                assignees: result.data.assignees,
                url: result.data.url,
                updatedAt: result.data.updatedAt.toISOString(),
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: formatError(result.error),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler function for the add_issue_progress_comment tool
 *
 * @param params - Tool parameters
 * @returns Tool execution result
 */
export async function handleAddProgressComment(params: {
  owner: string;
  repo: string;
  issueNumber: number;
  status: string;
  details?: Record<string, unknown>;
}): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  const result = await addProgressComment(
    params.owner,
    params.repo,
    params.issueNumber,
    params.status,
    params.details
  );

  if (isSuccess(result)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Progress comment added successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: formatError(result.error),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
