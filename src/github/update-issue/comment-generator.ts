/**
 * @module github/update-issue/comment-generator
 * @description Generate progress comments for GitHub issues
 */

/**
 * Generate a progress comment for an issue
 *
 * @param status - Current status message
 * @param details - Optional details object to include
 * @returns Formatted markdown comment
 *
 * @example
 * ```typescript
 * const comment = generateProgressComment('Analysis complete', {
 *   filesAnalyzed: 5,
 *   issuesFound: 2
 * });
 * ```
 */
export function generateProgressComment(
  status: string,
  details?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const sections: string[] = [];

  // Add status header
  sections.push(`## 🤖 Auto-Fix Workflow Update\n`);
  sections.push(`**Status:** ${status}\n`);
  sections.push(`**Time:** ${timestamp}\n`);

  // Add details if provided
  if (details && Object.keys(details).length > 0) {
    sections.push(`\n### Details\n`);
    for (const [key, value] of Object.entries(details)) {
      sections.push(`- **${formatKey(key)}:** ${formatValue(value)}`);
    }
  }

  return sections.join('\n');
}

/**
 * Format a camelCase or snake_case key to Title Case
 */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? 'None' : value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}
