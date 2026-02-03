#!/usr/bin/env node
/**
 * @module auto-fix-workflow
 * @description Main entry point for the Auto-fix Workflow MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Re-export common types for external use
export * from './common/types/index.js';

// Import init command
import { init } from './commands/init/index.js';

// Import tool definitions
import { listIssuesTool, handleListIssues } from './github/list-issues/index.js';
import { getIssueTool, handleGetIssue } from './github/get-issue/index.js';
import { createIssueTool, handleCreateIssueTool, formatToolResult as formatCreateIssueResult } from './github/create-issue/index.js';
import { updateIssueTool, addProgressCommentTool, handleUpdateIssue, handleAddProgressComment } from './github/update-issue/index.js';
import { createPRInputSchema, executeCreatePRTool } from './github/create-pr/index.js';
import { getToolDefinition as getListTasksToolDef, executeListTasks } from './asana/list-tasks/index.js';
import { getToolDefinition as getGetTaskToolDef, executeGetTask } from './asana/get-task/index.js';
import { getToolDefinition as getUpdateTaskToolDef, executeUpdateTask } from './asana/update-task/index.js';
import { getToolDefinition as getAnalyzeTaskToolDef, executeAnalyzeTask } from './asana/analyze-task/index.js';

// Import configuration loader
import { loadConfig } from './common/config-loader/index.js';
import { isSuccess, isFailure } from './common/types/index.js';
import type { AsanaConfig } from './common/types/index.js';

/**
 * Creates and configures the MCP server instance
 */
export async function createServer(): Promise<Server> {
  const server = new Server(
    {
      name: 'auto-fix-workflow',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Load configuration for Asana tools
  const configResult = await loadConfig();
  const asanaConfig: AsanaConfig | undefined = isSuccess(configResult) ? configResult.data.asana : undefined;

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // GitHub tools
      listIssuesTool,
      getIssueTool,
      createIssueTool,
      updateIssueTool,
      addProgressCommentTool,
      {
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
      },
      // Asana tools
      getListTasksToolDef(),
      getGetTaskToolDef(),
      getUpdateTaskToolDef(),
      getAnalyzeTaskToolDef(),
    ],
  }));

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // GitHub tools
        case 'list_issues': {
          const result = await handleListIssues(args as any);
          return result;
        }

        case 'get_github_issue': {
          const result = await handleGetIssue(args as any);
          return result;
        }

        case 'github_create_issue': {
          const token = process.env['GITHUB_TOKEN'];
          if (!token) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'GITHUB_TOKEN environment variable is required',
                  }),
                },
              ],
              isError: true,
            };
          }

          const asanaConfigForTool = asanaConfig;
          const result = await handleCreateIssueTool(args as any, token, asanaConfigForTool);
          return {
            content: [
              {
                type: 'text',
                text: formatCreateIssueResult(result),
              },
            ],
            isError: !result.success,
          };
        }

        case 'update_github_issue': {
          const result = await handleUpdateIssue(args as any);
          return result;
        }

        case 'add_issue_progress_comment': {
          const result = await handleAddProgressComment(args as any);
          return result;
        }

        case 'github_create_pr': {
          const result = await executeCreatePRTool(args as any);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: !result.success,
          };
        }

        // Asana tools
        case 'asana_list_tasks': {
          if (!asanaConfig) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Asana configuration not found. Please configure Asana in .auto-fix.yaml or set AUTO_FIX_CONFIG environment variable.',
                  }),
                },
              ],
              isError: true,
            };
          }

          const result = await executeListTasks(asanaConfig, args as any);
          if (isSuccess(result)) {
            return {
              content: [
                {
                  type: 'text',
                  text: result.data.content,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: result.error,
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }

        case 'asana_get_task': {
          if (!asanaConfig) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Asana configuration not found. Please configure Asana in .auto-fix.yaml or set AUTO_FIX_CONFIG environment variable.',
                  }),
                },
              ],
              isError: true,
            };
          }

          const result = await executeGetTask(asanaConfig, args as any);
          if (isSuccess(result)) {
            return {
              content: [
                {
                  type: 'text',
                  text: result.data.content,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: result.error,
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }

        case 'asana_update_task': {
          if (!asanaConfig) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Asana configuration not found. Please configure Asana in .auto-fix.yaml or set AUTO_FIX_CONFIG environment variable.',
                  }),
                },
              ],
              isError: true,
            };
          }

          const result = await executeUpdateTask(asanaConfig, args as any);
          if (isSuccess(result)) {
            return {
              content: [
                {
                  type: 'text',
                  text: result.data.content,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: result.error,
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }

        case 'asana_analyze_task': {
          if (!asanaConfig) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'Asana configuration not found. Please configure Asana in .auto-fix.yaml or set AUTO_FIX_CONFIG environment variable.',
                  }),
                },
              ],
              isError: true,
            };
          }

          const result = await executeAnalyzeTask(asanaConfig, args as any);
          if (isSuccess(result)) {
            return {
              content: [
                {
                  type: 'text',
                  text: result.data.content,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: result.error,
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main entry point - starts the MCP server
 */
async function main(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

// Check for CLI commands before starting MCP server
const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') {
  // Run init command
  init(args.slice(1)).then((result) => {
    if (!result.success) {
      // Check if it's a help request (not an error)
      if (result.error.message === 'Help requested' || result.error.message === 'Version requested') {
        process.exit(0);
      }
      console.error('Init failed:', result.error.message);
      process.exit(1);
    }
    process.exit(0);
  }).catch((error: unknown) => {
    console.error('Init failed:', error);
    process.exit(1);
  });
} else {
  // Run MCP server (default)
  main().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
