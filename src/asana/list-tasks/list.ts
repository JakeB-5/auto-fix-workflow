/**
 * @module asana/list-tasks/list
 * @description Task list query function
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from './client.js';
import { getSectionGidByName } from './cache.js';

/** Task item returned from list query */
export interface TaskListItem {
  readonly gid: string;
  readonly name: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly dueOn: string | null;
  readonly dueAt: string | null;
  readonly assignee: { gid: string; name: string } | null;
  readonly tags: Array<{ gid: string; name: string }>;
  readonly customFields: Array<{
    gid: string;
    name: string;
    displayValue: string | null;
  }>;
  readonly resourceSubtype: string;
  readonly permalink: string;
}

/** Options for listing tasks */
export interface ListTasksOptions {
  /** Project GID to query */
  readonly projectGid: string;
  /** Section name to filter by (optional) */
  readonly sectionName?: string;
  /** Section GID to filter by directly (optional, takes precedence over sectionName) */
  readonly sectionGid?: string;
  /** Include completed tasks (default: false) */
  readonly includeCompleted?: boolean;
  /** Maximum number of tasks to return */
  readonly limit?: number;
  /** Pagination offset token */
  readonly offset?: string;
}

/** Task list query result */
export interface ListTasksResult {
  readonly tasks: TaskListItem[];
  readonly nextOffset: string | null;
  readonly hasMore: boolean;
}

/** Fields to request from Asana API */
const TASK_OPT_FIELDS = [
  'gid',
  'name',
  'completed',
  'completed_at',
  'created_at',
  'modified_at',
  'due_on',
  'due_at',
  'assignee.gid',
  'assignee.name',
  'tags.gid',
  'tags.name',
  'custom_fields.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'resource_subtype',
  'permalink_url',
].join(',');

/**
 * List tasks from an Asana project
 *
 * @param config - Asana configuration
 * @param options - Query options
 * @returns List of tasks with pagination info
 */
export async function listTasks(
  config: AsanaConfig,
  options: ListTasksOptions
): Promise<ListTasksResult> {
  const client = getAsanaClient(config);

  // Use sectionGid directly if provided, otherwise lookup by name
  let sectionGid: string | undefined = options.sectionGid;
  if (!sectionGid && options.sectionName) {
    const gid = await getSectionGidByName(
      client,
      options.projectGid,
      options.sectionName
    );
    if (gid) {
      sectionGid = gid;
    }
  }

  // Build query parameters
  const queryParams: Record<string, unknown> = {
    opt_fields: TASK_OPT_FIELDS,
  };

  if (options.limit) {
    queryParams.limit = options.limit;
  }

  if (options.offset) {
    queryParams.offset = options.offset;
  }

  if (!options.includeCompleted) {
    queryParams.completed_since = 'now'; // Only incomplete tasks
  }

  // Fetch tasks from section or project
  let response: { data: unknown[]; next_page?: { offset?: string } };
  if (sectionGid) {
    response = await client.tasks.getTasksForSection(sectionGid, queryParams);
  } else {
    response = await client.tasks.getTasksForProject(
      options.projectGid,
      queryParams
    );
  }

  // Map response to TaskListItem
  const tasks = mapResponseToTasks(response.data);

  return {
    tasks,
    nextOffset: response.next_page?.offset ?? null,
    hasMore: !!response.next_page?.offset,
  };
}

/**
 * List all tasks (auto-paginate)
 *
 * @param config - Asana configuration
 * @param options - Query options (limit is ignored)
 * @returns All matching tasks
 */
export async function listAllTasks(
  config: AsanaConfig,
  options: Omit<ListTasksOptions, 'limit' | 'offset'>
): Promise<TaskListItem[]> {
  const allTasks: TaskListItem[] = [];
  let offset: string | undefined;

  do {
    const result = await listTasks(config, {
      ...options,
      limit: 100,
      offset,
    });
    allTasks.push(...result.tasks);
    offset = result.nextOffset ?? undefined;
  } while (offset);

  return allTasks;
}

/**
 * Map Asana API response to TaskListItem array
 */
function mapResponseToTasks(data: unknown[]): TaskListItem[] {
  const tasks: TaskListItem[] = [];

  if (Array.isArray(data)) {
    for (const task of data) {
      tasks.push(mapTaskToItem(task as Record<string, unknown>));
    }
  }

  return tasks;
}

/**
 * Map single Asana task to TaskListItem
 */
function mapTaskToItem(task: Record<string, unknown>): TaskListItem {
  const t = task;

  return {
    gid: t.gid as string,
    name: t.name as string,
    completed: t.completed as boolean,
    completedAt: (t.completed_at as string) ?? null,
    createdAt: t.created_at as string,
    modifiedAt: t.modified_at as string,
    dueOn: (t.due_on as string) ?? null,
    dueAt: (t.due_at as string) ?? null,
    assignee: t.assignee
      ? {
          gid: (t.assignee as Record<string, string>).gid,
          name: (t.assignee as Record<string, string>).name,
        }
      : null,
    tags: Array.isArray(t.tags)
      ? (t.tags as Array<{ gid: string; name: string }>).map((tag) => ({
          gid: tag.gid,
          name: tag.name,
        }))
      : [],
    customFields: Array.isArray(t.custom_fields)
      ? (t.custom_fields as Array<{ gid: string; name: string; display_value: string | null }>).map((cf) => ({
          gid: cf.gid,
          name: cf.name,
          displayValue: cf.display_value,
        }))
      : [],
    resourceSubtype: t.resource_subtype as string,
    permalink: t.permalink_url as string,
  };
}
