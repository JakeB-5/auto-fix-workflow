/**
 * @module analyzer/issue-generator/type-detector
 * @description Auto-detect issue type from task data
 */

import type { IssueType, IssueSource } from '../../common/types/index.js';

/**
 * Task data for type detection
 */
export interface TaskData {
  readonly source: IssueSource;
  readonly description: string;
  readonly errorMessage?: string | undefined;
  readonly stackTrace?: string | undefined;
  readonly title?: string | undefined;
}

/**
 * Detect issue type from task data
 *
 * @param task - Task data
 * @returns Detected issue type
 */
export function detectIssueType(task: TaskData): IssueType {
  // Sentry errors are always bugs
  if (task.source === 'sentry') {
    return 'bug';
  }

  const text = [
    task.title || '',
    task.description || '',
    task.errorMessage || '',
  ]
    .join(' ')
    .toLowerCase();

  // Error patterns indicate bugs
  if (
    task.errorMessage ||
    task.stackTrace ||
    /error|exception|fail|crash|bug|broken/i.test(text)
  ) {
    return 'bug';
  }

  // Feature patterns
  if (/feature|add|implement|create|new/i.test(text)) {
    return 'feature';
  }

  // Refactor patterns
  if (/refactor|restructure|reorganize|clean.*up/i.test(text)) {
    return 'refactor';
  }

  // Documentation patterns
  if (/document|doc|readme|comment|explanation/i.test(text)) {
    return 'docs';
  }

  // Test patterns
  if (/test|spec|testing|coverage/i.test(text)) {
    return 'test';
  }

  // Chore patterns
  if (/chore|config|setup|build|dependency|deps/i.test(text)) {
    return 'chore';
  }

  // Default to bug if unclear
  return 'bug';
}
