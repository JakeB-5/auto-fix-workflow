/**
 * @module asana/get-task/tool
 * @description MCP Tool registration for get-task
 */

import { z } from 'zod';
import type { AsanaConfig } from '../../common/types/index.js';
import { ok, err, type Result } from '../../common/types/index.js';
import { getTaskWithCache, getTaskFresh } from './cache.js';
import { getSubtasks, type RawTaskData } from './api.js';
import { htmlToMarkdown } from './html-to-md.js';
import { getTaskComments, formatStoriesAsMarkdown, type TaskStory } from './stories.js';
import { convertCustomFields, formatCustomFieldsAsMarkdown, type CustomFieldValue } from './custom-fields.js';
import { getTaskAttachments, formatAttachmentsAsMarkdown, type TaskAttachment } from './attachments.js';

/** Tool input schema */
export const GetTaskInputSchema = z.object({
  taskGid: z.string().describe('Asana task GID'),
  includeComments: z.boolean().optional().default(false).describe('Include task comments'),
  includeAttachments: z.boolean().optional().default(false).describe('Include attachment info'),
  includeSubtasks: z.boolean().optional().default(false).describe('Include subtask list'),
  commentLimit: z.number().optional().describe('Maximum comments to include'),
  bypassCache: z.boolean().optional().default(false).describe('Bypass cache and fetch fresh'),
  format: z.enum(['json', 'markdown']).optional().default('json').describe('Output format'),
});

export type GetTaskInput = z.infer<typeof GetTaskInputSchema>;

/** Formatted task output */
export interface FormattedTaskDetail {
  readonly gid: string;
  readonly name: string;
  readonly description: string;
  readonly htmlDescription: string;
  readonly markdownDescription: string;
  readonly completed: boolean;
  readonly status: 'completed' | 'incomplete';
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly dueOn: string | null;
  readonly dueAt: string | null;
  readonly startOn: string | null;
  readonly assignee: {
    readonly gid: string;
    readonly name: string;
    readonly email: string;
  } | null;
  readonly projects: Array<{ gid: string; name: string }>;
  readonly tags: Array<{ gid: string; name: string }>;
  readonly customFields: readonly CustomFieldValue[];
  readonly url: string;
  readonly parentTask: { gid: string; name: string } | null;
  readonly subtasks?: Array<{ gid: string; name: string; completed: boolean }>;
  readonly comments?: readonly TaskStory[];
  readonly attachments?: readonly TaskAttachment[];
}

/** Tool output type */
export interface GetTaskOutput {
  readonly content: string;
  readonly format: 'json' | 'markdown';
  readonly task: FormattedTaskDetail;
}

/** Tool error type */
export interface GetTaskError {
  readonly code: string;
  readonly message: string;
}

/**
 * Execute get-task tool
 *
 * @param config - Asana configuration
 * @param input - Tool input
 * @returns Tool output or error
 */
export async function executeGetTask(
  config: AsanaConfig,
  input: GetTaskInput
): Promise<Result<GetTaskOutput, GetTaskError>> {
  try {
    // Fetch task (cached or fresh)
    const rawTask = input.bypassCache
      ? await getTaskFresh(config, input.taskGid)
      : await getTaskWithCache(config, input.taskGid);

    // Build formatted task
    const task = await buildFormattedTask(config, rawTask, input);

    // Format output
    const content =
      input.format === 'markdown'
        ? formatTaskAsMarkdown(task)
        : JSON.stringify(task, null, 2);

    return ok({
      content,
      format: input.format ?? 'json',
      task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
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
 * Build formatted task with optional data
 */
async function buildFormattedTask(
  config: AsanaConfig,
  raw: RawTaskData,
  input: GetTaskInput
): Promise<FormattedTaskDetail> {
  const customFields = convertCustomFields(raw.customFields);
  const markdownDescription = raw.htmlNotes
    ? htmlToMarkdown(raw.htmlNotes, { convertMentions: true })
    : raw.notes;

  const task: FormattedTaskDetail = {
    gid: raw.gid,
    name: raw.name,
    description: raw.notes,
    htmlDescription: raw.htmlNotes,
    markdownDescription,
    completed: raw.completed,
    status: raw.completed ? 'completed' : 'incomplete',
    createdAt: raw.createdAt,
    modifiedAt: raw.modifiedAt,
    dueOn: raw.dueOn,
    dueAt: raw.dueAt,
    startOn: raw.startOn,
    assignee: raw.assignee,
    projects: raw.projects,
    tags: raw.tags,
    customFields,
    url: raw.permalink,
    parentTask: raw.parent,
  };

  // Fetch optional data in parallel
  const [subtasks, comments, attachments] = await Promise.all([
    input.includeSubtasks ? getSubtasks(config, raw.gid) : undefined,
    input.includeComments
      ? getTaskComments(config, raw.gid, input.commentLimit)
      : undefined,
    input.includeAttachments ? getTaskAttachments(config, raw.gid) : undefined,
  ]);

  return {
    ...task,
    subtasks,
    comments,
    attachments,
  };
}

/**
 * Format task as Markdown
 */
function formatTaskAsMarkdown(task: FormattedTaskDetail): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${task.name}`);
  lines.push('');

  // Status badge
  const statusBadge = task.completed ? '[COMPLETED]' : '[OPEN]';
  lines.push(`**Status:** ${statusBadge}`);

  // Metadata
  if (task.assignee) {
    lines.push(`**Assignee:** ${task.assignee.name} (${task.assignee.email})`);
  } else {
    lines.push('**Assignee:** Unassigned');
  }

  if (task.dueOn) {
    lines.push(`**Due:** ${task.dueOn}`);
  }

  if (task.projects.length > 0) {
    const projects = task.projects.map((p) => p.name).join(', ');
    lines.push(`**Projects:** ${projects}`);
  }

  if (task.tags.length > 0) {
    const tags = task.tags.map((t) => `\`${t.name}\``).join(', ');
    lines.push(`**Tags:** ${tags}`);
  }

  lines.push(`**URL:** ${task.url}`);
  lines.push('');

  // Description
  lines.push('## Description');
  lines.push('');
  lines.push(task.markdownDescription || '_No description_');
  lines.push('');

  // Custom fields
  if (task.customFields.length > 0) {
    lines.push('## Custom Fields');
    lines.push('');
    lines.push(formatCustomFieldsAsMarkdown(task.customFields));
    lines.push('');
  }

  // Subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    lines.push('## Subtasks');
    lines.push('');
    for (const subtask of task.subtasks) {
      const checkbox = subtask.completed ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${subtask.name}`);
    }
    lines.push('');
  }

  // Attachments
  if (task.attachments && task.attachments.length > 0) {
    lines.push('## Attachments');
    lines.push('');
    lines.push(formatAttachmentsAsMarkdown(task.attachments));
    lines.push('');
  }

  // Comments
  if (task.comments && task.comments.length > 0) {
    lines.push('## Comments');
    lines.push('');
    lines.push(formatStoriesAsMarkdown(task.comments));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get MCP tool definition
 */
export function getToolDefinition() {
  return {
    name: 'asana_get_task',
    description:
      'Get detailed information about an Asana task including description, comments, attachments, and subtasks',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskGid: {
          type: 'string',
          description: 'Asana task GID',
        },
        includeComments: {
          type: 'boolean',
          description: 'Include task comments (default: false)',
        },
        includeAttachments: {
          type: 'boolean',
          description: 'Include attachment info (default: false)',
        },
        includeSubtasks: {
          type: 'boolean',
          description: 'Include subtask list (default: false)',
        },
        commentLimit: {
          type: 'number',
          description: 'Maximum comments to include',
        },
        bypassCache: {
          type: 'boolean',
          description: 'Bypass cache and fetch fresh (default: false)',
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          description: 'Output format (default: json)',
        },
      },
      required: ['taskGid'],
    },
  };
}
