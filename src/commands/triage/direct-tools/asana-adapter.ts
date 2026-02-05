/**
 * @module commands/triage/direct-tools/asana-adapter
 * @description Direct Asana API adapter for standalone CLI mode
 */

import type { AsanaConfig } from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err, isSuccess } from '../../../common/types/result.js';
import type { AsanaToolset, ListTasksParams } from '../toolset.types.js';
import type { AsanaTask, AsanaTaskUpdateParams } from '../types.js';

// Import existing Asana API modules
import { executeListTasks as apiListTasks } from '../../../asana/list-tasks/index.js';
import { executeGetTask as apiGetTask } from '../../../asana/get-task/index.js';
import { getAsanaClient, getSectionGidByName } from '../../../asana/list-tasks/index.js';
import { getTagGidByName } from '../../../asana/update-task/tag-cache.js';
// Import direct section/tag/comment functions
import { moveTaskToSection } from '../../../asana/update-task/sections.js';
import { addTagToTask } from '../../../asana/update-task/tags.js';
import { addComment } from '../../../asana/update-task/comments.js';

/**
 * Asana direct adapter
 *
 * Wraps the existing Asana API modules to implement the AsanaToolset interface.
 */
export class AsanaDirectAdapter implements AsanaToolset {
  constructor(private readonly config: AsanaConfig) {}

  async listTasks(params: ListTasksParams): Promise<Result<AsanaTask[], Error>> {
    try {
      // Import listTasks directly to use sectionGid option
      const { listTasks: directListTasks } = await import('../../../asana/list-tasks/list.js');

      // Use direct API call with sectionGid support
      const listResult = await directListTasks(this.config, {
        projectGid: params.projectGid,
        sectionGid: params.sectionGid, // Pass GID directly
        limit: params.limit,
        includeCompleted: false,
      });

      // directListTasks returns { tasks: TaskListItem[], ... } directly (not Result)
      // Map to AsanaTask format
      const tasks: AsanaTask[] = listResult.tasks.map((t: any) => ({
        gid: t.gid,
        name: t.name,
        notes: t.notes || '',
        permalinkUrl: t.permalink || t.permalink_url || t.permalinkUrl || '',
        dueOn: t.dueOn || t.due_on,
        dueAt: t.dueAt || t.due_at,
        assignee: t.assignee,
        customFields: t.customFields?.map((f: any) => ({
          gid: f.gid,
          name: f.name,
          displayValue: f.displayValue || f.display_value,
          type: f.type,
          enumValue: f.enumValue || f.enum_value,
          textValue: f.textValue || f.text_value,
          numberValue: f.numberValue || f.number_value,
        })),
        tags: t.tags?.map((tag: any) => ({ gid: tag.gid || '', name: tag.name || '' })),
        memberships: t.memberships,
        createdAt: t.createdAt || t.created_at,
        modifiedAt: t.modifiedAt || t.modified_at,
        completed: t.completed,
      }));

      return ok(tasks);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async getTask(taskGid: string): Promise<Result<AsanaTask, Error>> {
    try {
      // Build input matching GetTaskInput schema
      const result = await apiGetTask(this.config, {
        taskGid,
        format: 'json',
        includeComments: false,
        includeAttachments: false,
        includeSubtasks: false,
        bypassCache: false,
      });

      if (isSuccess(result)) {
        const content = result.data.content;
        const parsed = JSON.parse(content);
        const t = parsed.task || parsed.data || parsed;

        const task: AsanaTask = {
          gid: t.gid,
          name: t.name,
          notes: t.notes || t.description || '',
          permalinkUrl: t.permalink_url || t.permalinkUrl || t.url || '',
          dueOn: t.due_on || t.dueOn,
          dueAt: t.due_at || t.dueAt,
          assignee: t.assignee,
          customFields: t.custom_fields?.map((f: any) => ({
            gid: f.gid,
            name: f.name,
            displayValue: f.display_value || f.displayValue,
            type: f.type,
            enumValue: f.enum_value || f.enumValue,
            textValue: f.text_value || f.textValue,
            numberValue: f.number_value || f.numberValue,
          })) || t.customFields,
          tags: t.tags?.map((tag: any) => ({ gid: tag.gid || '', name: tag.name || '' })),
          memberships: t.memberships,
          createdAt: t.created_at || t.createdAt,
          modifiedAt: t.modified_at || t.modifiedAt,
          completed: t.completed,
        };

        return ok(task);
      }

      return err(new Error(result.error?.message || 'Failed to get task'));
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async updateTask(params: AsanaTaskUpdateParams): Promise<Result<void, Error>> {
    const errors: string[] = [];

    try {
      // Move to section (using GID directly)
      if (params.sectionGid && params.projectGid) {
        try {
          await moveTaskToSection(
            this.config,
            params.taskGid,
            params.projectGid,
            params.sectionGid
          );
        } catch (e) {
          errors.push(`Section move failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Add tags (using GIDs directly)
      if (params.addTags && params.addTags.length > 0) {
        for (const tagGid of params.addTags) {
          try {
            await addTagToTask(this.config, params.taskGid, tagGid);
          } catch (e) {
            errors.push(`Add tag ${tagGid} failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // Add comment (for appendNotes)
      if (params.appendNotes) {
        try {
          await addComment(this.config, {
            taskGid: params.taskGid,
            text: params.appendNotes,
          });
        } catch (e) {
          errors.push(`Add comment failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (errors.length > 0) {
        return err(new Error(`Partial update failure: ${errors.join('; ')}`));
      }

      return ok(undefined);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async findSectionByName(projectGid: string, sectionName: string): Promise<Result<string | null, Error>> {
    try {
      // Create client wrapper and use section cache function
      const client = getAsanaClient(this.config);
      const sectionGid = await getSectionGidByName(client, projectGid, sectionName);
      return ok(sectionGid);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async findTagByName(tagName: string): Promise<Result<string | null, Error>> {
    try {
      const tagGid = await getTagGidByName(this.config, tagName);
      return ok(tagGid);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Create Asana direct adapter
 */
export function createAsanaDirectAdapter(config: AsanaConfig): AsanaDirectAdapter {
  return new AsanaDirectAdapter(config);
}
