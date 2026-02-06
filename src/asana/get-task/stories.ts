/**
 * @module asana/get-task/stories
 * @description Stories (comments) retrieval for Asana tasks
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';
import { htmlToMarkdown } from './html-to-md.js';

/** Story type from Asana */
export type StoryType = 'comment' | 'system';

/** Story (comment or activity) from Asana */
export interface TaskStory {
  readonly gid: string;
  readonly type: StoryType;
  readonly text: string;
  readonly htmlText: string | null;
  readonly markdownText: string;
  readonly createdAt: string;
  readonly createdBy: {
    readonly gid: string;
    readonly name: string;
  } | null;
  readonly resourceSubtype: string;
  readonly isPinned: boolean;
  readonly isEdited: boolean;
  readonly numLikes: number;
}

/** Options for fetching stories */
export interface GetStoriesOptions {
  /** Include system-generated stories (default: false) */
  readonly includeSystem?: boolean | undefined;
  /** Maximum stories to return */
  readonly limit?: number | undefined;
  /** Convert HTML to Markdown (default: true) */
  readonly convertToMarkdown?: boolean | undefined;
}

/** Fields to request from Asana API */
const STORY_OPT_FIELDS = [
  'gid',
  'type',
  'text',
  'html_text',
  'created_at',
  'created_by.gid',
  'created_by.name',
  'resource_subtype',
  'is_pinned',
  'is_edited',
  'num_likes',
].join(',');

/**
 * Get stories (comments and activity) for a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param options - Fetch options
 * @returns Array of stories
 */
export async function getTaskStories(
  config: AsanaConfig,
  taskGid: string,
  options: GetStoriesOptions = {}
): Promise<TaskStory[]> {
  const client = getAsanaClient(config);
  const { includeSystem = false, limit, convertToMarkdown = true } = options;

  const response = await client.stories.getStoriesForTask(taskGid, {
    opt_fields: STORY_OPT_FIELDS,
  });

  const stories: TaskStory[] = [];

  if (Array.isArray(response.data)) {
    for (const story of response.data) {
      const s = story as Record<string, unknown>;

      // Skip system stories if not requested
      const type = s['type'] as string;
      if (!includeSystem && type === 'system') {
        continue;
      }

      const htmlText = (s['html_text'] as string) ?? null;
      const text = (s['text'] as string) ?? '';
      const createdByData = s['created_by'] as Record<string, string> | null | undefined;

      stories.push({
        gid: s['gid'] as string,
        type: type === 'comment' ? 'comment' : 'system',
        text,
        htmlText,
        markdownText: convertToMarkdown && htmlText
          ? htmlToMarkdown(htmlText, { convertMentions: true })
          : text,
        createdAt: s['created_at'] as string,
        createdBy: createdByData
          ? {
              gid: createdByData['gid'] ?? '',
              name: createdByData['name'] ?? '',
            }
          : null,
        resourceSubtype: s['resource_subtype'] as string,
        isPinned: (s['is_pinned'] as boolean) ?? false,
        isEdited: (s['is_edited'] as boolean) ?? false,
        numLikes: (s['num_likes'] as number) ?? 0,
      });

      // Apply limit
      if (limit && stories.length >= limit) {
        break;
      }
    }
  }

  return stories;
}

/**
 * Get only comments (no system stories)
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param limit - Maximum comments to return
 * @returns Array of comment stories
 */
export async function getTaskComments(
  config: AsanaConfig,
  taskGid: string,
  limit?: number
): Promise<TaskStory[]> {
  return getTaskStories(config, taskGid, {
    includeSystem: false,
    limit,
  });
}

/**
 * Get pinned stories
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Array of pinned stories
 */
export async function getPinnedStories(
  config: AsanaConfig,
  taskGid: string
): Promise<TaskStory[]> {
  const stories = await getTaskStories(config, taskGid, {
    includeSystem: false,
  });
  return stories.filter((s) => s.isPinned);
}

/**
 * Format stories as Markdown
 *
 * @param stories - Stories to format
 * @returns Markdown string
 */
export function formatStoriesAsMarkdown(stories: readonly TaskStory[]): string {
  if (stories.length === 0) {
    return '_No comments_';
  }

  const lines: string[] = [];

  for (const story of stories) {
    const author = story.createdBy?.name ?? 'Unknown';
    const date = new Date(story.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const pinned = story.isPinned ? ' (pinned)' : '';
    const edited = story.isEdited ? ' (edited)' : '';

    lines.push(`### ${author} - ${date}${pinned}${edited}`);
    lines.push('');
    lines.push(story.markdownText);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Remove trailing separator
  if (lines.length > 2) {
    lines.pop();
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Get latest comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Latest comment or null
 */
export async function getLatestComment(
  config: AsanaConfig,
  taskGid: string
): Promise<TaskStory | null> {
  const comments = await getTaskComments(config, taskGid, 1);
  return comments[0] ?? null;
}
