/**
 * @module asana/get-task/attachments
 * @description Attachment processing for Asana tasks
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';

/** Attachment resource type */
export type AttachmentResourceType = 'asana' | 'external' | 'gdrive' | 'dropbox' | 'onedrive' | 'box';

/** Attachment info from Asana */
export interface TaskAttachment {
  readonly gid: string;
  readonly name: string;
  readonly resourceType: AttachmentResourceType;
  readonly createdAt: string;
  readonly downloadUrl: string | null;
  readonly permanentUrl: string | null;
  readonly viewUrl: string | null;
  readonly host: string | null;
  readonly size: number | null;
}

/** Attachment summary for task */
export interface AttachmentSummary {
  readonly total: number;
  readonly byType: Record<AttachmentResourceType, number>;
  readonly attachments: readonly TaskAttachment[];
}

/** Fields to request from Asana API */
const ATTACHMENT_OPT_FIELDS = [
  'gid',
  'name',
  'resource_type',
  'created_at',
  'download_url',
  'permanent_url',
  'view_url',
  'host',
  'size',
].join(',');

/**
 * Get attachments for a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Array of attachments
 */
export async function getTaskAttachments(
  config: AsanaConfig,
  taskGid: string
): Promise<TaskAttachment[]> {
  const client = getAsanaClient(config);

  const response = await client.attachments.getAttachmentsForTask(taskGid, {
    opt_fields: ATTACHMENT_OPT_FIELDS,
  });

  const attachments: TaskAttachment[] = [];

  if (Array.isArray(response.data)) {
    for (const attachment of response.data) {
      const a = attachment as unknown as Record<string, unknown>;
      attachments.push({
        gid: a.gid as string,
        name: a.name as string,
        resourceType: mapResourceType(a.resource_type as string),
        createdAt: a.created_at as string,
        downloadUrl: (a.download_url as string) ?? null,
        permanentUrl: (a.permanent_url as string) ?? null,
        viewUrl: (a.view_url as string) ?? null,
        host: (a.host as string) ?? null,
        size: (a.size as number) ?? null,
      });
    }
  }

  return attachments;
}

/**
 * Get attachment summary for a task
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Attachment summary
 */
export async function getAttachmentSummary(
  config: AsanaConfig,
  taskGid: string
): Promise<AttachmentSummary> {
  const attachments = await getTaskAttachments(config, taskGid);

  const byType: Record<AttachmentResourceType, number> = {
    asana: 0,
    external: 0,
    gdrive: 0,
    dropbox: 0,
    onedrive: 0,
    box: 0,
  };

  for (const attachment of attachments) {
    byType[attachment.resourceType]++;
  }

  return {
    total: attachments.length,
    byType,
    attachments,
  };
}

/**
 * Map Asana resource type to our type
 */
function mapResourceType(type: string): AttachmentResourceType {
  switch (type?.toLowerCase()) {
    case 'asana':
      return 'asana';
    case 'gdrive':
    case 'google_drive':
      return 'gdrive';
    case 'dropbox':
      return 'dropbox';
    case 'onedrive':
      return 'onedrive';
    case 'box':
      return 'box';
    default:
      return 'external';
  }
}

/**
 * Format attachments as Markdown
 *
 * @param attachments - Attachments to format
 * @returns Markdown list
 */
export function formatAttachmentsAsMarkdown(
  attachments: readonly TaskAttachment[]
): string {
  if (attachments.length === 0) {
    return '_No attachments_';
  }

  const lines: string[] = [];

  for (const attachment of attachments) {
    const url = attachment.viewUrl || attachment.permanentUrl || attachment.downloadUrl;
    const size = attachment.size ? ` (${formatFileSize(attachment.size)})` : '';
    const type = attachment.resourceType !== 'asana' ? ` [${attachment.resourceType}]` : '';

    if (url) {
      lines.push(`- [${attachment.name}](${url})${size}${type}`);
    } else {
      lines.push(`- ${attachment.name}${size}${type}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Check if attachment is an image
 *
 * @param attachment - Attachment to check
 * @returns True if image
 */
export function isImageAttachment(attachment: TaskAttachment): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const name = attachment.name.toLowerCase();
  return imageExtensions.some((ext) => name.endsWith(ext));
}

/**
 * Get image attachments only
 *
 * @param attachments - All attachments
 * @returns Image attachments
 */
export function getImageAttachments(
  attachments: readonly TaskAttachment[]
): TaskAttachment[] {
  return attachments.filter(isImageAttachment);
}

/**
 * Get download URLs for all attachments
 *
 * @param attachments - Attachments
 * @returns Array of download URLs (excluding nulls)
 */
export function getDownloadUrls(
  attachments: readonly TaskAttachment[]
): string[] {
  return attachments
    .map((a) => a.downloadUrl)
    .filter((url): url is string => url !== null);
}
