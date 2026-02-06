/**
 * @module mcp/server
 * @description MCP server creation and configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from '../common/config-loader/index.js';
import { isSuccess } from '../common/types/index.js';
import type { AsanaConfig } from '../common/types/index.js';

import { getAllTools } from './tool-registry.js';
import { handleToolCall, type ToolHandlerContext } from './tool-handlers.js';

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

  // Create handler context
  const handlerContext: ToolHandlerContext = {
    asanaConfig,
    githubToken,
    githubLabelConfig,
    configError,
  };

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getAllTools(),
  }));

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args as Record<string, unknown>, handlerContext);
  });

  return server;
}

/**
 * Starts the MCP server with stdio transport
 */
export async function startServer(): Promise<void> {
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
