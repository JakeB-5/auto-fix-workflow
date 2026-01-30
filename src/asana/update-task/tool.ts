/**
 * @module asana/update-task/tool
 * @description MCP Tool registration for update-task
 */

import { z } from 'zod';
import type { AsanaConfig } from '../../common/types/index.js';
import { ok, err, type Result } from '../../common/types/index.js';
import { updateTask, type UpdateTaskResult } from './update.js';

/** Tool input schema */
export const UpdateTaskInputSchema = z.object({
  taskGid: z.string().describe('Asana task GID'),
  name: z.string().optional().describe('New task name'),
  notes: z.string().optional().describe('New task notes (plain text)'),
  markdownNotes: z.string().optional().describe('New task notes (Markdown)'),
  completed: z.boolean().optional().describe('Mark task completed/incomplete'),
  dueOn: z.string().nullable().optional().describe('Due date (YYYY-MM-DD) or null to clear'),
  startOn: z.string().nullable().optional().describe('Start date (YYYY-MM-DD) or null to clear'),
  assigneeGid: z.string().nullable().optional().describe('Assignee GID or null to unassign'),
  addTags: z.array(z.string()).optional().describe('Tag names to add'),
  removeTags: z.array(z.string()).optional().describe('Tag names to remove'),
  addTagGids: z.array(z.string()).optional().describe('Tag GIDs to add'),
  removeTagGids: z.array(z.string()).optional().describe('Tag GIDs to remove'),
  moveToSection: z.string().optional().describe('Section name to move to'),
  projectGid: z.string().optional().describe('Project GID (required for section move)'),
  comment: z.string().optional().describe('Comment to add'),
  commentIsMarkdown: z.boolean().optional().describe('Comment is Markdown'),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

/** Tool output type */
export interface UpdateTaskOutput {
  readonly content: string;
  readonly result: UpdateTaskResult;
}

/** Tool error type */
export interface UpdateTaskError {
  readonly code: string;
  readonly message: string;
  readonly details?: readonly string[];
}

/**
 * Execute update-task tool
 *
 * @param config - Asana configuration
 * @param input - Tool input
 * @returns Tool output or error
 */
export async function executeUpdateTask(
  config: AsanaConfig,
  input: UpdateTaskInput
): Promise<Result<UpdateTaskOutput, UpdateTaskError>> {
  try {
    // Validate section move requires project GID
    if (input.moveToSection && !input.projectGid) {
      return err({
        code: 'MISSING_PROJECT_GID',
        message: 'projectGid is required when moveToSection is specified',
      });
    }

    // Execute update
    const result = await updateTask(config, {
      taskGid: input.taskGid,
      name: input.name,
      notes: input.notes,
      markdownNotes: input.markdownNotes,
      completed: input.completed,
      dueOn: input.dueOn,
      startOn: input.startOn,
      assigneeGid: input.assigneeGid,
      addTags: input.addTags,
      removeTags: input.removeTags,
      addTagGids: input.addTagGids,
      removeTagGids: input.removeTagGids,
      moveToSection: input.moveToSection,
      projectGid: input.projectGid,
      comment: input.comment,
      commentIsMarkdown: input.commentIsMarkdown,
    });

    // Build response content
    const content = formatUpdateResult(result);

    if (!result.success) {
      return err({
        code: 'UPDATE_PARTIAL_FAILURE',
        message: 'Some update operations failed',
        details: result.errors,
      });
    }

    return ok({
      content,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('Not Found')) {
      return err({
        code: 'TASK_NOT_FOUND',
        message: `Task ${input.taskGid} not found`,
      });
    }

    return err({
      code: 'ASANA_API_ERROR',
      message,
    });
  }
}

/**
 * Format update result as readable string
 */
function formatUpdateResult(result: UpdateTaskResult): string {
  const lines: string[] = [];

  lines.push(`## Task Update: ${result.taskGid}`);
  lines.push('');

  if (result.updatedFields.length > 0) {
    lines.push(`**Updated fields:** ${result.updatedFields.join(', ')}`);
  }

  if (result.tagResults.length > 0) {
    lines.push('');
    lines.push('**Tag operations:**');
    for (const tag of result.tagResults) {
      const status = tag.success ? 'OK' : 'FAILED';
      lines.push(`- ${tag.operation} "${tag.tag}": ${status}`);
    }
  }

  if (result.sectionMove) {
    lines.push('');
    const moveStatus = result.sectionMove.success ? 'OK' : 'FAILED';
    lines.push(`**Section move:** ${result.sectionMove.toSection} (${moveStatus})`);
  }

  if (result.comment) {
    lines.push('');
    lines.push(`**Comment added:** ${result.comment.gid}`);
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('**Errors:**');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  lines.push('');
  lines.push(`**Overall status:** ${result.success ? 'SUCCESS' : 'PARTIAL FAILURE'}`);

  return lines.join('\n');
}

/**
 * Get MCP tool definition
 */
export function getToolDefinition() {
  return {
    name: 'asana_update_task',
    description:
      'Update an Asana task - change name, notes, status, due date, assignee, tags, section, and add comments',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskGid: {
          type: 'string',
          description: 'Asana task GID',
        },
        name: {
          type: 'string',
          description: 'New task name',
        },
        notes: {
          type: 'string',
          description: 'New task notes (plain text)',
        },
        markdownNotes: {
          type: 'string',
          description: 'New task notes (Markdown - will be converted to HTML)',
        },
        completed: {
          type: 'boolean',
          description: 'Mark task completed (true) or incomplete (false)',
        },
        dueOn: {
          type: ['string', 'null'],
          description: 'Due date (YYYY-MM-DD format) or null to clear',
        },
        startOn: {
          type: ['string', 'null'],
          description: 'Start date (YYYY-MM-DD format) or null to clear',
        },
        assigneeGid: {
          type: ['string', 'null'],
          description: 'Assignee user GID or null to unassign',
        },
        addTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag names to add (will be created if they do not exist)',
        },
        removeTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag names to remove',
        },
        addTagGids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag GIDs to add',
        },
        removeTagGids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tag GIDs to remove',
        },
        moveToSection: {
          type: 'string',
          description: 'Section name to move task to (requires projectGid)',
        },
        projectGid: {
          type: 'string',
          description: 'Project GID (required for section move)',
        },
        comment: {
          type: 'string',
          description: 'Comment to add to the task',
        },
        commentIsMarkdown: {
          type: 'boolean',
          description: 'Whether comment is Markdown (default: false)',
        },
      },
      required: ['taskGid'],
    },
  };
}
