/**
 * @module workflow/code-fix-strategy/commit-message
 * @description Generate conventional commit messages
 */

import type { Issue } from '../../common/types/index.js';
import type { FileChange } from './types.js';

/**
 * Conventional commit types
 */
export type CommitType =
  | 'fix'
  | 'feat'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'chore'
  | 'style'
  | 'perf';

/**
 * Generate conventional commit message
 *
 * @param issues - Issues being fixed
 * @param changes - File changes
 * @returns Formatted commit message
 */
export function generateCommitMessage(
  issues: readonly Issue[],
  changes: readonly FileChange[]
): string {
  const type = determineCommitType(issues);
  const scope = determineScope(changes);
  const subject = generateSubject(issues);
  const body = generateBody(issues, changes);
  const footer = generateFooter(issues);

  const scopePart = scope ? `(${scope})` : '';
  const header = `${type}${scopePart}: ${subject}`;

  const parts = [header];

  if (body) {
    parts.push('', body);
  }

  if (footer) {
    parts.push('', footer);
  }

  return parts.join('\n');
}

/**
 * Determine commit type based on issues
 *
 * @param issues - Issues being fixed
 * @returns Commit type
 */
function determineCommitType(
  issues: readonly Issue[]
): CommitType {
  if (issues.length === 0) {
    return 'chore';
  }

  // Use the most common issue type
  const typeCounts = new Map<string, number>();

  for (const issue of issues) {
    const count = typeCounts.get(issue.type) || 0;
    typeCounts.set(issue.type, count + 1);
  }

  let maxCount = 0;
  let maxType: string = 'chore';

  for (const [type, count] of typeCounts) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  }

  // Map issue type to commit type
  const typeMap: Record<string, CommitType> = {
    bug: 'fix',
    feature: 'feat',
    refactor: 'refactor',
    docs: 'docs',
    test: 'test',
    chore: 'chore',
  };

  return typeMap[maxType] || 'fix';
}

/**
 * Determine scope from file changes
 *
 * @param changes - File changes
 * @returns Scope string or null
 */
function determineScope(
  changes: readonly FileChange[]
): string | null {
  if (changes.length === 0) {
    return null;
  }

  // Extract component from file paths
  const components = new Set<string>();

  for (const change of changes) {
    const parts = change.path.split(/[/\\]/);

    // Look for common component indicators
    for (let i = 0; i < parts.length - 1; i++) {
      if (
        parts[i] === 'components' ||
        parts[i] === 'modules' ||
        parts[i] === 'features'
      ) {
        const component = parts[i + 1];
        if (component) {
          components.add(component);
        }
      }
    }
  }

  if (components.size === 1) {
    const component = Array.from(components)[0];
    return component ?? null;
  }

  if (components.size > 1) {
    return 'multiple';
  }

  // Fallback to first directory
  const firstPath = changes[0]?.path;
  if (!firstPath) {
    return null;
  }
  const firstDir = firstPath.split(/[/\\]/)[0];
  return firstDir ?? null;
}

/**
 * Generate commit subject line
 *
 * @param issues - Issues being fixed
 * @returns Subject line (max 72 chars)
 */
function generateSubject(
  issues: readonly Issue[]
): string {
  if (issues.length === 0) {
    return 'automated fix';
  }

  if (issues.length === 1) {
    const title = issues[0]?.title ?? 'automated fix';
    // Remove issue number prefix if present
    const clean = title.replace(/^#\d+\s*[-:]\s*/, '');
    return truncate(clean, 72);
  }

  // Multiple issues
  const firstIssue = issues[0]?.title.replace(/^#\d+\s*[-:]\s*/, '') ?? 'fixes';
  return truncate(`${firstIssue} and ${issues.length - 1} more`, 72);
}

/**
 * Generate commit body
 *
 * @param issues - Issues being fixed
 * @param changes - File changes
 * @returns Body text or null
 */
function generateBody(
  issues: readonly Issue[],
  changes: readonly FileChange[]
): string | null {
  const lines: string[] = [];

  // Summarize changes
  const added = changes.filter((c) => c.type === 'added').length;
  const modified = changes.filter((c) => c.type === 'modified').length;
  const deleted = changes.filter((c) => c.type === 'deleted').length;

  const changeSummary: string[] = [];
  if (added > 0) changeSummary.push(`${added} added`);
  if (modified > 0) changeSummary.push(`${modified} modified`);
  if (deleted > 0) changeSummary.push(`${deleted} deleted`);

  if (changeSummary.length > 0) {
    lines.push(`Changes: ${changeSummary.join(', ')}`);
  }

  // Add issue details if multiple issues
  if (issues.length > 1) {
    lines.push('');
    lines.push('Fixed issues:');
    for (const issue of issues) {
      const title = issue?.title ?? 'Unknown';
      lines.push(`- #${issue.number}: ${title}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Generate commit footer
 *
 * @param issues - Issues being fixed
 * @returns Footer text
 */
function generateFooter(
  issues: readonly Issue[]
): string {
  const issueNumbers = issues.map((i) => i.number);

  if (issueNumbers.length === 0) {
    return '';
  }

  const refs = issueNumbers.map((n) => `#${n}`).join(', ');
  return `Fixes ${refs}`;
}

/**
 * Truncate string to maximum length
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Validate commit message format
 *
 * @param message - Commit message to validate
 * @returns True if valid
 */
export function validateCommitMessage(message: string): boolean {
  const lines = message.split('\n');

  if (lines.length === 0) {
    return false;
  }

  const header = lines[0];

  // Check header format: type(scope)?: subject
  const headerRegex = /^(fix|feat|refactor|docs|test|chore|style|perf)(\(.+\))?: .{1,72}$/;
  return headerRegex.test(header);
}
