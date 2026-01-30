/**
 * @module asana/update-task/tags
 * @description Tag management module for Asana tasks
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';

/** Tag info */
export interface TagInfo {
  readonly gid: string;
  readonly name: string;
  readonly color: string | null;
}

/** Tag operation result */
export interface TagOperationResult {
  readonly success: boolean;
  readonly tagGid: string;
  readonly tagName: string;
  readonly operation: 'add' | 'remove';
  readonly error?: string;
}

/**
 * Add a tag to a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param tagGid - Tag GID to add
 * @returns Operation result
 */
export async function addTagToTask(
  config: AsanaConfig,
  taskGid: string,
  tagGid: string
): Promise<TagOperationResult> {
  const client = getAsanaClient(config);

  try {
    await client.tasks.addTagForTask(taskGid, { tag: tagGid });
    return {
      success: true,
      tagGid,
      tagName: '',
      operation: 'add',
    };
  } catch (error) {
    return {
      success: false,
      tagGid,
      tagName: '',
      operation: 'add',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a tag from a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param tagGid - Tag GID to remove
 * @returns Operation result
 */
export async function removeTagFromTask(
  config: AsanaConfig,
  taskGid: string,
  tagGid: string
): Promise<TagOperationResult> {
  const client = getAsanaClient(config);

  try {
    await client.tasks.removeTagForTask(taskGid, { tag: tagGid });
    return {
      success: true,
      tagGid,
      tagName: '',
      operation: 'remove',
    };
  } catch (error) {
    return {
      success: false,
      tagGid,
      tagName: '',
      operation: 'remove',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all tags in a workspace
 *
 * @param config - Asana configuration
 * @returns Array of tags
 */
export async function getWorkspaceTags(config: AsanaConfig): Promise<TagInfo[]> {
  const client = getAsanaClient(config);

  const response = await client.tags.getTagsForWorkspace(config.workspaceGid, {
    opt_fields: 'gid,name,color',
  });

  const tags: TagInfo[] = [];

  if (response.data && Array.isArray(response.data)) {
    for (const tag of response.data) {
      const t = tag as unknown as Record<string, unknown>;
      tags.push({
        gid: t.gid as string,
        name: t.name as string,
        color: (t.color as string) ?? null,
      });
    }
  }

  return tags;
}

/**
 * Find tag by name
 *
 * @param config - Asana configuration
 * @param name - Tag name to find
 * @returns Tag info or null
 */
export async function findTagByName(
  config: AsanaConfig,
  name: string
): Promise<TagInfo | null> {
  const tags = await getWorkspaceTags(config);
  return tags.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/**
 * Add multiple tags to a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param tagGids - Tag GIDs to add
 * @returns Array of operation results
 */
export async function addTagsToTask(
  config: AsanaConfig,
  taskGid: string,
  tagGids: readonly string[]
): Promise<TagOperationResult[]> {
  const results: TagOperationResult[] = [];

  for (const tagGid of tagGids) {
    const result = await addTagToTask(config, taskGid, tagGid);
    results.push(result);
  }

  return results;
}

/**
 * Remove multiple tags from a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param tagGids - Tag GIDs to remove
 * @returns Array of operation results
 */
export async function removeTagsFromTask(
  config: AsanaConfig,
  taskGid: string,
  tagGids: readonly string[]
): Promise<TagOperationResult[]> {
  const results: TagOperationResult[] = [];

  for (const tagGid of tagGids) {
    const result = await removeTagFromTask(config, taskGid, tagGid);
    results.push(result);
  }

  return results;
}

/**
 * Replace all tags on a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param currentTagGids - Current tag GIDs on task
 * @param newTagGids - Desired tag GIDs
 * @returns Operation results
 */
export async function replaceTaskTags(
  config: AsanaConfig,
  taskGid: string,
  currentTagGids: readonly string[],
  newTagGids: readonly string[]
): Promise<{
  added: TagOperationResult[];
  removed: TagOperationResult[];
}> {
  const currentSet = new Set(currentTagGids);
  const newSet = new Set(newTagGids);

  const toAdd = newTagGids.filter((gid) => !currentSet.has(gid));
  const toRemove = currentTagGids.filter((gid) => !newSet.has(gid));

  const [added, removed] = await Promise.all([
    addTagsToTask(config, taskGid, toAdd),
    removeTagsFromTask(config, taskGid, toRemove),
  ]);

  return { added, removed };
}
