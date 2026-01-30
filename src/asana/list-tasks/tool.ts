/**
 * @module asana/list-tasks/tool
 * @description MCP Tool registration for list-tasks
 */

import { z } from 'zod';
import type { AsanaConfig } from '../../common/types/index.js';
import { ok, err, type Result } from '../../common/types/index.js';
import { listTasks, listAllTasks } from './list.js';
import { filterTasks, sortTasks, type TaskFilterCriteria } from './filter.js';
import {
  formatTaskList,
  formatAsMarkdownTable,
  formatAsPlainText,
  formatAsJson,
  generateSummary,
} from './format.js';

/** Tool input schema */
export const ListTasksInputSchema = z.object({
  projectGid: z.string().describe('Asana project GID'),
  sectionName: z.string().optional().describe('Filter by section name'),
  includeCompleted: z.boolean().optional().default(false).describe('Include completed tasks'),
  limit: z.number().optional().describe('Maximum tasks to return'),
  offset: z.string().optional().describe('Pagination offset'),
  tags: z.array(z.string()).optional().describe('Filter by tag names (any match)'),
  excludeTags: z.array(z.string()).optional().describe('Exclude tasks with these tags'),
  assigneeGid: z.string().optional().describe('Filter by assignee GID'),
  unassignedOnly: z.boolean().optional().describe('Only unassigned tasks'),
  overdueOnly: z.boolean().optional().describe('Only overdue tasks'),
  nameContains: z.string().optional().describe('Search in task name'),
  sortBy: z.enum(['name', 'createdAt', 'modifiedAt', 'dueOn']).optional().describe('Sort field'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc').describe('Sort order'),
  format: z.enum(['json', 'markdown', 'text']).optional().default('json').describe('Output format'),
  includeSummary: z.boolean().optional().default(false).describe('Include summary statistics'),
  fetchAll: z.boolean().optional().default(false).describe('Fetch all pages'),
});

export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

/** Tool output type */
export interface ListTasksOutput {
  readonly content: string;
  readonly format: 'json' | 'markdown' | 'text';
}

/** Tool error type */
export interface ListTasksError {
  readonly code: string;
  readonly message: string;
}

/**
 * Execute list-tasks tool
 *
 * @param config - Asana configuration
 * @param input - Tool input
 * @returns Tool output or error
 */
export async function executeListTasks(
  config: AsanaConfig,
  input: ListTasksInput
): Promise<Result<ListTasksOutput, ListTasksError>> {
  try {
    // Validate project GID is in config
    if (!config.projectGids.includes(input.projectGid)) {
      return err({
        code: 'INVALID_PROJECT',
        message: `Project ${input.projectGid} not in configured projects`,
      });
    }

    // Fetch tasks
    let tasks;
    let hasMore = false;
    let nextOffset: string | null = null;

    if (input.fetchAll) {
      tasks = await listAllTasks(config, {
        projectGid: input.projectGid,
        sectionName: input.sectionName,
        includeCompleted: input.includeCompleted,
      });
    } else {
      const result = await listTasks(config, {
        projectGid: input.projectGid,
        sectionName: input.sectionName,
        includeCompleted: input.includeCompleted,
        limit: input.limit,
        offset: input.offset,
      });
      tasks = result.tasks;
      hasMore = result.hasMore;
      nextOffset = result.nextOffset;
    }

    // Apply client-side filters
    const filterCriteria: TaskFilterCriteria = {
      tags: input.tags,
      excludeTags: input.excludeTags,
      assigneeGid: input.assigneeGid,
      unassignedOnly: input.unassignedOnly,
      overdueOnly: input.overdueOnly,
      nameContains: input.nameContains,
    };

    const hasFilters = Object.values(filterCriteria).some(
      (v) => v !== undefined
    );
    if (hasFilters) {
      tasks = filterTasks(tasks, filterCriteria);
    }

    // Apply sorting
    if (input.sortBy) {
      tasks = sortTasks(tasks, input.sortBy, input.sortOrder);
    }

    // Format output
    let content: string;
    switch (input.format) {
      case 'markdown':
        content = formatAsMarkdownTable(tasks);
        if (input.includeSummary) {
          const summary = generateSummary(tasks);
          content = `## Summary\n- Total: ${summary.total}\n- Incomplete: ${summary.incomplete}\n- Overdue: ${summary.overdue}\n\n${content}`;
        }
        break;
      case 'text':
        content = formatAsPlainText(tasks);
        break;
      case 'json':
      default:
        const result = { tasks, hasMore, nextOffset };
        const summary = input.includeSummary ? generateSummary(tasks) : undefined;
        content = formatAsJson(result, summary);
        break;
    }

    return ok({
      content,
      format: input.format ?? 'json',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return err({
      code: 'ASANA_API_ERROR',
      message,
    });
  }
}

/**
 * Get MCP tool definition
 */
export function getToolDefinition() {
  return {
    name: 'asana_list_tasks',
    description:
      'List tasks from an Asana project with filtering, sorting, and formatting options',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectGid: {
          type: 'string',
          description: 'Asana project GID',
        },
        sectionName: {
          type: 'string',
          description: 'Filter by section name',
        },
        includeCompleted: {
          type: 'boolean',
          description: 'Include completed tasks (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum tasks to return',
        },
        offset: {
          type: 'string',
          description: 'Pagination offset',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tag names (any match)',
        },
        excludeTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exclude tasks with these tags',
        },
        assigneeGid: {
          type: 'string',
          description: 'Filter by assignee GID',
        },
        unassignedOnly: {
          type: 'boolean',
          description: 'Only unassigned tasks',
        },
        overdueOnly: {
          type: 'boolean',
          description: 'Only overdue tasks',
        },
        nameContains: {
          type: 'string',
          description: 'Search in task name',
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'createdAt', 'modifiedAt', 'dueOn'],
          description: 'Sort field',
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order (default: asc)',
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown', 'text'],
          description: 'Output format (default: json)',
        },
        includeSummary: {
          type: 'boolean',
          description: 'Include summary statistics',
        },
        fetchAll: {
          type: 'boolean',
          description: 'Fetch all pages (ignore limit/offset)',
        },
      },
      required: ['projectGid'],
    },
  };
}
