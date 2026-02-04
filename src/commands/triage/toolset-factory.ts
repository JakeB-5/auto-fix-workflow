/**
 * @module commands/triage/toolset-factory
 * @description Factory for creating TriageToolset instances
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TriageToolset, ToolsetMode } from './toolset.types.js';
import type { Config } from '../../common/types/index.js';

/**
 * MCP context for MCP toolset
 */
export interface MCPContext {
  readonly client: Client;
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
export function createToolset(
  mode: 'mcp',
  context: MCPContext
): TriageToolset;
export function createToolset(
  mode: 'direct',
  context: DirectContext
): TriageToolset;
export function createToolset(
  mode: ToolsetMode,
  context: MCPContext | DirectContext
): TriageToolset {
  if (mode === 'mcp') {
    // Import and create MCP toolset
    // This uses existing mcp-tools implementations
    return createMCPToolset((context as MCPContext).client);
  }

  // Create direct API toolset
  return createDirectToolset((context as DirectContext).config);
}

/**
 * Create MCP-based toolset (lazy implementation - wraps existing mcp-tools)
 */
function createMCPToolset(client: Client): TriageToolset {
  // Import existing MCP tools
  const { createAsanaListTool } = require('./mcp-tools/asana-list.js');
  const { createAsanaUpdateTool } = require('./mcp-tools/asana-update.js');
  const { createGitHubCreateTool } = require('./mcp-tools/github-create.js');
  const { createAIAnalyzeTool } = require('./mcp-tools/ai-analyze.js');

  const asanaList = createAsanaListTool(client);
  const asanaUpdate = createAsanaUpdateTool(client);
  const githubCreate = createGitHubCreateTool(client);
  const aiAnalyze = createAIAnalyzeTool(client);

  return {
    mode: 'mcp',
    asana: {
      listTasks: asanaList.listTasks.bind(asanaList),
      getTask: asanaList.getTask.bind(asanaList),
      updateTask: asanaUpdate.updateTask.bind(asanaUpdate),
      findSectionByName: asanaList.findSectionByName.bind(asanaList),
    },
    github: {
      createIssue: githubCreate.createIssue.bind(githubCreate),
    },
    analyzer: {
      analyzeTask: aiAnalyze.analyzeTask.bind(aiAnalyze),
    },
  };
}

/**
 * Create direct API toolset
 */
function createDirectToolset(config: Config): TriageToolset {
  // Import direct tools (lazy to avoid circular deps)
  const { createDirectAPIToolset, canCreateDirectToolset } = require('./direct-tools/index.js');

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
