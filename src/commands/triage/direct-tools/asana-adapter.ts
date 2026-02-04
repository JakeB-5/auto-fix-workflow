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
import { executeUpdateTask as apiUpdateTask } from '../../../asana/update-task/index.js';
import { getAsanaClient, getSectionGidByName } from '../../../asana/list-tasks/index.js';
import { getTagGidByName } from '../../../asana/update-task/tag-cache.js';

/**
 * Asana direct adapter
 *
 * Wraps the existing Asana API modules to implement the AsanaToolset interface.
 */
export class AsanaDirectAdapter implements AsanaToolset {
  constructor(private readonly config: AsanaConfig) {}

  async listTasks(params: ListTasksParams): Promise<Result<AsanaTask[], Error>> {
    try {
      // Build input matching ListTasksInput schema
      const result = await apiListTasks(this.config, {
        projectGid: params.projectGid,
        sectionName: params.sectionGid, // API uses sectionName, not sectionGid
        limit: params.limit,
        includeCompleted: false,
        sortOrder: 'desc',
        format: 'json',
        includeSummary: false,
        fetchAll: false,
      });

      if (isSuccess(result)) {
        // Parse the content string to extract tasks
        // The API returns { content: string } format
        const content = result.data.content;
        const parsed = JSON.parse(content);

        // Map to AsanaTask format
        const tasks: AsanaTask[] = (parsed.tasks || parsed.data || []).map((t: any) => ({
          gid: t.gid,
          name: t.name,
          notes: t.notes || '',
          permalinkUrl: t.permalink_url || t.permalinkUrl || '',
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
        }));

        return ok(tasks);
      }

      return err(new Error(result.error?.message || 'Failed to list tasks'));
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
    try {
      // Build input matching UpdateTaskInput schema
      const result = await apiUpdateTask(this.config, {
        taskGid: params.taskGid,
        moveToSection: params.sectionGid, // API uses moveToSection, not sectionGid
        addTags: params.addTags ? [...params.addTags] : undefined,
        removeTags: params.removeTags ? [...params.removeTags] : undefined,
        completed: params.completed,
        // appendNotes is handled via comment
        comment: params.appendNotes,
      });

      if (isSuccess(result)) {
        return ok(undefined);
      }

      return err(new Error(result.error?.message || 'Failed to update task'));
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
