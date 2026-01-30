/**
 * @module asana/update-task/comments
 * @description Comment addition for Asana tasks
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';
import { markdownToHtml } from './md-to-html.js';

/** Comment creation options */
export interface AddCommentOptions {
  /** Task GID to comment on */
  readonly taskGid: string;
  /** Comment text (plain text or Markdown) */
  readonly text: string;
  /** Whether text is Markdown (will be converted to HTML) */
  readonly isMarkdown?: boolean;
  /** Pin the comment */
  readonly isPinned?: boolean;
}

/** Created comment info */
export interface CreatedComment {
  readonly gid: string;
  readonly text: string;
  readonly htmlText: string;
  readonly createdAt: string;
  readonly isPinned: boolean;
}

/**
 * Add a comment to a task
 *
 * @param config - Asana configuration
 * @param options - Comment options
 * @returns Created comment info
 */
export async function addComment(
  config: AsanaConfig,
  options: AddCommentOptions
): Promise<CreatedComment> {
  const client = getAsanaClient(config);

  // Build comment data
  const commentData: Record<string, unknown> = {};

  if (options.isMarkdown) {
    // Convert Markdown to HTML
    const htmlText = markdownToHtml(options.text, { wrapInBody: true });
    commentData.html_text = htmlText;
  } else {
    commentData.text = options.text;
  }

  if (options.isPinned) {
    commentData.is_pinned = true;
  }

  const response = await client.stories.createStoryForTask(options.taskGid, {
    data: commentData,
    opt_fields: 'gid,text,html_text,created_at,is_pinned',
  } as Parameters<typeof client.stories.createStoryForTask>[1]);

  const s = response as unknown as Record<string, unknown>;

  return {
    gid: s.gid as string,
    text: (s.text as string) ?? '',
    htmlText: (s.html_text as string) ?? '',
    createdAt: s.created_at as string,
    isPinned: (s.is_pinned as boolean) ?? false,
  };
}

/**
 * Add a plain text comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param text - Comment text
 * @returns Created comment
 */
export async function addTextComment(
  config: AsanaConfig,
  taskGid: string,
  text: string
): Promise<CreatedComment> {
  return addComment(config, { taskGid, text, isMarkdown: false });
}

/**
 * Add a Markdown comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param markdown - Markdown text
 * @returns Created comment
 */
export async function addMarkdownComment(
  config: AsanaConfig,
  taskGid: string,
  markdown: string
): Promise<CreatedComment> {
  return addComment(config, { taskGid, text: markdown, isMarkdown: true });
}

/**
 * Add a pinned comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param text - Comment text
 * @param isMarkdown - Whether text is Markdown
 * @returns Created comment
 */
export async function addPinnedComment(
  config: AsanaConfig,
  taskGid: string,
  text: string,
  isMarkdown: boolean = false
): Promise<CreatedComment> {
  return addComment(config, { taskGid, text, isMarkdown, isPinned: true });
}

/**
 * Add a GitHub PR link comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param prUrl - Pull request URL
 * @param prTitle - Pull request title
 * @param prNumber - Pull request number
 * @returns Created comment
 */
export async function addPRLinkComment(
  config: AsanaConfig,
  taskGid: string,
  prUrl: string,
  prTitle: string,
  prNumber: number
): Promise<CreatedComment> {
  const markdown = `**GitHub PR #${prNumber}**\n\n[${prTitle}](${prUrl})`;
  return addMarkdownComment(config, taskGid, markdown);
}

/**
 * Add a GitHub Issue link comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param issueUrl - Issue URL
 * @param issueTitle - Issue title
 * @param issueNumber - Issue number
 * @returns Created comment
 */
export async function addIssueLinkComment(
  config: AsanaConfig,
  taskGid: string,
  issueUrl: string,
  issueTitle: string,
  issueNumber: number
): Promise<CreatedComment> {
  const markdown = `**GitHub Issue #${issueNumber}**\n\n[${issueTitle}](${issueUrl})`;
  return addMarkdownComment(config, taskGid, markdown);
}

/**
 * Add a status update comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param status - Status message
 * @param details - Optional details
 * @returns Created comment
 */
export async function addStatusComment(
  config: AsanaConfig,
  taskGid: string,
  status: string,
  details?: string
): Promise<CreatedComment> {
  let text = `**Status Update:** ${status}`;
  if (details) {
    text += `\n\n${details}`;
  }
  return addMarkdownComment(config, taskGid, text);
}

/**
 * Add an automated workflow comment
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param action - Action performed
 * @param result - Result of action
 * @returns Created comment
 */
export async function addWorkflowComment(
  config: AsanaConfig,
  taskGid: string,
  action: string,
  result: 'success' | 'failure',
  details?: string
): Promise<CreatedComment> {
  const icon = result === 'success' ? '[OK]' : '[FAILED]';
  let text = `**Auto-Fix Workflow** ${icon}\n\n**Action:** ${action}`;
  if (details) {
    text += `\n\n${details}`;
  }
  return addMarkdownComment(config, taskGid, text);
}
