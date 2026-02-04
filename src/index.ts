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

  // Load configuration for Asana and GitHub tools
  const configResult = await loadConfig();
  let asanaConfig: AsanaConfig | undefined;
  let githubToken: string | undefined;
  let githubLabelConfig: { autoFix?: string; skip?: string; failed?: string; processing?: string } | undefined;
  let configError: string | undefined;

  if (isSuccess(configResult)) {
    asanaConfig = configResult.data.asana;
    // Extract GitHub config if available
    const githubConfig = configResult.data.github;
    githubToken = githubConfig?.token || process.env['GITHUB_TOKEN'];
    if (githubConfig?.labels) {
      githubLabelConfig = githubConfig.labels;
    }
  } else {
    // Store error for tool responses and log for debugging
    configError = configResult.error.message;
    console.error('[auto-fix-workflow] Config loading failed:', configError);
    if (configResult.error.details) {
      console.error('[auto-fix-workflow] Details:', JSON.stringify(configResult.error.details, null, 2));
    }
  }

  // Helper function for Asana config error response
  const asanaConfigErrorResponse = () => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: false,
          error: configError
            ? `Config loading failed: ${configError}`
            : 'Asana configuration not found. Please configure Asana in .auto-fix.yaml or set AUTO_FIX_CONFIG environment variable.',
          cwd: process.cwd(),
          envVar: process.env['AUTO_FIX_CONFIG'] || '(not set)',
        }, null, 2),
      },
    ],
    isError: true,
  });

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
          const token = githubToken || process.env['GITHUB_TOKEN'];
          if (!token) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'GitHub token is required. Set tokens.github in .auto-fix.yaml or GITHUB_TOKEN environment variable.',
                  }),
                },
              ],
              isError: true,
            };
          }

          const asanaConfigForTool = asanaConfig;
          const result = await handleCreateIssueTool(args as any, token, asanaConfigForTool, githubLabelConfig);
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
            return asanaConfigErrorResponse();
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
            return asanaConfigErrorResponse();
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
            return asanaConfigErrorResponse();
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
            return asanaConfigErrorResponse();
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

/**
 * Show CLI help message
 */
function showHelp(): void {
  console.log(`
auto-fix-workflow - Automated GitHub Issue Fix Workflow

USAGE:
  npx auto-fix-workflow <command> [options]

COMMANDS:
  init              Initialize configuration files
  autofix           Run autofix workflow on GitHub issues
  triage            Triage Asana tasks and create GitHub issues
  help              Show this help message

MCP SERVER MODE:
  When run without a command (or via MCP client), starts as an MCP server
  providing tools for GitHub and Asana integration.

AVAILABLE MCP TOOLS:
  GitHub:
    - list_issues           List GitHub issues
    - get_github_issue      Get issue details
    - github_create_issue   Create a new issue
    - update_github_issue   Update an issue
    - github_create_pr      Create a pull request

  Asana:
    - asana_list_tasks      List Asana tasks
    - asana_get_task        Get task details
    - asana_update_task     Update a task
    - asana_analyze_task    Analyze task for triage

EXAMPLES:
  npx auto-fix-workflow init              # Initialize config
  npx auto-fix-workflow autofix           # Run autofix workflow
  npx auto-fix-workflow help              # Show this help

CONFIGURATION:
  Create .auto-fix.yaml in your project root with GitHub and Asana settings.
  Run 'npx auto-fix-workflow init' to create a template.

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN       GitHub personal access token
  ASANA_TOKEN        Asana personal access token
  AUTO_FIX_CONFIG    Path to config file (optional)

For more information, visit: https://github.com/your-org/auto-fix-workflow
`);
}

/**
 * Check if running in interactive TTY mode (not as MCP server)
 */
function isInteractiveCLI(): boolean {
  // Check if stdin is a TTY (terminal) - if true, user is running directly
  // MCP clients pipe JSON-RPC through stdin, so isTTY will be false
  return process.stdin.isTTY === true;
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
} else if (command === 'help' || command === '--help' || command === '-h') {
  // Show help
  showHelp();
  process.exit(0);
} else if (command === '--version' || command === '-v') {
  // Show version
  console.log('auto-fix-workflow v0.4.7');
  process.exit(0);
} else if (command === 'autofix') {
  // Run autofix command
  import('./commands/autofix/index.js').then(({ main }) => {
    main(args.slice(1)).catch((error: unknown) => {
      console.error('Autofix failed:', error);
      process.exit(1);
    });
  });
} else if (command === 'triage') {
  // Run triage command in standalone mode
  import('./commands/triage/cli-entry.js').then(({ main }) => {
    main(args.slice(1)).catch((error: unknown) => {
      console.error('Triage failed:', error);
      process.exit(1);
    });
  });
} else if (isInteractiveCLI() && !command) {
  // Running in terminal without command - show help instead of hanging
  console.log('auto-fix-workflow: Running in interactive mode without MCP client.\n');
  showHelp();
  console.log('\nTo start as MCP server, run via an MCP client (e.g., Claude Code).');
  process.exit(0);
} else {
  // Run MCP server (default for non-TTY or unknown commands)
  main().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
