/**
 * @module analyzer/task-analyzer/asana-client
 * @description Asana API client for task operations
 */

// @ts-ignore - asana package doesn't have types
import Asana from 'asana';
import { Result, ok, err } from '../../common/types/index.js';
import type { AsanaTask, AnalyzerError } from './types.js';

/**
 * Asana client configuration
 */
export interface AsanaClientConfig {
  readonly accessToken: string;
  readonly workspace?: string;
}

/**
 * Asana API client wrapper
 */
export class AsanaClient {
  private readonly client: any;
  private readonly workspace: string | undefined;

  constructor(config: AsanaClientConfig) {
    this.client = Asana.ApiClient.instance;
    const token = this.client.authentications['token'];
    token.accessToken = config.accessToken;
    this.workspace = config.workspace;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Result<AsanaTask, AnalyzerError>> {
    try {
      const tasksApi = new Asana.TasksApiInstance(this.client);
      const task = await tasksApi.getTask(taskId, {
        opt_fields: [
          'name',
          'notes',
          'completed',
          'due_on',
          'tags',
          'tags.name',
          'custom_fields',
          'custom_fields.name',
          'custom_fields.type',
          'custom_fields.text_value',
          'custom_fields.number_value',
          'custom_fields.enum_value',
          'custom_fields.enum_value.name',
          'parent',
          'parent.name',
          'projects',
          'projects.name',
        ].join(','),
      });

      return ok(task as AsanaTask);
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return err({
          code: 'TASK_NOT_FOUND',
          message: `Task ${taskId} not found`,
          cause: error,
        });
      }

      return err({
        code: 'API_ERROR',
        message: `Failed to fetch task: ${(error as Error).message}`,
        cause: error,
      });
    }
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    updates: Partial<AsanaTask>
  ): Promise<Result<AsanaTask, AnalyzerError>> {
    try {
      const tasksApi = new Asana.TasksApiInstance(this.client);
      const task = await tasksApi.updateTask(taskId, { data: updates });
      return ok(task as AsanaTask);
    } catch (error) {
      return err({
        code: 'API_ERROR',
        message: `Failed to update task: ${(error as Error).message}`,
        cause: error,
      });
    }
  }

  /**
   * Add comment to task
   */
  async addComment(
    taskId: string,
    comment: string
  ): Promise<Result<void, AnalyzerError>> {
    try {
      const storiesApi = new Asana.StoriesApiInstance(this.client);
      await storiesApi.createStoryForTask(
        taskId,
        { data: { text: comment } }
      );
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'API_ERROR',
        message: `Failed to add comment: ${(error as Error).message}`,
        cause: error,
      });
    }
  }

  /**
   * Add tag to task
   */
  async addTag(
    taskId: string,
    tagId: string
  ): Promise<Result<void, AnalyzerError>> {
    try {
      const tasksApi = new Asana.TasksApiInstance(this.client);
      await tasksApi.addTagForTask(taskId, { data: { tag: tagId } });
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'API_ERROR',
        message: `Failed to add tag: ${(error as Error).message}`,
        cause: error,
      });
    }
  }
}
