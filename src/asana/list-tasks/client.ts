/**
 * @module asana/list-tasks/client
 * @description Asana API client initialization (v3 API)
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import Asana from 'asana';
import type { AsanaConfig } from '../../common/types/index.js';

// Asana v3 SDK doesn't include TypeScript definitions
// Cast to any to access runtime API classes
const AsanaSDK = Asana as any;

/**
 * Asana API client wrapper for v3 SDK
 * Provides a unified interface similar to v1 API structure
 */
export interface AsanaClientWrapper {
  readonly tasks: {
    getTask: (taskGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown }>;
    getTasksForProject: (projectGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[]; next_page?: { offset?: string } }>;
    getTasksForSection: (sectionGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[]; next_page?: { offset?: string } }>;
    getSubtasksForTask: (taskGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[] }>;
    updateTask: (taskGid: string, body: { data: Record<string, unknown> }) => Promise<{ data: unknown }>;
    addTagForTask: (taskGid: string, body: { tag: string }) => Promise<{ data: unknown }>;
    removeTagForTask: (taskGid: string, body: { tag: string }) => Promise<{ data: unknown }>;
  };
  readonly sections: {
    getSectionsForProject: (projectGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[] }>;
    addTaskForSection: (sectionGid: string, body: { data: Record<string, unknown> }) => Promise<{ data: unknown }>;
  };
  readonly tags: {
    getTagsForWorkspace: (workspaceGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[] }>;
    createTag: (body: { data: Record<string, unknown> }) => Promise<{ data: unknown }>;
  };
  readonly stories: {
    createStoryForTask: (taskGid: string, body: { data: Record<string, unknown> }) => Promise<{ data: unknown }>;
    getStoriesForTask: (taskGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[] }>;
  };
  readonly attachments: {
    getAttachmentsForTask: (taskGid: string, opts?: Record<string, unknown>) => Promise<{ data: unknown[] }>;
  };
}

/** Cached API instances */
let tasksApi: any = null;
let sectionsApi: any = null;
let tagsApi: any = null;
let storiesApi: any = null;
let attachmentsApi: any = null;

/**
 * Initialize Asana API client with token
 */
function initializeClient(token: string): void {
  const apiClient = AsanaSDK.ApiClient.instance;
  apiClient.authentications['token'].accessToken = token;

  // Create API instances
  tasksApi = new AsanaSDK.TasksApi();
  sectionsApi = new AsanaSDK.SectionsApi();
  tagsApi = new AsanaSDK.TagsApi();
  storiesApi = new AsanaSDK.StoriesApi();
  attachmentsApi = new AsanaSDK.AttachmentsApi();
}

/**
 * Get or create Asana client wrapper
 *
 * @param config - Asana configuration
 * @returns Asana client wrapper with v1-like interface
 */
export function getAsanaClient(config: AsanaConfig): AsanaClientWrapper {
  initializeClient(config.token);

  return {
    tasks: {
      getTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await tasksApi.getTask(taskGid, opts);
        return { data: result.data };
      },
      getTasksForProject: async (projectGid: string, opts?: Record<string, unknown>) => {
        const result = await tasksApi.getTasksForProject(projectGid, opts);
        return {
          data: result.data || [],
          next_page: result.next_page,
        };
      },
      getTasksForSection: async (sectionGid: string, opts?: Record<string, unknown>) => {
        const result = await tasksApi.getTasksForSection(sectionGid, opts);
        return {
          data: result.data || [],
          next_page: result.next_page,
        };
      },
      getSubtasksForTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await tasksApi.getSubtasksForTask(taskGid, opts);
        return { data: result.data || [] };
      },
      updateTask: async (taskGid: string, body: { data: Record<string, unknown> }) => {
        const result = await tasksApi.updateTask(body, taskGid);
        return { data: result.data };
      },
      addTagForTask: async (taskGid: string, body: { tag: string }) => {
        const result = await tasksApi.addTagForTask({ data: { tag: body.tag } }, taskGid);
        return { data: result.data };
      },
      removeTagForTask: async (taskGid: string, body: { tag: string }) => {
        const result = await tasksApi.removeTagForTask({ data: { tag: body.tag } }, taskGid);
        return { data: result.data };
      },
    },
    sections: {
      getSectionsForProject: async (projectGid: string, opts?: Record<string, unknown>) => {
        const result = await sectionsApi.getSectionsForProject(projectGid, opts);
        return { data: result.data || [] };
      },
      addTaskForSection: async (sectionGid: string, body: { data: Record<string, unknown> }) => {
        // Asana v3 SDK: addTaskForSection(section_gid, opts) where opts = { body: { data: {...} } }
        const result = await sectionsApi.addTaskForSection(sectionGid, { body });
        return { data: result.data };
      },
    },
    tags: {
      getTagsForWorkspace: async (workspaceGid: string, opts?: Record<string, unknown>) => {
        const result = await tagsApi.getTagsForWorkspace(workspaceGid, opts);
        return { data: result.data || [] };
      },
      createTag: async (body: { data: Record<string, unknown> }) => {
        const result = await tagsApi.createTag(body);
        return { data: result.data };
      },
    },
    stories: {
      createStoryForTask: async (taskGid: string, body: { data: Record<string, unknown> }) => {
        const result = await storiesApi.createStoryForTask(body, taskGid);
        return { data: result.data };
      },
      getStoriesForTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await storiesApi.getStoriesForTask(taskGid, opts);
        return { data: result.data || [] };
      },
    },
    attachments: {
      getAttachmentsForTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await attachmentsApi.getAttachmentsForTask(taskGid, opts);
        return { data: result.data || [] };
      },
    },
  };
}

/**
 * Reset client instance (for testing)
 */
export function resetClient(): void {
  tasksApi = null;
  sectionsApi = null;
  tagsApi = null;
  storiesApi = null;
  attachmentsApi = null;
}

/**
 * Create a new client without caching (for isolated operations)
 *
 * @param token - Asana access token
 * @returns New Asana client wrapper
 */
export function createClient(token: string): AsanaClientWrapper {
  // Set token on singleton API client
  const apiClient = AsanaSDK.ApiClient.instance;
  apiClient.authentications['token'].accessToken = token;

  const localTasksApi = new AsanaSDK.TasksApi();
  const localSectionsApi = new AsanaSDK.SectionsApi();
  const localTagsApi = new AsanaSDK.TagsApi();
  const localStoriesApi = new AsanaSDK.StoriesApi();
  const localAttachmentsApi = new AsanaSDK.AttachmentsApi();

  return {
    tasks: {
      getTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await localTasksApi.getTask(taskGid, opts);
        return { data: result.data };
      },
      getTasksForProject: async (projectGid: string, opts?: Record<string, unknown>) => {
        const result = await localTasksApi.getTasksForProject(projectGid, opts);
        return {
          data: result.data || [],
          next_page: result.next_page,
        };
      },
      getTasksForSection: async (sectionGid: string, opts?: Record<string, unknown>) => {
        const result = await localTasksApi.getTasksForSection(sectionGid, opts);
        return {
          data: result.data || [],
          next_page: result.next_page,
        };
      },
      getSubtasksForTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await localTasksApi.getSubtasksForTask(taskGid, opts);
        return { data: result.data || [] };
      },
      updateTask: async (taskGid: string, body: { data: Record<string, unknown> }) => {
        const result = await localTasksApi.updateTask(body, taskGid);
        return { data: result.data };
      },
      addTagForTask: async (taskGid: string, body: { tag: string }) => {
        const result = await localTasksApi.addTagForTask({ data: { tag: body.tag } }, taskGid);
        return { data: result.data };
      },
      removeTagForTask: async (taskGid: string, body: { tag: string }) => {
        const result = await localTasksApi.removeTagForTask({ data: { tag: body.tag } }, taskGid);
        return { data: result.data };
      },
    },
    sections: {
      getSectionsForProject: async (projectGid: string, opts?: Record<string, unknown>) => {
        const result = await localSectionsApi.getSectionsForProject(projectGid, opts);
        return { data: result.data || [] };
      },
      addTaskForSection: async (sectionGid: string, body: { data: Record<string, unknown> }) => {
        // Asana v3 SDK: addTaskForSection(section_gid, opts) where opts = { body: { data: {...} } }
        const result = await localSectionsApi.addTaskForSection(sectionGid, { body });
        return { data: result.data };
      },
    },
    tags: {
      getTagsForWorkspace: async (workspaceGid: string, opts?: Record<string, unknown>) => {
        const result = await localTagsApi.getTagsForWorkspace(workspaceGid, opts);
        return { data: result.data || [] };
      },
      createTag: async (body: { data: Record<string, unknown> }) => {
        const result = await localTagsApi.createTag(body);
        return { data: result.data };
      },
    },
    stories: {
      createStoryForTask: async (taskGid: string, body: { data: Record<string, unknown> }) => {
        const result = await localStoriesApi.createStoryForTask(body, taskGid);
        return { data: result.data };
      },
      getStoriesForTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await localStoriesApi.getStoriesForTask(taskGid, opts);
        return { data: result.data || [] };
      },
    },
    attachments: {
      getAttachmentsForTask: async (taskGid: string, opts?: Record<string, unknown>) => {
        const result = await localAttachmentsApi.getAttachmentsForTask(taskGid, opts);
        return { data: result.data || [] };
      },
    },
  };
}
