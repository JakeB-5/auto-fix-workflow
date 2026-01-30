/**
 * @module github/get-issue/related-issues
 * @description Extract related issue references from issue content
 */

import { extractIssueReferences } from './markdown-parser.js';

/**
 * Keywords that indicate issue closure relationships
 */
const CLOSING_KEYWORDS = [
  'close',
  'closes',
  'closed',
  'fix',
  'fixes',
  'fixed',
  'resolve',
  'resolves',
  'resolved',
] as const;

/**
 * Extract related issue numbers from issue body and comments
 *
 * Captures:
 * - Direct references: #123
 * - Closing references: closes #123, fixes #456
 * - List references: Fixes #1, #2, #3
 *
 * @param issueBody - Issue body markdown
 * @param commentBodies - Array of comment body markdown strings
 * @returns Sorted array of unique related issue numbers
 *
 * @example
 * ```typescript
 * const related = extractRelatedIssues(
 *   'This fixes #123 and relates to #456',
 *   ['See also #789']
 * );
 * // [123, 456, 789]
 * ```
 */
export function extractRelatedIssues(
  issueBody: string,
  commentBodies: readonly string[]
): readonly number[] {
  const relatedIssues = new Set<number>();

  // Extract from issue body
  for (const issue of extractFromText(issueBody)) {
    relatedIssues.add(issue);
  }

  // Extract from comments
  for (const commentBody of commentBodies) {
    for (const issue of extractFromText(commentBody)) {
      relatedIssues.add(issue);
    }
  }

  return Array.from(relatedIssues).sort((a, b) => a - b);
}

/**
 * Extract issue references from a single text
 *
 * @param text - Markdown text to parse
 * @returns Set of issue numbers
 */
function extractFromText(text: string): Set<number> {
  const issues = new Set<number>();

  // Extract direct references (#123)
  for (const issue of extractIssueReferences(text)) {
    issues.add(issue);
  }

  // Extract closing references (closes #123, fixes #456)
  for (const issue of extractClosingReferences(text)) {
    issues.add(issue);
  }

  return issues;
}

/**
 * Extract issue numbers from closing keyword patterns
 *
 * Patterns:
 * - closes #123
 * - fixes #456
 * - resolves #789, #790
 *
 * @param text - Text to parse
 * @returns Array of issue numbers
 */
export function extractClosingReferences(text: string): readonly number[] {
  const issues = new Set<number>();

  // Build regex pattern: (close|closes|closed|fix|fixes|...)
  const keywordPattern = CLOSING_KEYWORDS.join('|');
  const closingRegex = new RegExp(
    `\\b(${keywordPattern})\\s+#(\\d+)`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = closingRegex.exec(text)) !== null) {
    if (match[2] !== undefined) {
      const issueNumber = parseInt(match[2], 10);
      if (!isNaN(issueNumber)) {
        issues.add(issueNumber);
      }
    }
  }

  // Handle comma-separated lists: "Fixes #1, #2, #3"
  const listRegex = new RegExp(
    `\\b(${keywordPattern})\\s+#(\\d+)(?:\\s*,\\s*#(\\d+))*`,
    'gi'
  );

  while ((match = listRegex.exec(text)) !== null) {
    // Extract all numbers from the match
    const numberRegex = /#(\d+)/g;
    let numberMatch: RegExpExecArray | null;
    while ((numberMatch = numberRegex.exec(match[0])) !== null) {
      if (numberMatch[1] !== undefined) {
        const issueNumber = parseInt(numberMatch[1], 10);
        if (!isNaN(issueNumber)) {
          issues.add(issueNumber);
        }
      }
    }
  }

  return Array.from(issues).sort((a, b) => a - b);
}

/**
 * Check if text contains closing keywords for an issue
 *
 * @param text - Text to check
 * @param issueNumber - Issue number to check for
 * @returns True if text contains closing keywords for the issue
 *
 * @example
 * ```typescript
 * hasClosingKeyword('This fixes #123', 123); // true
 * hasClosingKeyword('See #123', 123); // false
 * ```
 */
export function hasClosingKeyword(text: string, issueNumber: number): boolean {
  const keywordPattern = CLOSING_KEYWORDS.join('|');
  const regex = new RegExp(
    `\\b(${keywordPattern})\\s+#${issueNumber}\\b`,
    'i'
  );
  return regex.test(text);
}
