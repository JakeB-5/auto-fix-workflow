/**
 * @module asana/list-tasks/filter
 * @description Filtering logic for task lists
 */

import type { TaskListItem } from './list.js';

/** Filter criteria for tasks */
export interface TaskFilterCriteria {
  /** Filter by tag names (any match) */
  readonly tags?: readonly string[];
  /** Exclude tasks with these tag names */
  readonly excludeTags?: readonly string[];
  /** Filter by assignee GID */
  readonly assigneeGid?: string;
  /** Filter unassigned tasks only */
  readonly unassignedOnly?: boolean;
  /** Filter by due date (tasks due on or before) */
  readonly dueBefore?: Date;
  /** Filter by due date (tasks due on or after) */
  readonly dueAfter?: Date;
  /** Filter overdue tasks only */
  readonly overdueOnly?: boolean;
  /** Filter by custom field value (field name -> value) */
  readonly customFields?: Record<string, string>;
  /** Search in task name (case-insensitive) */
  readonly nameContains?: string;
  /** Filter by resource subtype */
  readonly resourceSubtype?: 'default_task' | 'milestone' | 'section' | 'approval';
}

/**
 * Apply filters to a task list
 *
 * @param tasks - Tasks to filter
 * @param criteria - Filter criteria
 * @returns Filtered tasks
 */
export function filterTasks(
  tasks: readonly TaskListItem[],
  criteria: TaskFilterCriteria
): TaskListItem[] {
  return tasks.filter((task) => matchesAllCriteria(task, criteria));
}

/**
 * Check if a task matches all filter criteria
 */
function matchesAllCriteria(
  task: TaskListItem,
  criteria: TaskFilterCriteria
): boolean {
  // Tag inclusion filter
  if (criteria.tags && criteria.tags.length > 0) {
    const taskTagNames = new Set(task.tags.map((t) => t.name.toLowerCase()));
    const hasMatchingTag = criteria.tags.some((tag) =>
      taskTagNames.has(tag.toLowerCase())
    );
    if (!hasMatchingTag) return false;
  }

  // Tag exclusion filter
  if (criteria.excludeTags && criteria.excludeTags.length > 0) {
    const taskTagNames = new Set(task.tags.map((t) => t.name.toLowerCase()));
    const hasExcludedTag = criteria.excludeTags.some((tag) =>
      taskTagNames.has(tag.toLowerCase())
    );
    if (hasExcludedTag) return false;
  }

  // Assignee filter
  if (criteria.assigneeGid) {
    if (!task.assignee || task.assignee.gid !== criteria.assigneeGid) {
      return false;
    }
  }

  // Unassigned filter
  if (criteria.unassignedOnly && task.assignee !== null) {
    return false;
  }

  // Due date filters
  const taskDueDate = task.dueOn || task.dueAt;
  if (taskDueDate) {
    const dueDate = new Date(taskDueDate);

    if (criteria.dueBefore && dueDate > criteria.dueBefore) {
      return false;
    }

    if (criteria.dueAfter && dueDate < criteria.dueAfter) {
      return false;
    }

    if (criteria.overdueOnly) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (dueDate >= now) {
        return false;
      }
    }
  } else if (criteria.overdueOnly || criteria.dueBefore || criteria.dueAfter) {
    // Tasks without due date don't match due date filters
    return false;
  }

  // Custom field filter
  if (criteria.customFields) {
    for (const [fieldName, expectedValue] of Object.entries(
      criteria.customFields
    )) {
      const field = task.customFields.find(
        (cf) => cf.name.toLowerCase() === fieldName.toLowerCase()
      );
      if (!field || field.displayValue !== expectedValue) {
        return false;
      }
    }
  }

  // Name search filter
  if (criteria.nameContains) {
    if (
      !task.name.toLowerCase().includes(criteria.nameContains.toLowerCase())
    ) {
      return false;
    }
  }

  // Resource subtype filter
  if (criteria.resourceSubtype) {
    if (task.resourceSubtype !== criteria.resourceSubtype) {
      return false;
    }
  }

  return true;
}

/**
 * Sort tasks by various criteria
 */
export type TaskSortField = 'name' | 'createdAt' | 'modifiedAt' | 'dueOn';
export type TaskSortOrder = 'asc' | 'desc';

/**
 * Sort a task list
 *
 * @param tasks - Tasks to sort
 * @param field - Field to sort by
 * @param order - Sort order
 * @returns Sorted tasks
 */
export function sortTasks(
  tasks: readonly TaskListItem[],
  field: TaskSortField,
  order: TaskSortOrder = 'asc'
): TaskListItem[] {
  const sorted = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'modifiedAt':
        comparison =
          new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
        break;
      case 'dueOn': {
        const aDue = a.dueOn || a.dueAt;
        const bDue = b.dueOn || b.dueAt;
        if (!aDue && !bDue) comparison = 0;
        else if (!aDue) comparison = 1;
        else if (!bDue) comparison = -1;
        else comparison = new Date(aDue).getTime() - new Date(bDue).getTime();
        break;
      }
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Count tasks by tag
 *
 * @param tasks - Tasks to analyze
 * @returns Map of tag name to count
 */
export function countByTag(tasks: readonly TaskListItem[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    for (const tag of task.tags) {
      const current = counts.get(tag.name) ?? 0;
      counts.set(tag.name, current + 1);
    }
  }

  return counts;
}

/**
 * Count tasks by assignee
 *
 * @param tasks - Tasks to analyze
 * @returns Map of assignee name to count (unassigned -> "Unassigned")
 */
export function countByAssignee(
  tasks: readonly TaskListItem[]
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const name = task.assignee?.name ?? 'Unassigned';
    const current = counts.get(name) ?? 0;
    counts.set(name, current + 1);
  }

  return counts;
}
