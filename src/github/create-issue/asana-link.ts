/**
 * @module github/create-issue/asana-link
 * @description Asana integration for linking created issues
 */

import type { AsanaConfig } from '../../common/types/index.js';
import type { Issue } from '../../common/types/index.js';

/**
 * Link a created GitHub issue to an Asana task
 *
 * @param issue - Created GitHub issue
 * @param asanaTaskId - Asana task ID/GID
 * @param config - Asana configuration
 * @returns Promise resolving when link is created
 */
export async function linkToAsanaTask(
  issue: Issue,
  asanaTaskId: string,
  config: AsanaConfig
): Promise<void> {
  // This would be implemented with the Asana API client
  // For now, it's a placeholder that can be implemented when needed

  try {
    // Import Asana client dynamically to avoid hard dependency
    const Asana = await import('asana');
    const client = Asana.default.Client.create().useAccessToken(config.token);

    // Add GitHub issue URL as a comment on the Asana task
    const comment = `GitHub Issue Created: ${issue.url}`;

    await client.tasks.addComment(asanaTaskId, {
      text: comment,
    });

    // Optionally add custom field with GitHub issue number
    // This would require custom field configuration

  } catch (error) {
    // Non-critical error - log but don't fail the operation
    console.warn('Failed to link issue to Asana task:', error);
  }
}

/**
 * Update Asana task with GitHub issue information
 *
 * @param issue - Created GitHub issue
 * @param asanaTaskId - Asana task ID/GID
 * @param config - Asana configuration
 * @returns Promise resolving when task is updated
 */
export async function updateAsanaTaskWithIssue(
  issue: Issue,
  asanaTaskId: string,
  config: AsanaConfig
): Promise<void> {
  try {
    const Asana = await import('asana');
    const client = Asana.default.Client.create().useAccessToken(config.token);

    // Update task notes with GitHub issue link
    const task = await client.tasks.findById(asanaTaskId);

    const updatedNotes = task.notes
      ? `${task.notes}\n\n---\n\n**GitHub Issue**: ${issue.url}`
      : `**GitHub Issue**: ${issue.url}`;

    await client.tasks.update(asanaTaskId, {
      notes: updatedNotes,
    });

    // Add the synced tag if configured
    if (config.syncedTag) {
      const taskTags = task.tags || [];
      const syncedTagExists = taskTags.some((tag: any) => tag.name === config.syncedTag);

      if (!syncedTagExists) {
        // Find or create the tag
        const workspaceTagsResponse = await client.tags.findByWorkspace(config.workspaceGid);
        let syncedTag = workspaceTagsResponse.data.find((tag: any) => tag.name === config.syncedTag);

        if (!syncedTag) {
          syncedTag = await client.tags.createInWorkspace(config.workspaceGid, {
            name: config.syncedTag,
          });
        }

        // Add tag to task
        await client.tasks.addTag(asanaTaskId, {
          tag: syncedTag.gid,
        });
      }
    }
  } catch (error) {
    console.warn('Failed to update Asana task:', error);
  }
}

/**
 * Extract Asana task ID from issue context
 *
 * @param issue - Issue with potential Asana context
 * @returns Asana task ID if found
 */
export function extractAsanaTaskId(issue: Partial<Issue>): string | undefined {
  if (issue.context?.source === 'asana' && issue.context?.sourceId) {
    return issue.context.sourceId;
  }

  return undefined;
}

/**
 * Check if Asana integration is configured
 *
 * @param config - Asana configuration (may be undefined)
 * @returns True if Asana is properly configured
 */
export function isAsanaConfigured(config?: AsanaConfig): config is AsanaConfig {
  return (
    config !== undefined &&
    config.token.length > 0 &&
    config.workspaceGid.length > 0
  );
}
