/**
 * @module asana/get-task/api
 * @description Asana API call function for getting task details
 */

import type Asana from 'asana';
import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';

/** Raw task data from Asana API */
export interface RawTaskData {
  readonly gid: string;
  readonly name: string;
  readonly notes: string;
  readonly htmlNotes: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly dueOn: string | null;
  readonly dueAt: string | null;
  readonly startOn: string | null;
  readonly startAt: string | null;
  readonly assignee: { gid: string; name: string; email: string } | null;
  readonly assigneeSection: { gid: string; name: string } | null;
  readonly followers: Array<{ gid: string; name: string }>;
  readonly parent: { gid: string; name: string } | null;
  readonly projects: Array<{ gid: string; name: string }>;
  readonly tags: Array<{ gid: string; name: string }>;
  readonly memberships: Array<{
    project: { gid: string; name: string };
    section: { gid: string; name: string } | null;
  }>;
  readonly customFields: Array<{
    gid: string;
    name: string;
    type: string;
    displayValue: string | null;
    enumValue: { gid: string; name: string } | null;
    numberValue: number | null;
    textValue: string | null;
  }>;
  readonly resourceSubtype: string;
  readonly permalink: string;
  readonly numSubtasks: number;
  readonly numLikes: number;
  readonly liked: boolean;
}

/** Fields to request from Asana API */
const TASK_OPT_FIELDS = [
  'gid',
  'name',
  'notes',
  'html_notes',
  'completed',
  'completed_at',
  'created_at',
  'modified_at',
  'due_on',
  'due_at',
  'start_on',
  'start_at',
  'assignee.gid',
  'assignee.name',
  'assignee.email',
  'assignee_section.gid',
  'assignee_section.name',
  'followers.gid',
  'followers.name',
  'parent.gid',
  'parent.name',
  'projects.gid',
  'projects.name',
  'tags.gid',
  'tags.name',
  'memberships.project.gid',
  'memberships.project.name',
  'memberships.section.gid',
  'memberships.section.name',
  'custom_fields.gid',
  'custom_fields.name',
  'custom_fields.type',
  'custom_fields.display_value',
  'custom_fields.enum_value.gid',
  'custom_fields.enum_value.name',
  'custom_fields.number_value',
  'custom_fields.text_value',
  'resource_subtype',
  'permalink_url',
  'num_subtasks',
  'num_likes',
  'liked',
].join(',');

/**
 * Get task details from Asana API
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Raw task data
 */
export async function getTaskFromApi(
  config: AsanaConfig,
  taskGid: string
): Promise<RawTaskData> {
  const client = getAsanaClient(config);

  const task = await client.tasks.getTask(taskGid, {
    opt_fields: TASK_OPT_FIELDS,
  });

  return mapRawTask(task);
}

/**
 * Get task with client (for internal use)
 *
 * @param client - Asana client
 * @param taskGid - Task GID
 * @returns Raw task data
 */
export async function getTaskWithClient(
  client: Asana.Client,
  taskGid: string
): Promise<RawTaskData> {
  const task = await client.tasks.getTask(taskGid, {
    opt_fields: TASK_OPT_FIELDS,
  });

  return mapRawTask(task);
}

/**
 * Map Asana API response to RawTaskData
 */
function mapRawTask(task: Asana.resources.Tasks.Type): RawTaskData {
  const t = task as unknown as Record<string, unknown>;

  return {
    gid: t.gid as string,
    name: t.name as string,
    notes: (t.notes as string) ?? '',
    htmlNotes: (t.html_notes as string) ?? '',
    completed: t.completed as boolean,
    completedAt: (t.completed_at as string) ?? null,
    createdAt: t.created_at as string,
    modifiedAt: t.modified_at as string,
    dueOn: (t.due_on as string) ?? null,
    dueAt: (t.due_at as string) ?? null,
    startOn: (t.start_on as string) ?? null,
    startAt: (t.start_at as string) ?? null,
    assignee: t.assignee
      ? {
          gid: (t.assignee as Record<string, string>).gid,
          name: (t.assignee as Record<string, string>).name,
          email: (t.assignee as Record<string, string>).email,
        }
      : null,
    assigneeSection: t.assignee_section
      ? {
          gid: (t.assignee_section as Record<string, string>).gid,
          name: (t.assignee_section as Record<string, string>).name,
        }
      : null,
    followers: Array.isArray(t.followers)
      ? (t.followers as Array<{ gid: string; name: string }>).map((f) => ({
          gid: f.gid,
          name: f.name,
        }))
      : [],
    parent: t.parent
      ? {
          gid: (t.parent as Record<string, string>).gid,
          name: (t.parent as Record<string, string>).name,
        }
      : null,
    projects: Array.isArray(t.projects)
      ? (t.projects as Array<{ gid: string; name: string }>).map((p) => ({
          gid: p.gid,
          name: p.name,
        }))
      : [],
    tags: Array.isArray(t.tags)
      ? (t.tags as Array<{ gid: string; name: string }>).map((tag) => ({
          gid: tag.gid,
          name: tag.name,
        }))
      : [],
    memberships: Array.isArray(t.memberships)
      ? (
          t.memberships as Array<{
            project: { gid: string; name: string };
            section: { gid: string; name: string } | null;
          }>
        ).map((m) => ({
          project: { gid: m.project.gid, name: m.project.name },
          section: m.section
            ? { gid: m.section.gid, name: m.section.name }
            : null,
        }))
      : [],
    customFields: Array.isArray(t.custom_fields)
      ? (
          t.custom_fields as Array<{
            gid: string;
            name: string;
            type: string;
            display_value: string | null;
            enum_value: { gid: string; name: string } | null;
            number_value: number | null;
            text_value: string | null;
          }>
        ).map((cf) => ({
          gid: cf.gid,
          name: cf.name,
          type: cf.type,
          displayValue: cf.display_value,
          enumValue: cf.enum_value
            ? { gid: cf.enum_value.gid, name: cf.enum_value.name }
            : null,
          numberValue: cf.number_value,
          textValue: cf.text_value,
        }))
      : [],
    resourceSubtype: t.resource_subtype as string,
    permalink: t.permalink_url as string,
    numSubtasks: (t.num_subtasks as number) ?? 0,
    numLikes: (t.num_likes as number) ?? 0,
    liked: (t.liked as boolean) ?? false,
  };
}

/**
 * Get subtasks for a task
 *
 * @param config - Asana configuration
 * @param taskGid - Parent task GID
 * @returns Array of subtask summaries
 */
export async function getSubtasks(
  config: AsanaConfig,
  taskGid: string
): Promise<Array<{ gid: string; name: string; completed: boolean }>> {
  const client = getAsanaClient(config);

  const response = await client.tasks.getSubtasksForTask(taskGid, {
    opt_fields: 'gid,name,completed',
  });

  const subtasks: Array<{ gid: string; name: string; completed: boolean }> = [];

  if (response.data && Array.isArray(response.data)) {
    for (const subtask of response.data) {
      const s = subtask as unknown as Record<string, unknown>;
      subtasks.push({
        gid: s.gid as string,
        name: s.name as string,
        completed: s.completed as boolean,
      });
    }
  }

  return subtasks;
}
