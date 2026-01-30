/**
 * @module github/create-issue/labels
 * @description Label auto-generation logic for GitHub issues
 */

import type { Issue, IssueType, IssuePriority } from '../../common/types/index.js';

/**
 * Infer labels from issue information
 *
 * @param issue - Partial issue information
 * @returns Array of label strings
 */
export function inferLabels(issue: Partial<Issue>): string[] {
  const labels: string[] = [];

  // Add type-based label
  if (issue.type) {
    labels.push(getTypeLabel(issue.type));
  }

  // Add priority-based label
  if (issue.context?.priority) {
    labels.push(getPriorityLabel(issue.context.priority));
  }

  // Add source-based label
  if (issue.context?.source) {
    labels.push(`source:${issue.context.source}`);
  }

  // Add auto-fix label if suggested fix exists with high confidence
  if (issue.suggestedFix && issue.suggestedFix.confidence >= 0.7) {
    labels.push('auto-fix');
  }

  // Add component label if available
  if (issue.context?.component) {
    labels.push(`component:${issue.context.component}`);
  }

  // Deduplicate and sort
  return Array.from(new Set(labels)).sort();
}

/**
 * Get label for issue type
 */
function getTypeLabel(type: IssueType): string {
  const typeLabels: Record<IssueType, string> = {
    bug: 'type:bug',
    feature: 'type:feature',
    refactor: 'type:refactor',
    docs: 'type:docs',
    test: 'type:test',
    chore: 'type:chore',
  };

  return typeLabels[type];
}

/**
 * Get label for priority
 */
function getPriorityLabel(priority: IssuePriority): string {
  const priorityLabels: Record<IssuePriority, string> = {
    critical: 'priority:critical',
    high: 'priority:high',
    medium: 'priority:medium',
    low: 'priority:low',
  };

  return priorityLabels[priority];
}

/**
 * Merge inferred labels with user-provided labels
 *
 * @param inferredLabels - Labels inferred from issue data
 * @param userLabels - Labels explicitly provided by user
 * @returns Merged and deduplicated label array
 */
export function mergeLabels(
  inferredLabels: readonly string[],
  userLabels?: readonly string[]
): string[] {
  const allLabels = [...inferredLabels, ...(userLabels ?? [])];
  return Array.from(new Set(allLabels)).sort();
}

/**
 * Validate label format
 *
 * @param label - Label to validate
 * @returns True if label is valid
 */
export function isValidLabel(label: string): boolean {
  // GitHub labels cannot be empty and have a max length of 50 characters
  if (!label || label.length === 0 || label.length > 50) {
    return false;
  }

  // Labels should not contain only whitespace
  if (label.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Filter out invalid labels
 *
 * @param labels - Labels to filter
 * @returns Valid labels only
 */
export function filterValidLabels(labels: readonly string[]): string[] {
  return labels.filter(isValidLabel);
}
