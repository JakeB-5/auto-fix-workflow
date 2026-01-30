/**
 * @module asana/list-tasks/format
 * @description Response formatting for task lists
 */

import type { TaskListItem, ListTasksResult } from './list.js';

/** Formatted task for API response */
export interface FormattedTask {
  readonly gid: string;
  readonly name: string;
  readonly status: 'completed' | 'incomplete';
  readonly assignee: string | null;
  readonly dueDate: string | null;
  readonly tags: readonly string[];
  readonly url: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
}

/** Formatted task list response */
export interface FormattedTaskList {
  readonly tasks: readonly FormattedTask[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextOffset: string | null;
}

/** Summary statistics for task list */
export interface TaskListSummary {
  readonly total: number;
  readonly completed: number;
  readonly incomplete: number;
  readonly overdue: number;
  readonly unassigned: number;
  readonly dueThisWeek: number;
}

/**
 * Format a single task for response
 *
 * @param task - Task to format
 * @returns Formatted task
 */
export function formatTask(task: TaskListItem): FormattedTask {
  return {
    gid: task.gid,
    name: task.name,
    status: task.completed ? 'completed' : 'incomplete',
    assignee: task.assignee?.name ?? null,
    dueDate: task.dueOn ?? task.dueAt ?? null,
    tags: task.tags.map((t) => t.name),
    url: task.permalink,
    createdAt: task.createdAt,
    modifiedAt: task.modifiedAt,
  };
}

/**
 * Format a task list result for response
 *
 * @param result - List result to format
 * @returns Formatted task list
 */
export function formatTaskList(result: ListTasksResult): FormattedTaskList {
  return {
    tasks: result.tasks.map(formatTask),
    total: result.tasks.length,
    hasMore: result.hasMore,
    nextOffset: result.nextOffset,
  };
}

/**
 * Generate summary statistics for a task list
 *
 * @param tasks - Tasks to summarize
 * @returns Summary statistics
 */
export function generateSummary(tasks: readonly TaskListItem[]): TaskListSummary {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));

  let completed = 0;
  let incomplete = 0;
  let overdue = 0;
  let unassigned = 0;
  let dueThisWeek = 0;

  for (const task of tasks) {
    if (task.completed) {
      completed++;
    } else {
      incomplete++;
    }

    if (!task.assignee) {
      unassigned++;
    }

    const dueDate = task.dueOn || task.dueAt;
    if (dueDate) {
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);

      if (!task.completed && due < now) {
        overdue++;
      }

      if (due >= now && due <= endOfWeek) {
        dueThisWeek++;
      }
    }
  }

  return {
    total: tasks.length,
    completed,
    incomplete,
    overdue,
    unassigned,
    dueThisWeek,
  };
}

/**
 * Format tasks as Markdown table
 *
 * @param tasks - Tasks to format
 * @returns Markdown table string
 */
export function formatAsMarkdownTable(tasks: readonly TaskListItem[]): string {
  if (tasks.length === 0) {
    return '_No tasks found_';
  }

  const lines: string[] = [
    '| Task | Status | Assignee | Due Date | Tags |',
    '|------|--------|----------|----------|------|',
  ];

  for (const task of tasks) {
    const status = task.completed ? 'Done' : 'Open';
    const assignee = task.assignee?.name ?? '-';
    const dueDate = task.dueOn ?? task.dueAt ?? '-';
    const tags = task.tags.map((t) => `\`${t.name}\``).join(', ') || '-';
    const name = `[${escapeMarkdown(task.name)}](${task.permalink})`;

    lines.push(`| ${name} | ${status} | ${assignee} | ${dueDate} | ${tags} |`);
  }

  return lines.join('\n');
}

/**
 * Format tasks as plain text list
 *
 * @param tasks - Tasks to format
 * @returns Plain text list
 */
export function formatAsPlainText(tasks: readonly TaskListItem[]): string {
  if (tasks.length === 0) {
    return 'No tasks found';
  }

  const lines: string[] = [];

  for (const task of tasks) {
    const checkbox = task.completed ? '[x]' : '[ ]';
    const assignee = task.assignee ? ` (@${task.assignee.name})` : '';
    const dueDate = task.dueOn || task.dueAt;
    const due = dueDate ? ` [Due: ${dueDate}]` : '';

    lines.push(`${checkbox} ${task.name}${assignee}${due}`);
  }

  return lines.join('\n');
}

/**
 * Format task list as JSON (for MCP tool response)
 *
 * @param result - List result
 * @param summary - Optional summary to include
 * @returns JSON string
 */
export function formatAsJson(
  result: ListTasksResult,
  summary?: TaskListSummary
): string {
  const formatted = formatTaskList(result);
  const response = summary ? { ...formatted, summary } : formatted;
  return JSON.stringify(response, null, 2);
}

/**
 * Escape Markdown special characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[|\\`*_{}[\]()#+\-.!]/g, '\\$&');
}
