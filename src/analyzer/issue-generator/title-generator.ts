/**
 * @module analyzer/issue-generator/title-generator
 * @description Generate GitHub Issue titles
 */

import type { IssueType, IssueSource } from '../../common/types/index.js';

/**
 * Title generation data
 */
export interface TitleData {
  readonly type: IssueType;
  readonly source: IssueSource;
  readonly taskTitle?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly fileName?: string | undefined;
  readonly component?: string | undefined;
}

/**
 * Maximum title length (GitHub limit)
 */
const MAX_TITLE_LENGTH = 256;

/**
 * Truncate string to max length with ellipsis
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Extract error type from error message
 *
 * @param errorMessage - Full error message
 * @returns Error type (e.g., "TypeError")
 */
function extractErrorType(errorMessage: string): string {
  const match = errorMessage.match(/^(\w+Error):/);
  return (match && match[1]) ? match[1] : 'Error';
}

/**
 * Extract file name from path
 *
 * @param filePath - Full file path
 * @returns File name with extension
 */
function extractFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/**
 * Generate title for Sentry error
 *
 * @param data - Title data
 * @returns Generated title
 */
function generateSentryTitle(data: TitleData): string {
  const parts: string[] = ['[Sentry]'];

  if (data.errorMessage) {
    const errorType = extractErrorType(data.errorMessage);
    parts.push(errorType);
  }

  if (data.fileName) {
    const fileName = extractFileName(data.fileName);
    parts.push(`in ${fileName}`);
  } else if (data.component) {
    parts.push(`in ${data.component}`);
  }

  // Add brief error message if available
  if (data.errorMessage) {
    const firstLine = data.errorMessage.split('\n')[0];
    const briefMessage = (firstLine ?? '')
      .replace(/^(\w+Error):\s*/, '')
      .trim();
    if (briefMessage && parts.join(' ').length + briefMessage.length < MAX_TITLE_LENGTH) {
      parts.push('-');
      parts.push(briefMessage);
    }
  }

  return truncate(parts.join(' '), MAX_TITLE_LENGTH);
}

/**
 * Generate title for Asana task
 *
 * @param data - Title data
 * @returns Generated title
 */
function generateAsanaTitle(data: TitleData): string {
  const parts: string[] = ['[Asana]'];

  if (data.taskTitle) {
    parts.push(data.taskTitle);
  } else if (data.errorMessage) {
    const briefMessage = (data.errorMessage.split('\n')[0] ?? '').trim();
    parts.push(briefMessage);
  } else {
    parts.push('Task from Asana');
  }

  return truncate(parts.join(' '), MAX_TITLE_LENGTH);
}

/**
 * Generate title for manual/GitHub issue
 *
 * @param data - Title data
 * @returns Generated title
 */
function generateManualTitle(data: TitleData): string {
  if (data.taskTitle) {
    return truncate(data.taskTitle, MAX_TITLE_LENGTH);
  }

  const typePrefix: Record<IssueType, string> = {
    bug: 'fix:',
    feature: 'feat:',
    refactor: 'refactor:',
    docs: 'docs:',
    test: 'test:',
    chore: 'chore:',
  };

  const prefix = typePrefix[data.type] || 'fix:';

  if (data.errorMessage) {
    const briefMessage = (data.errorMessage.split('\n')[0] ?? '').trim();
    return truncate(`${prefix} ${briefMessage}`, MAX_TITLE_LENGTH);
  }

  if (data.component) {
    return truncate(`${prefix} ${data.component} issue`, MAX_TITLE_LENGTH);
  }

  return truncate(`${prefix} auto-generated issue`, MAX_TITLE_LENGTH);
}

/**
 * Generate GitHub Issue title
 *
 * @param data - Title generation data
 * @returns Generated title
 */
export function generateTitle(data: TitleData): string {
  switch (data.source) {
    case 'sentry':
      return generateSentryTitle(data);
    case 'asana':
      return generateAsanaTitle(data);
    case 'github':
    case 'manual':
    default:
      return generateManualTitle(data);
  }
}
