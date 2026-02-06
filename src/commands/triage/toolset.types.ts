/**
 * @module commands/triage/toolset.types
 * @description Triage toolset interface for MCP/Direct abstraction
 */

import type { Result } from '../../common/types/result.js';
import type {
  AsanaTask,
  TaskAnalysis,
  GitHubIssueParams,
  GitHubIssueResult,
  AsanaTaskUpdateParams,
} from './types.js';

/**
 * Toolset execution mode
 */
export type ToolsetMode = 'mcp' | 'direct';

/**
 * List tasks parameters
 */
export interface ListTasksParams {
  readonly projectGid: string;
  readonly sectionGid?: string | undefined;
  readonly limit?: number | undefined;
}

/**
 * Asana toolset interface
 */
export interface AsanaToolset {
  listTasks(params: ListTasksParams): Promise<Result<AsanaTask[], Error>>;
  getTask(taskGid: string): Promise<Result<AsanaTask, Error>>;
  updateTask(params: AsanaTaskUpdateParams): Promise<Result<void, Error>>;
  findSectionByName(projectGid: string, sectionName: string): Promise<Result<string | null, Error>>;
  findTagByName(tagName: string): Promise<Result<string | null, Error>>;
}

/**
 * GitHub toolset interface
 */
export interface GitHubToolset {
  createIssue(params: GitHubIssueParams & { owner: string; repo: string }): Promise<Result<GitHubIssueResult, Error>>;
}

/**
 * Analyzer toolset interface
 */
export interface AnalyzerToolset {
  analyzeTask(task: AsanaTask): Promise<Result<TaskAnalysis, Error>>;
}

/**
 * Combined triage toolset interface
 */
export interface TriageToolset {
  readonly mode: ToolsetMode;
  readonly asana: AsanaToolset;
  readonly github: GitHubToolset;
  readonly analyzer: AnalyzerToolset;
}
