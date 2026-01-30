/**
 * @module github/get-issue/tool
 * @description MCP Tool registration for GitHub issue retrieval
 */

import { Octokit } from '@octokit/rest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { GetIssueParams } from './types.js';
import { getIssue } from './get-issue.js';
import { isSuccess } from '../../common/types/index.js';
import { createGitHubError } from './error-handling.js';

/**
 * MCP Tool definition for getting GitHub issues
 */
export const getIssueTool: Tool = {
  name: 'get_github_issue',
  description: `Retrieve a GitHub issue with all related information.

Returns:
- Complete issue details (title, body, state, labels, assignees, etc.)
- All comments on the issue with author and timestamp
- Related issues extracted from issue body and comments (#123 references, "fixes #456", etc.)
- Acceptance criteria extracted from task lists
- Issue metadata (created/updated timestamps, URL, etc.)

Use this tool to:
- Get detailed information about a specific issue
- Find related issues mentioned in discussions
- Review issue history through comments
- Check acceptance criteria and completion status`,
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
        description: 'Issue number to retrieve',
      },
    },
    required: ['owner', 'repo', 'issueNumber'],
  },
};

/**
 * Handler function for the get_github_issue tool
 *
 * @param params - Tool parameters
 * @returns Tool execution result
 */
export async function handleGetIssue(params: GetIssueParams): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    const octokit = new Octokit({
      auth: process.env['GITHUB_TOKEN'],
    });

    const result = await getIssue(octokit, params);

    if (isSuccess(result)) {
      const { issue, relatedIssues, comments } = result.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                issue: {
                  number: issue.number,
                  title: issue.title,
                  body: issue.body,
                  state: issue.state,
                  type: issue.type,
                  labels: issue.labels,
                  assignees: issue.assignees,
                  context: issue.context,
                  acceptanceCriteria: issue.acceptanceCriteria,
                  relatedIssues: issue.relatedIssues,
                  createdAt: issue.createdAt.toISOString(),
                  updatedAt: issue.updatedAt.toISOString(),
                  url: issue.url,
                },
                relatedIssues,
                comments: comments.map((comment) => ({
                  id: comment.id,
                  author: comment.author,
                  body: comment.body,
                  createdAt: comment.createdAt.toISOString(),
                  updatedAt: comment.updatedAt.toISOString(),
                  url: comment.url,
                })),
                summary: {
                  totalComments: comments.length,
                  totalRelatedIssues: relatedIssues.length,
                  completedCriteria: issue.acceptanceCriteria.filter(
                    (c) => c.completed
                  ).length,
                  totalCriteria: issue.acceptanceCriteria.length,
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
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: formatError(
                createGitHubError(
                  error,
                  `Failed to get issue #${params.issueNumber}`
                )
              ),
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
 * Format a GitHubApiError for user-friendly display
 */
function formatError(error: {
  message: string;
  status?: number;
  code?: string;
}): string {
  const parts: string[] = [error.message];

  if (error.status) {
    parts.push(`(HTTP ${error.status})`);
  }

  if (error.code) {
    parts.push(`[${error.code}]`);
  }

  return parts.join(' ');
}
