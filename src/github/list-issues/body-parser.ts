/**
 * @module github/list-issues/body-parser
 * @description Issue body parsing utilities
 */

import type {
  Issue,
  IssueContext,
  IssueType,
  IssuePriority,
  IssueStatus,
  CodeAnalysis,
  SuggestedFix,
  AcceptanceCriteria,
} from '../../common/types/index.js';

/**
 * Parse issue body to extract structured information
 * This is a placeholder for the actual issue-parser from common module
 * Once common/issue-parser is implemented, this will use that instead
 *
 * @param body - Raw issue body markdown
 * @returns Parsed issue metadata
 */
export function parseIssueBody(body: string): {
  readonly type: IssueType;
  readonly priority: IssuePriority;
  readonly component: string;
  readonly relatedFiles: readonly string[];
  readonly relatedSymbols: readonly string[];
  readonly codeAnalysis?: CodeAnalysis;
  readonly suggestedFix?: SuggestedFix;
  readonly acceptanceCriteria: readonly AcceptanceCriteria[];
  readonly relatedIssues: readonly number[];
} {
  // Default values
  let type: IssueType = 'bug';
  let priority: IssuePriority = 'medium';
  let component = 'unknown';
  const relatedFiles: string[] = [];
  const relatedSymbols: string[] = [];
  const acceptanceCriteria: AcceptanceCriteria[] = [];
  const relatedIssues: number[] = [];
  let codeAnalysis: CodeAnalysis | undefined;
  let suggestedFix: SuggestedFix | undefined;

  // Extract type from labels or body
  if (body.includes('## Type') || body.includes('**Type:**')) {
    const typeMatch = body.match(/(?:##\s*Type|Type:)\s*([^\n]+)/i);
    if (typeMatch) {
      const typeStr = typeMatch[1]?.trim().toLowerCase();
      if (typeStr && ['bug', 'feature', 'refactor', 'docs', 'test', 'chore'].includes(typeStr)) {
        type = typeStr as IssueType;
      }
    }
  }

  // Extract priority
  if (body.includes('## Priority') || body.includes('**Priority:**')) {
    const priorityMatch = body.match(/(?:##\s*Priority|Priority:)\s*([^\n]+)/i);
    if (priorityMatch) {
      const priorityStr = priorityMatch[1]?.trim().toLowerCase();
      if (priorityStr && ['critical', 'high', 'medium', 'low'].includes(priorityStr)) {
        priority = priorityStr as IssuePriority;
      }
    }
  }

  // Extract component
  if (body.includes('## Component') || body.includes('**Component:**')) {
    const componentMatch = body.match(/(?:##\s*Component|Component:)\s*([^\n]+)/i);
    if (componentMatch) {
      component = componentMatch[1]?.trim() ?? 'unknown';
    }
  }

  // Extract related files
  const fileMatches = Array.from(body.matchAll(/`([^`]+\.(ts|js|tsx|jsx|py|go|java|rs))`/g));
  for (const match of fileMatches) {
    if (match[1]) {
      relatedFiles.push(match[1]);
    }
  }

  // Extract related issues
  const issueMatches = Array.from(body.matchAll(/#(\d+)/g));
  for (const match of issueMatches) {
    const issueNum = match[1];
    if (issueNum) {
      relatedIssues.push(parseInt(issueNum, 10));
    }
  }

  // Extract acceptance criteria
  const criteriaMatch = body.match(/##\s*Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|\n---|\n$)/i);
  if (criteriaMatch && criteriaMatch[1]) {
    const criteriaText = criteriaMatch[1];
    const criteriaItems = criteriaText.match(/[-*]\s*\[[ x]\]\s*([^\n]+)/g);
    if (criteriaItems) {
      for (const item of criteriaItems) {
        const completed = item.includes('[x]');
        const description = item.replace(/[-*]\s*\[[ x]\]\s*/, '').trim();
        acceptanceCriteria.push({ description, completed });
      }
    }
  }

  return {
    type,
    priority,
    component,
    relatedFiles,
    relatedSymbols,
    codeAnalysis,
    suggestedFix,
    acceptanceCriteria,
    relatedIssues,
  };
}

/**
 * Convert GitHub issue state to our IssueStatus
 *
 * @param state - GitHub issue state
 * @param labels - Issue labels
 * @returns Mapped issue status
 */
export function mapIssueState(
  state: 'open' | 'closed',
  labels: readonly string[]
): IssueStatus {
  if (state === 'closed') {
    return 'closed';
  }

  // Check for in-progress indicators
  const labelNames = labels.map((l) => l.toLowerCase());
  if (
    labelNames.includes('in progress') ||
    labelNames.includes('in-progress') ||
    labelNames.includes('wip')
  ) {
    return 'in_progress';
  }

  if (labelNames.includes('resolved')) {
    return 'resolved';
  }

  return 'open';
}
