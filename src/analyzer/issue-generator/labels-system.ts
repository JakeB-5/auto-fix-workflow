/**
 * @module analyzer/issue-generator/labels-system
 * @description Label auto-setting and normalization system
 */

import type { IssueType, IssueSource, IssuePriority } from '../../common/types/index.js';
import type { CodeLocation } from '../code-locator/types.js';

/**
 * Maximum label length (GitHub limit)
 */
const MAX_LABEL_LENGTH = 50;

/**
 * Normalize component name to label format
 *
 * @param component - Component name
 * @returns Normalized label (e.g., "component:canvas-core")
 */
export function normalizeComponentLabel(component: string): string {
  // Convert to kebab-case and remove special characters
  const normalized = component
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-/]/g, '')
    .replace(/\/+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const label = `component:${normalized}`;

  // Truncate if too long
  return label.length > MAX_LABEL_LENGTH
    ? label.substring(0, MAX_LABEL_LENGTH)
    : label;
}

/**
 * Get priority label
 *
 * @param priority - Issue priority
 * @returns Priority label
 */
export function getPriorityLabel(priority: IssuePriority): string {
  return `priority:${priority}`;
}

/**
 * Get source label
 *
 * @param source - Issue source
 * @returns Source label
 */
export function getSourceLabel(source: IssueSource): string {
  return source === 'github' ? 'manual' : source;
}

/**
 * Get type label
 *
 * @param type - Issue type
 * @returns Type label
 */
export function getTypeLabel(type: IssueType): string {
  return type;
}

/**
 * Extract component from code locations
 *
 * @param locations - Code locations
 * @returns Component name or undefined
 */
function extractComponentFromLocations(
  locations?: readonly CodeLocation[]
): string | undefined {
  if (!locations || locations.length === 0) {
    return undefined;
  }

  const firstLocation = locations[0];
  if (!firstLocation) {
    return undefined;
  }
  const filePath = firstLocation.filePath;
  const parts = filePath.split(/[/\\]/);

  // Find component directory (usually after src/)
  const srcIndex = parts.findIndex((p) => p === 'src');
  if (srcIndex !== -1 && srcIndex + 1 < parts.length) {
    // Use first two directories after src if available
    if (srcIndex + 2 < parts.length) {
      return `${parts[srcIndex + 1]}/${parts[srcIndex + 2]}`;
    }
    return parts[srcIndex + 1];
  }

  // Fallback: use first directory
  return parts.length > 1 ? parts[0] : undefined;
}

/**
 * Infer labels from task data
 *
 * @param data - Task data for label inference
 * @returns Array of labels
 */
export function inferLabels(data: {
  readonly type: IssueType;
  readonly source: IssueSource;
  readonly priority?: IssuePriority | undefined;
  readonly component?: string | undefined;
  readonly locations?: readonly CodeLocation[] | undefined;
  readonly customLabels?: readonly string[] | undefined;
}): string[] {
  const labels: string[] = [];

  // Always include auto-fix label
  labels.push('auto-fix');

  // Add source label
  labels.push(getSourceLabel(data.source));

  // Add type label
  labels.push(getTypeLabel(data.type));

  // Add priority label if available
  if (data.priority) {
    labels.push(getPriorityLabel(data.priority));
  }

  // Add component label
  const component =
    data.component || extractComponentFromLocations(data.locations);
  if (component) {
    labels.push(normalizeComponentLabel(component));
  }

  // Add custom labels
  if (data.customLabels) {
    labels.push(...data.customLabels);
  }

  // Remove duplicates and validate
  return Array.from(new Set(labels))
    .filter((label) => label.length > 0 && label.length <= MAX_LABEL_LENGTH)
    .sort(); // Sort for consistency
}

/**
 * Validate label
 *
 * @param label - Label to validate
 * @returns True if valid
 */
export function validateLabel(label: string): boolean {
  if (!label || label.length === 0 || label.length > MAX_LABEL_LENGTH) {
    return false;
  }

  // GitHub label requirements
  // - Cannot be empty
  // - Cannot exceed 50 characters
  // - Can contain alphanumeric, hyphen, underscore, colon
  return /^[a-z0-9:_-]+$/i.test(label);
}

/**
 * Sanitize label name
 *
 * @param label - Label to sanitize
 * @returns Sanitized label
 */
export function sanitizeLabel(label: string): string {
  return label
    .replace(/[^a-z0-9:_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, MAX_LABEL_LENGTH);
}
