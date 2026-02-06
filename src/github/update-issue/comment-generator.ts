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
 * Analysis result types for needs-info issues
 */
export type NeedsInfoAnalysisResult =
  | 'needs-more-info'
  | 'cannot-reproduce'
  | 'unclear-requirement'
  | 'needs-context';

/**
 * Confidence breakdown scores
 */
export interface ConfidenceBreakdown {
  readonly clarity: number;
  readonly technicalDetail: number;
  readonly scopeDefinition: number;
  readonly acceptanceCriteria: number;
}

/**
 * Options for generating needs-info comments
 */
export interface NeedsInfoCommentOptions {
  readonly analysisResult: NeedsInfoAnalysisResult;
  readonly suggestions: readonly string[];
  readonly confidenceLevel: string;
  readonly confidenceScore: number;
  readonly breakdown: ConfidenceBreakdown;
}

/**
 * Generate a needs-info comment for a GitHub issue
 *
 * Creates a structured comment requesting additional information
 * based on the analysis results and confidence breakdown.
 *
 * @param options - Analysis details for generating the comment
 * @returns Formatted markdown comment
 */
export function generateNeedsInfoComment(options: NeedsInfoCommentOptions): string {
  const { analysisResult, suggestions, confidenceLevel, confidenceScore, breakdown } = options;
  const sections: string[] = [];

  // Header
  sections.push('## Auto-Fix Analysis: Additional Information Needed\n');

  // Status summary
  const resultLabels: Record<NeedsInfoAnalysisResult, string> = {
    'needs-more-info': 'More information required',
    'cannot-reproduce': 'Cannot reproduce the issue',
    'unclear-requirement': 'Requirements are unclear',
    'needs-context': 'Additional context needed',
  };
  sections.push(`**Analysis Result:** ${resultLabels[analysisResult]}`);
  sections.push(`**Confidence:** ${confidenceLevel} (${confidenceScore}/100)\n`);

  // Breakdown table
  sections.push('### Confidence Breakdown\n');
  sections.push('| Category | Score | Status |');
  sections.push('|----------|-------|--------|');
  sections.push(`| Clarity | ${breakdown.clarity}/25 | ${getStatusIcon(breakdown.clarity, 25)} |`);
  sections.push(`| Technical Detail | ${breakdown.technicalDetail}/25 | ${getStatusIcon(breakdown.technicalDetail, 25)} |`);
  sections.push(`| Scope Definition | ${breakdown.scopeDefinition}/25 | ${getStatusIcon(breakdown.scopeDefinition, 25)} |`);
  sections.push(`| Acceptance Criteria | ${breakdown.acceptanceCriteria}/25 | ${getStatusIcon(breakdown.acceptanceCriteria, 25)} |\n`);

  // Suggestions as checklist
  if (suggestions.length > 0) {
    sections.push('### Action Items\n');
    sections.push('Please provide the following information:\n');
    for (const suggestion of suggestions) {
      sections.push(`- [ ] ${suggestion}`);
    }
    sections.push('');
  }

  // Footer
  sections.push('---');
  sections.push('> When the requested information has been provided, remove the `needs-info` label to trigger reprocessing.');

  return sections.join('\n');
}

/**
 * Get status icon based on score ratio
 */
function getStatusIcon(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.7) return 'OK';
  if (ratio >= 0.4) return 'Needs improvement';
  return 'Insufficient';
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
