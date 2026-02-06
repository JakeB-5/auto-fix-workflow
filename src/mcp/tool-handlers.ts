/**
 * @module mcp/tool-handlers
 * @description Tool execution handlers for MCP server
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Import tool handlers
import { handleListIssues } from '../github/list-issues/index.js';
import { handleGetIssue } from '../github/get-issue/index.js';
import { handleCreateIssueTool, formatToolResult as formatCreateIssueResult } from '../github/create-issue/index.js';
import { handleUpdateIssue, handleAddProgressComment } from '../github/update-issue/index.js';
import { executeCreatePRTool } from '../github/create-pr/index.js';
import { executeListTasks } from '../asana/list-tasks/index.js';
import { executeGetTask } from '../asana/get-task/index.js';
import { executeUpdateTask } from '../asana/update-task/index.js';
import { executeAnalyzeTask } from '../asana/analyze-task/index.js';

import { isSuccess } from '../common/types/index.js';
import type { AsanaConfig } from '../common/types/index.js';

/**
 * Tool handler context containing configuration
 */
export interface ToolHandlerContext {
  asanaConfig: AsanaConfig | undefined;
  githubToken: string | undefined;
  githubLabelConfig: {
    autoFix?: string;
    skip?: string;
    failed?: string;
    processing?: string;
  } | undefined;
  configError: string | undefined;
}

/**
 * MCP tool response type - re-export for convenience
 */
export type ToolResponse = CallToolResult;

/**
 * Create Asana configuration error response
 */
function createAsanaConfigErrorResponse(configError?: string): CallToolResult {
  return {
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
  };
}

/**
 * Create error response
 */
function createErrorResponse(error: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Handle tool execution request
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolHandlerContext
): Promise<CallToolResult> {
  try {
    switch (name) {
      // GitHub tools
      case 'list_issues': {
        const result = await handleListIssues(args as any);
        return result as CallToolResult;
      }

      case 'get_github_issue': {
        const result = await handleGetIssue(args as any);
        return result as CallToolResult;
      }

      case 'github_create_issue': {
        const token = context.githubToken || process.env['GITHUB_TOKEN'];
        if (!token) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: 'GitHub token is required. Set tokens.github in .auto-fix.yaml or GITHUB_TOKEN environment variable.',
                }),
              },
            ],
            isError: true,
          };
        }

        const result = await handleCreateIssueTool(
          args as any,
          token,
          context.asanaConfig,
          context.githubLabelConfig
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: formatCreateIssueResult(result),
            },
          ],
          isError: !result.success,
        };
      }

      case 'update_github_issue': {
        const result = await handleUpdateIssue(args as any);
        return result as CallToolResult;
      }

      case 'add_issue_progress_comment': {
        const result = await handleAddProgressComment(args as any);
        return result as CallToolResult;
      }

      case 'github_create_pr': {
        const result = await executeCreatePRTool(args as any);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !result.success,
        };
      }

      // Asana tools
      case 'asana_list_tasks': {
        if (!context.asanaConfig) {
          return createAsanaConfigErrorResponse(context.configError);
        }

        const result = await executeListTasks(context.asanaConfig, args as any);
        if (isSuccess(result)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: result.data.content,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
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
        if (!context.asanaConfig) {
          return createAsanaConfigErrorResponse(context.configError);
        }

        const result = await executeGetTask(context.asanaConfig, args as any);
        if (isSuccess(result)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: result.data.content,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
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
        if (!context.asanaConfig) {
          return createAsanaConfigErrorResponse(context.configError);
        }

        const result = await executeUpdateTask(context.asanaConfig, args as any);
        if (isSuccess(result)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: result.data.content,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
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
        if (!context.asanaConfig) {
          return createAsanaConfigErrorResponse(context.configError);
        }

        const result = await executeAnalyzeTask(context.asanaConfig, args as any);
        if (isSuccess(result)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: result.data.content,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
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
    return createErrorResponse(error);
  }
}
