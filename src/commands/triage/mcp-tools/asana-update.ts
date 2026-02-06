/**
 * @module commands/triage/mcp-tools/asana-update
 * @description MCP tool for updating Asana tasks
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Result } from '../../../common/types/index.js';
import { ok, err, isFailure } from '../../../common/types/index.js';
import type { AsanaTaskUpdateParams, AsanaTask } from '../types.js';

/**
 * Result of an Asana task update
 */
export interface AsanaUpdateResult {
  /** Updated task GID */
  readonly taskGid: string;
  /** Whether the update was successful */
  readonly updated: boolean;
  /** Updated fields */
  readonly updatedFields: readonly string[];
}

/**
 * Asana MCP tool for updating tasks
 */
export class AsanaUpdateTool {
  private readonly client: Client;
  private readonly updateToolName: string;
  private readonly addTagToolName: string;
  private readonly removeTagToolName: string;
  private readonly moveSectionToolName: string;

  constructor(
    client: Client,
    options: {
      updateToolName?: string;
      addTagToolName?: string;
      removeTagToolName?: string;
      moveSectionToolName?: string;
    } = {}
  ) {
    this.client = client;
    this.updateToolName = options.updateToolName ?? 'asana_update_task';
    this.addTagToolName = options.addTagToolName ?? 'asana_add_tag_to_task';
    this.removeTagToolName = options.removeTagToolName ?? 'asana_remove_tag_from_task';
    this.moveSectionToolName = options.moveSectionToolName ?? 'asana_add_task_to_section';
  }

  /**
   * Update an Asana task
   */
  async updateTask(params: AsanaTaskUpdateParams): Promise<Result<AsanaUpdateResult, Error>> {
    const updatedFields: string[] = [];
    const errors: string[] = [];

    try {
      // Update basic task fields
      if (params.appendNotes !== undefined || params.completed !== undefined || params.customFields) {
        const updateParams: Record<string, unknown> = {
          task: params.taskGid,
        };

        if (params.appendNotes !== undefined) {
          // Note: In a real implementation, we'd need to get current notes first
          updateParams['notes'] = params.appendNotes;
          updatedFields.push('notes');
        }

        if (params.completed !== undefined) {
          updateParams['completed'] = params.completed;
          updatedFields.push('completed');
        }

        if (params.customFields) {
          updateParams['custom_fields'] = params.customFields;
          updatedFields.push('custom_fields');
        }

        const result = await this.client.callTool({
          name: this.updateToolName,
          arguments: updateParams,
        });

        if (!result.content) {
          errors.push('Failed to update task fields');
        }
      }

      // Move to new section
      if (params.sectionGid) {
        const moveResult = await this.moveTaskToSection(params.taskGid, params.sectionGid);
        if (moveResult.success) {
          updatedFields.push('section');
        } else if (isFailure(moveResult)) {
          errors.push(`Failed to move section: ${moveResult.error.message}`);
        }
      }

      // Add tags
      if (params.addTags && params.addTags.length > 0) {
        for (const tagGid of params.addTags) {
          const tagResult = await this.addTagToTask(params.taskGid, tagGid);
          if (tagResult.success) {
            updatedFields.push(`tag:${tagGid}`);
          } else if (isFailure(tagResult)) {
            errors.push(`Failed to add tag ${tagGid}: ${tagResult.error.message}`);
          }
        }
      }

      // Remove tags
      if (params.removeTags && params.removeTags.length > 0) {
        for (const tagGid of params.removeTags) {
          const tagResult = await this.removeTagFromTask(params.taskGid, tagGid);
          if (tagResult.success) {
            updatedFields.push(`untag:${tagGid}`);
          } else if (isFailure(tagResult)) {
            errors.push(`Failed to remove tag ${tagGid}: ${tagResult.error.message}`);
          }
        }
      }

      if (errors.length > 0 && updatedFields.length === 0) {
        return err(new Error(`All updates failed: ${errors.join('; ')}`));
      }

      return ok({
        taskGid: params.taskGid,
        updated: updatedFields.length > 0,
        updatedFields,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to update Asana task: ${String(error)}`)
      );
    }
  }

  /**
   * Move a task to a different section
   */
  async moveTaskToSection(taskGid: string, sectionGid: string): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: this.moveSectionToolName,
        arguments: {
          task: taskGid,
          section: sectionGid,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to move task to section: ${String(error)}`)
      );
    }
  }

  /**
   * Add a tag to a task
   */
  async addTagToTask(taskGid: string, tagGid: string): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: this.addTagToolName,
        arguments: {
          task: taskGid,
          tag: tagGid,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to add tag to task: ${String(error)}`)
      );
    }
  }

  /**
   * Remove a tag from a task
   */
  async removeTagFromTask(taskGid: string, tagGid: string): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: this.removeTagToolName,
        arguments: {
          task: taskGid,
          tag: tagGid,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to remove tag from task: ${String(error)}`)
      );
    }
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskGid: string, text: string): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: 'asana_add_comment_to_task',
        arguments: {
          task: taskGid,
          text,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to add comment to task: ${String(error)}`)
      );
    }
  }

  /**
   * Append notes to existing task notes
   */
  async appendNotes(task: AsanaTask, additionalNotes: string): Promise<Result<void, Error>> {
    const newNotes = task.notes
      ? `${task.notes}\n\n---\n\n${additionalNotes}`
      : additionalNotes;

    try {
      await this.client.callTool({
        name: this.updateToolName,
        arguments: {
          task: task.gid,
          notes: newNotes,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to append notes: ${String(error)}`)
      );
    }
  }

  /**
   * Mark task as complete
   */
  async completeTask(taskGid: string): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: this.updateToolName,
        arguments: {
          task: taskGid,
          completed: true,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to complete task: ${String(error)}`)
      );
    }
  }

  /**
   * Update custom field value
   */
  async updateCustomField(
    taskGid: string,
    fieldGid: string,
    value: string | number | null
  ): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: this.updateToolName,
        arguments: {
          task: taskGid,
          custom_fields: {
            [fieldGid]: value,
          },
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to update custom field: ${String(error)}`)
      );
    }
  }
}

/**
 * Create an AsanaUpdateTool instance
 */
export function createAsanaUpdateTool(
  client: Client,
  options?: {
    updateToolName?: string;
    addTagToolName?: string;
    removeTagToolName?: string;
    moveSectionToolName?: string;
  }
): AsanaUpdateTool {
  return new AsanaUpdateTool(client, options);
}
