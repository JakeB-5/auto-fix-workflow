/**
 * @module workflow/code-fix-strategy/forbidden-patterns
 * @description Detect forbidden patterns in code changes
 */

import type { FileChange, ForbiddenPatternMatch } from './types.js';
import { FORBIDDEN_PATTERNS } from './constants.js';

/**
 * Detect forbidden patterns in file changes
 *
 * @param changes - File changes to check
 * @param customPatterns - Additional custom patterns to check
 * @returns Array of forbidden pattern matches
 */
export function detectForbiddenPatterns(
  changes: readonly FileChange[],
  customPatterns: readonly string[] = []
): readonly ForbiddenPatternMatch[] {
  const patterns = [...FORBIDDEN_PATTERNS, ...customPatterns];
  const matches: ForbiddenPatternMatch[] = [];

  for (const change of changes) {
    // Skip deleted files
    if (change.type === 'deleted' || !change.content) {
      continue;
    }

    const lines = change.content.split('\n');

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const match = regex.exec(line);

        if (match) {
          matches.push({
            pattern,
            filePath: change.path,
            lineNumber: i + 1,
            content: line.trim(),
          });

          // Reset regex for next search
          regex.lastIndex = 0;
        }
      }
    }
  }

  return matches;
}

/**
 * Check if any forbidden patterns exist in changes
 *
 * @param changes - File changes to check
 * @param customPatterns - Additional custom patterns
 * @returns True if forbidden patterns detected
 */
export function hasForbiddenPatterns(
  changes: readonly FileChange[],
  customPatterns: readonly string[] = []
): boolean {
  return detectForbiddenPatterns(changes, customPatterns).length > 0;
}

/**
 * Format forbidden pattern matches for display
 *
 * @param matches - Pattern matches
 * @returns Formatted string
 */
export function formatForbiddenPatterns(
  matches: readonly ForbiddenPatternMatch[]
): string {
  if (matches.length === 0) {
    return 'No forbidden patterns detected.';
  }

  const lines = [
    `Found ${matches.length} forbidden pattern(s):`,
    '',
  ];

  for (const match of matches) {
    lines.push(
      `  - ${match.filePath}:${match.lineNumber}`,
      `    Pattern: ${match.pattern}`,
      `    Content: ${match.content}`,
      ''
    );
  }

  return lines.join('\n');
}
