/**
 * @module asana/update-task/sections
 * @description Section movement for Asana tasks
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';
import { getSectionGidByName, getSectionsWithCache, type SectionInfo } from '../list-tasks/cache.js';

/** Section move result */
export interface SectionMoveResult {
  readonly success: boolean;
  readonly taskGid: string;
  readonly fromSection: string | null;
  readonly toSection: string;
  readonly projectGid: string;
  readonly error?: string;
}

/**
 * Move a task to a section
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param projectGid - Project GID
 * @param sectionGid - Target section GID
 * @param insertBefore - Insert before this task (optional)
 * @param insertAfter - Insert after this task (optional)
 * @returns Move result
 */
export async function moveTaskToSection(
  config: AsanaConfig,
  taskGid: string,
  projectGid: string,
  sectionGid: string,
  insertBefore?: string,
  insertAfter?: string
): Promise<SectionMoveResult> {
  const client = getAsanaClient(config);

  try {
    const requestData: Record<string, unknown> = {
      task: taskGid,
    };

    if (insertBefore) {
      requestData.insert_before = insertBefore;
    } else if (insertAfter) {
      requestData.insert_after = insertAfter;
    }

    await client.sections.addTaskForSection(sectionGid, {
      data: requestData,
    } as Parameters<typeof client.sections.addTaskForSection>[1]);

    return {
      success: true,
      taskGid,
      fromSection: null, // Would need to fetch current section
      toSection: sectionGid,
      projectGid,
    };
  } catch (error) {
    return {
      success: false,
      taskGid,
      fromSection: null,
      toSection: sectionGid,
      projectGid,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Move a task to a section by name
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param projectGid - Project GID
 * @param sectionName - Target section name
 * @returns Move result
 */
export async function moveTaskToSectionByName(
  config: AsanaConfig,
  taskGid: string,
  projectGid: string,
  sectionName: string
): Promise<SectionMoveResult> {
  const client = getAsanaClient(config);

  const sectionGid = await getSectionGidByName(client, projectGid, sectionName);

  if (!sectionGid) {
    return {
      success: false,
      taskGid,
      fromSection: null,
      toSection: sectionName,
      projectGid,
      error: `Section "${sectionName}" not found in project`,
    };
  }

  return moveTaskToSection(config, taskGid, projectGid, sectionGid);
}

/**
 * Move task to Triage section
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param projectGid - Project GID
 * @returns Move result
 */
export async function moveToTriage(
  config: AsanaConfig,
  taskGid: string,
  projectGid: string
): Promise<SectionMoveResult> {
  const sectionName = config.triageSection ?? 'Triage';
  return moveTaskToSectionByName(config, taskGid, projectGid, sectionName);
}

/**
 * Move task to Done section
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param projectGid - Project GID
 * @returns Move result
 */
export async function moveToDone(
  config: AsanaConfig,
  taskGid: string,
  projectGid: string
): Promise<SectionMoveResult> {
  const sectionName = config.doneSection ?? 'Done';
  return moveTaskToSectionByName(config, taskGid, projectGid, sectionName);
}

/**
 * Move task to In Progress section
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param projectGid - Project GID
 * @returns Move result
 */
export async function moveToInProgress(
  config: AsanaConfig,
  taskGid: string,
  projectGid: string
): Promise<SectionMoveResult> {
  return moveTaskToSectionByName(config, taskGid, projectGid, 'In Progress');
}

/**
 * Get current section for a task in a project
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param projectGid - Project GID
 * @returns Section info or null
 */
export async function getCurrentSection(
  config: AsanaConfig,
  taskGid: string,
  projectGid: string
): Promise<SectionInfo | null> {
  const client = getAsanaClient(config);

  // Get task memberships
  const task = await client.tasks.getTask(taskGid, {
    opt_fields: 'memberships.section.gid,memberships.section.name,memberships.project.gid',
  });

  const t = task as unknown as Record<string, unknown>;
  const memberships = t.memberships as Array<{
    project: { gid: string };
    section: { gid: string; name: string } | null;
  }> | undefined;

  if (!memberships) return null;

  const membership = memberships.find((m) => m.project.gid === projectGid);

  if (!membership || !membership.section) return null;

  return {
    gid: membership.section.gid,
    name: membership.section.name,
  };
}

/**
 * Get all sections for a project
 *
 * @param config - Asana configuration
 * @param projectGid - Project GID
 * @returns Array of section info
 */
export async function getProjectSections(
  config: AsanaConfig,
  projectGid: string
): Promise<SectionInfo[]> {
  const client = getAsanaClient(config);
  return getSectionsWithCache(client, projectGid);
}

/**
 * Move multiple tasks to a section
 *
 * @param config - Asana configuration
 * @param taskGids - Task GIDs
 * @param projectGid - Project GID
 * @param sectionGid - Target section GID
 * @returns Array of move results
 */
export async function moveTasksToSection(
  config: AsanaConfig,
  taskGids: readonly string[],
  projectGid: string,
  sectionGid: string
): Promise<SectionMoveResult[]> {
  const results: SectionMoveResult[] = [];

  for (const taskGid of taskGids) {
    const result = await moveTaskToSection(config, taskGid, projectGid, sectionGid);
    results.push(result);
  }

  return results;
}
