/**
 * @module asana/update-task/update
 * @description Integrated update function for Asana tasks
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';
import { invalidateTaskCache } from '../get-task/cache.js';
import { markdownToHtml } from './md-to-html.js';
import { addTagToTask, removeTagFromTask } from './tags.js';
import { getOrCreateTag } from './tag-cache.js';
import { moveTaskToSectionByName, type SectionMoveResult } from './sections.js';
import { addComment, type CreatedComment } from './comments.js';

/** Task update options */
export interface UpdateTaskOptions {
  /** Task GID to update */
  readonly taskGid: string;
  /** New task name */
  readonly name?: string | undefined;
  /** New task notes (plain text) */
  readonly notes?: string | undefined;
  /** New task notes (Markdown, will be converted) */
  readonly markdownNotes?: string | undefined;
  /** New task notes (HTML) */
  readonly htmlNotes?: string | undefined;
  /** Set completed status */
  readonly completed?: boolean | undefined;
  /** Set due date (YYYY-MM-DD) */
  readonly dueOn?: string | null | undefined;
  /** Set due date/time (ISO 8601) */
  readonly dueAt?: string | null | undefined;
  /** Set start date (YYYY-MM-DD) */
  readonly startOn?: string | null | undefined;
  /** Set assignee GID (null to unassign) */
  readonly assigneeGid?: string | null | undefined;
  /** Tags to add (by name - will be created if needed) */
  readonly addTags?: readonly string[] | undefined;
  /** Tag GIDs to add */
  readonly addTagGids?: readonly string[] | undefined;
  /** Tags to remove (by name) */
  readonly removeTags?: readonly string[] | undefined;
  /** Tag GIDs to remove */
  readonly removeTagGids?: readonly string[] | undefined;
  /** Move to section (by name) */
  readonly moveToSection?: string | undefined;
  /** Project GID for section move */
  readonly projectGid?: string | undefined;
  /** Comment to add */
  readonly comment?: string | undefined;
  /** Comment is Markdown */
  readonly commentIsMarkdown?: boolean | undefined;
}

/** Task update result */
export interface UpdateTaskResult {
  readonly success: boolean;
  readonly taskGid: string;
  readonly updatedFields: readonly string[];
  readonly tagResults: readonly {
    readonly tag: string;
    readonly operation: 'add' | 'remove';
    readonly success: boolean;
  }[];
  readonly sectionMove?: SectionMoveResult | undefined;
  readonly comment?: CreatedComment | undefined;
  readonly errors: readonly string[];
}

/**
 * Update a task with multiple changes
 *
 * @param config - Asana configuration
 * @param options - Update options
 * @returns Update result
 */
export async function updateTask(
  config: AsanaConfig,
  options: UpdateTaskOptions
): Promise<UpdateTaskResult> {
  const client = getAsanaClient(config);
  const errors: string[] = [];
  const updatedFields: string[] = [];
  const tagResults: Array<{
    tag: string;
    operation: 'add' | 'remove';
    success: boolean;
  }> = [];

  // Build task update data
  const updateData: Record<string, unknown> = {};

  if (options.name !== undefined) {
    updateData['name'] = options.name;
    updatedFields.push('name');
  }

  if (options.notes !== undefined) {
    updateData['notes'] = options.notes;
    updatedFields.push('notes');
  }

  if (options.markdownNotes !== undefined) {
    updateData['html_notes'] = markdownToHtml(options.markdownNotes, {
      wrapInBody: true,
    });
    updatedFields.push('html_notes');
  }

  if (options.htmlNotes !== undefined) {
    updateData['html_notes'] = options.htmlNotes;
    updatedFields.push('html_notes');
  }

  if (options.completed !== undefined) {
    updateData['completed'] = options.completed;
    updatedFields.push('completed');
  }

  if (options.dueOn !== undefined) {
    updateData['due_on'] = options.dueOn;
    updatedFields.push('due_on');
  }

  if (options.dueAt !== undefined) {
    updateData['due_at'] = options.dueAt;
    updatedFields.push('due_at');
  }

  if (options.startOn !== undefined) {
    updateData['start_on'] = options.startOn;
    updatedFields.push('start_on');
  }

  if (options.assigneeGid !== undefined) {
    updateData['assignee'] = options.assigneeGid;
    updatedFields.push('assignee');
  }

  // Apply main task update if there are changes
  if (Object.keys(updateData).length > 0) {
    try {
      await client.tasks.updateTask(options.taskGid, { data: updateData });
    } catch (error) {
      errors.push(
        `Task update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Handle tag additions by name
  if (options.addTags && options.addTags.length > 0) {
    for (const tagName of options.addTags) {
      try {
        const tag = await getOrCreateTag(config, tagName);
        const result = await addTagToTask(config, options.taskGid, tag.gid);
        tagResults.push({
          tag: tagName,
          operation: 'add',
          success: result.success,
        });
        if (!result.success && result.error) {
          errors.push(`Failed to add tag "${tagName}": ${result.error}`);
        }
      } catch (error) {
        tagResults.push({ tag: tagName, operation: 'add', success: false });
        errors.push(
          `Failed to add tag "${tagName}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Handle tag additions by GID
  if (options.addTagGids && options.addTagGids.length > 0) {
    for (const tagGid of options.addTagGids) {
      try {
        const result = await addTagToTask(config, options.taskGid, tagGid);
        tagResults.push({
          tag: tagGid,
          operation: 'add',
          success: result.success,
        });
        if (!result.success && result.error) {
          errors.push(`Failed to add tag GID "${tagGid}": ${result.error}`);
        }
      } catch (error) {
        tagResults.push({ tag: tagGid, operation: 'add', success: false });
        errors.push(
          `Failed to add tag GID "${tagGid}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Handle tag removals by name
  if (options.removeTags && options.removeTags.length > 0) {
    for (const tagName of options.removeTags) {
      try {
        const tag = await getOrCreateTag(config, tagName);
        const result = await removeTagFromTask(config, options.taskGid, tag.gid);
        tagResults.push({
          tag: tagName,
          operation: 'remove',
          success: result.success,
        });
        if (!result.success && result.error) {
          errors.push(`Failed to remove tag "${tagName}": ${result.error}`);
        }
      } catch (error) {
        tagResults.push({ tag: tagName, operation: 'remove', success: false });
        errors.push(
          `Failed to remove tag "${tagName}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Handle tag removals by GID
  if (options.removeTagGids && options.removeTagGids.length > 0) {
    for (const tagGid of options.removeTagGids) {
      try {
        const result = await removeTagFromTask(config, options.taskGid, tagGid);
        tagResults.push({
          tag: tagGid,
          operation: 'remove',
          success: result.success,
        });
        if (!result.success && result.error) {
          errors.push(`Failed to remove tag GID "${tagGid}": ${result.error}`);
        }
      } catch (error) {
        tagResults.push({ tag: tagGid, operation: 'remove', success: false });
        errors.push(
          `Failed to remove tag GID "${tagGid}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Handle section move
  let sectionMove: SectionMoveResult | undefined;
  if (options.moveToSection && options.projectGid) {
    sectionMove = await moveTaskToSectionByName(
      config,
      options.taskGid,
      options.projectGid,
      options.moveToSection
    );
    if (!sectionMove.success && sectionMove.error) {
      errors.push(`Section move failed: ${sectionMove.error}`);
    }
  }

  // Handle comment
  let comment: CreatedComment | undefined;
  if (options.comment) {
    try {
      comment = await addComment(config, {
        taskGid: options.taskGid,
        text: options.comment,
        isMarkdown: options.commentIsMarkdown ?? false,
      });
    } catch (error) {
      errors.push(
        `Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Invalidate cache
  invalidateTaskCache(options.taskGid);

  return {
    success: errors.length === 0,
    taskGid: options.taskGid,
    updatedFields,
    tagResults,
    sectionMove,
    comment,
    errors,
  };
}

/**
 * Mark a task as completed
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Update result
 */
export async function completeTask(
  config: AsanaConfig,
  taskGid: string
): Promise<UpdateTaskResult> {
  return updateTask(config, { taskGid, completed: true });
}

/**
 * Mark a task as incomplete
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Update result
 */
export async function reopenTask(
  config: AsanaConfig,
  taskGid: string
): Promise<UpdateTaskResult> {
  return updateTask(config, { taskGid, completed: false });
}

/**
 * Assign a task to a user
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param assigneeGid - Assignee GID
 * @returns Update result
 */
export async function assignTask(
  config: AsanaConfig,
  taskGid: string,
  assigneeGid: string
): Promise<UpdateTaskResult> {
  return updateTask(config, { taskGid, assigneeGid });
}

/**
 * Unassign a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Update result
 */
export async function unassignTask(
  config: AsanaConfig,
  taskGid: string
): Promise<UpdateTaskResult> {
  return updateTask(config, { taskGid, assigneeGid: null });
}

/**
 * Set task due date
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param dueOn - Due date (YYYY-MM-DD) or null to clear
 * @returns Update result
 */
export async function setDueDate(
  config: AsanaConfig,
  taskGid: string,
  dueOn: string | null
): Promise<UpdateTaskResult> {
  return updateTask(config, { taskGid, dueOn });
}
