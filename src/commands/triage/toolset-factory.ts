/**
 * @module commands/triage/toolset-factory
 * @description Factory for creating TriageToolset instances
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TriageToolset, ToolsetMode } from './toolset.types.js';
import type { Config } from '../../common/types/index.js';
import { ok } from '../../common/types/index.js';

/**
 * MCP context for MCP toolset
 */
export interface MCPContext {
  readonly client: Client;
  readonly owner: string;
  readonly repo: string;
}

/**
 * Direct context for standalone toolset
 */
export interface DirectContext {
  readonly config: Config;
}

/**
 * Create toolset for triage command
 *
 * @param mode - Execution mode ('mcp' or 'direct')
 * @param context - Context object (MCPContext for mcp, DirectContext for direct)
 * @returns TriageToolset instance
 */
export async function createToolset(
  mode: 'mcp',
  context: MCPContext
): Promise<TriageToolset>;
export async function createToolset(
  mode: 'direct',
  context: DirectContext
): Promise<TriageToolset>;
export async function createToolset(
  mode: ToolsetMode,
  context: MCPContext | DirectContext
): Promise<TriageToolset> {
  if (mode === 'mcp') {
    // Import and create MCP toolset
    // This uses existing mcp-tools implementations
    const mcpContext = context as MCPContext;
    return createMCPToolset(mcpContext.client, mcpContext.owner, mcpContext.repo);
  }

  // Create direct API toolset
  return createDirectToolset((context as DirectContext).config);
}

/**
 * Create MCP-based toolset (lazy implementation - wraps existing mcp-tools)
 */
async function createMCPToolset(client: Client, owner: string, repo: string): Promise<TriageToolset> {
  // Import existing MCP tools using dynamic import
  const { createAsanaListTool } = await import('./mcp-tools/asana-list.js');
  const { createAsanaUpdateTool } = await import('./mcp-tools/asana-update.js');
  const { createGitHubCreateTool } = await import('./mcp-tools/github-create.js');
  const { createAIAnalyzeTool } = await import('./mcp-tools/ai-analyze.js');

  const asanaList = createAsanaListTool(client);
  const asanaUpdate = createAsanaUpdateTool(client);
  const githubCreate = createGitHubCreateTool(client, owner, repo);
  const aiAnalyze = createAIAnalyzeTool(client);

  return {
    mode: 'mcp',
    asana: {
      listTasks: asanaList.listTasks.bind(asanaList),
      getTask: asanaList.getTask.bind(asanaList),
      // Wrap updateTask to return void instead of AsanaUpdateResult
      updateTask: async (params) => {
        const result = await asanaUpdate.updateTask(params);
        if (result.success) {
          return ok(undefined);
        }
        return result;
      },
      findSectionByName: asanaList.findSectionByName.bind(asanaList),
      // MCP mode doesn't have tag lookup - return null
      findTagByName: async () => ok(null),
    },
    github: {
      // Wrap createIssue to use the owner/repo from context (params are ignored)
      createIssue: async (params) => {
        return githubCreate.createIssue({
          title: params.title,
          body: params.body,
          labels: params.labels,
          assignees: params.assignees,
          milestone: params.milestone,
        });
      },
    },
    analyzer: {
      analyzeTask: aiAnalyze.analyzeTask.bind(aiAnalyze),
    },
  };
}

/**
 * Create direct API toolset
 */
async function createDirectToolset(config: Config): Promise<TriageToolset> {
  // Import direct tools using dynamic import
  const { createDirectAPIToolset, canCreateDirectToolset } = await import('./direct-tools/index.js');

  if (!canCreateDirectToolset(config)) {
    throw new Error('Cannot create direct toolset: missing required config (asana, github)');
  }

  return createDirectAPIToolset(config);
}

/**
 * Check if direct mode is available
 */
export function isDirectModeAvailable(): boolean {
  return true;
}
