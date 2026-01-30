/**
 * @module github/create-issue/template
 * @description Issue template generation utilities
 */

import type { Issue, CodeAnalysis, SuggestedFix, AcceptanceCriteria } from '../../common/types/index.js';

/**
 * Generate issue body from partial issue data
 *
 * @param issue - Partial issue information
 * @returns Formatted Markdown body
 */
export function generateIssueBody(issue: Partial<Issue>): string {
  const sections: string[] = [];

  // Description section
  if (issue.body) {
    sections.push(issue.body);
  }

  // Context section
  if (issue.context) {
    sections.push('## Context');
    sections.push(`- **Component**: ${issue.context.component}`);
    sections.push(`- **Priority**: ${issue.context.priority}`);
    sections.push(`- **Source**: ${issue.context.source}`);

    if (issue.context.sourceUrl) {
      sections.push(`- **Source URL**: ${issue.context.sourceUrl}`);
    }

    if (issue.context.relatedFiles.length > 0) {
      sections.push('\n**Related Files**:');
      for (const file of issue.context.relatedFiles) {
        sections.push(`- \`${file}\``);
      }
    }

    if (issue.context.relatedSymbols.length > 0) {
      sections.push('\n**Related Symbols**:');
      for (const symbol of issue.context.relatedSymbols) {
        sections.push(`- \`${symbol}\``);
      }
    }
  }

  // Code analysis section
  if (issue.codeAnalysis) {
    sections.push('\n## Code Analysis');
    sections.push(formatCodeAnalysis(issue.codeAnalysis));
  }

  // Suggested fix section
  if (issue.suggestedFix) {
    sections.push('\n## Suggested Fix');
    sections.push(formatSuggestedFix(issue.suggestedFix));
  }

  // Acceptance criteria section
  if (issue.acceptanceCriteria && issue.acceptanceCriteria.length > 0) {
    sections.push('\n## Acceptance Criteria');
    sections.push(formatAcceptanceCriteria(issue.acceptanceCriteria));
  }

  // Related issues section
  if (issue.relatedIssues && issue.relatedIssues.length > 0) {
    sections.push('\n## Related Issues');
    for (const relatedIssue of issue.relatedIssues) {
      sections.push(`- #${relatedIssue}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Format code analysis information
 */
function formatCodeAnalysis(analysis: CodeAnalysis): string {
  const parts: string[] = [];

  parts.push(`**File**: \`${analysis.filePath}\``);

  if (analysis.startLine !== undefined && analysis.endLine !== undefined) {
    parts.push(`**Lines**: ${analysis.startLine}-${analysis.endLine}`);
  }

  if (analysis.functionName) {
    parts.push(`**Function**: \`${analysis.functionName}\``);
  }

  if (analysis.className) {
    parts.push(`**Class**: \`${analysis.className}\``);
  }

  if (analysis.snippet) {
    parts.push('\n**Code Snippet**:');
    parts.push('```typescript');
    parts.push(analysis.snippet);
    parts.push('```');
  }

  return parts.join('\n');
}

/**
 * Format suggested fix information
 */
function formatSuggestedFix(fix: SuggestedFix): string {
  const parts: string[] = [];

  parts.push(fix.description);
  parts.push(`\n**Confidence**: ${(fix.confidence * 100).toFixed(0)}%`);

  if (fix.steps.length > 0) {
    parts.push('\n**Steps**:');
    for (let i = 0; i < fix.steps.length; i++) {
      parts.push(`${i + 1}. ${fix.steps[i]}`);
    }
  }

  return parts.join('\n');
}

/**
 * Format acceptance criteria as a checklist
 */
function formatAcceptanceCriteria(criteria: readonly AcceptanceCriteria[]): string {
  const lines: string[] = [];

  for (const criterion of criteria) {
    const checkbox = criterion.completed ? '[x]' : '[ ]';
    lines.push(`- ${checkbox} ${criterion.description}`);
  }

  return lines.join('\n');
}

/**
 * Generate issue title from partial issue data
 *
 * @param issue - Partial issue information
 * @returns Formatted title
 */
export function generateIssueTitle(issue: Partial<Issue>): string {
  if (issue.title) {
    return issue.title;
  }

  // Fallback: generate from type and component
  const prefix = issue.type ? `[${issue.type.toUpperCase()}]` : '';
  const component = issue.context?.component ?? 'unknown';

  return `${prefix} Issue in ${component}`.trim();
}
