/**
 * @module asana/analyze-task/messages
 * @description Failure reason message generation
 */

import type { ConfidenceScore, ConfidenceLevel } from './confidence.js';
import type { HeuristicResult } from './heuristics.js';

/** Failure reason */
export interface FailureReason {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly suggestion?: string;
}

/** Analysis message */
export interface AnalysisMessage {
  readonly type: 'success' | 'warning' | 'error';
  readonly title: string;
  readonly details: readonly string[];
  readonly suggestions: readonly string[];
}

/**
 * Generate failure reasons from analysis
 *
 * @param heuristics - Heuristic analysis result
 * @param confidence - Confidence score
 * @returns Array of failure reasons
 */
export function generateFailureReasons(
  heuristics: HeuristicResult,
  confidence: ConfidenceScore
): FailureReason[] {
  const reasons: FailureReason[] = [];

  // Check confidence level
  if (confidence.level === 'very_low') {
    reasons.push({
      code: 'VERY_LOW_CONFIDENCE',
      message: 'Task definition is too vague for automated processing',
      severity: 'error',
      suggestion: confidence.suggestions[0],
    });
  } else if (confidence.level === 'low') {
    reasons.push({
      code: 'LOW_CONFIDENCE',
      message: 'Task may need additional clarification',
      severity: 'warning',
      suggestion: confidence.suggestions[0],
    });
  }

  // Check classification
  if (heuristics.classification === 'unknown') {
    reasons.push({
      code: 'UNKNOWN_CLASSIFICATION',
      message: 'Could not determine task type (bug, feature, etc.)',
      severity: 'warning',
      suggestion: 'Add keywords like "fix", "add", or "refactor" to clarify intent',
    });
  }

  // Check complexity
  if (heuristics.estimatedComplexity === 'high') {
    reasons.push({
      code: 'HIGH_COMPLEXITY',
      message: 'Task appears too complex for single auto-fix',
      severity: 'warning',
      suggestion: 'Consider breaking into smaller, more focused tasks',
    });
  }

  // Check acceptance criteria
  if (!heuristics.hasClearAcceptanceCriteria) {
    reasons.push({
      code: 'NO_ACCEPTANCE_CRITERIA',
      message: 'No clear acceptance criteria defined',
      severity: 'warning',
      suggestion: 'Add a checklist of requirements or expected outcomes',
    });
  }

  // Check breakdown scores
  if (confidence.breakdown.clarity < 10) {
    reasons.push({
      code: 'POOR_CLARITY',
      message: 'Task description lacks clarity',
      severity: 'error',
      suggestion: 'Add more context and use structured formatting',
    });
  }

  if (confidence.breakdown.technicalDetail < 10) {
    reasons.push({
      code: 'POOR_TECHNICAL_DETAIL',
      message: 'Insufficient technical details',
      severity: 'warning',
      suggestion: 'Include file paths, function names, or code snippets',
    });
  }

  if (confidence.breakdown.scopeDefinition < 10) {
    reasons.push({
      code: 'POOR_SCOPE',
      message: 'Task scope is not well-defined',
      severity: 'warning',
      suggestion: 'Clarify the boundaries and specific deliverables',
    });
  }

  return reasons;
}

/**
 * Generate summary message for analysis
 *
 * @param heuristics - Heuristic analysis result
 * @param confidence - Confidence score
 * @param reasons - Failure reasons
 * @returns Analysis message
 */
export function generateSummaryMessage(
  heuristics: HeuristicResult,
  confidence: ConfidenceScore,
  reasons: readonly FailureReason[]
): AnalysisMessage {
  const errors = reasons.filter((r) => r.severity === 'error');
  const warnings = reasons.filter((r) => r.severity === 'warning');

  // Determine overall type
  let type: 'success' | 'warning' | 'error';
  let title: string;

  if (errors.length > 0) {
    type = 'error';
    title = 'Task not ready for automated processing';
  } else if (warnings.length > 0) {
    type = 'warning';
    title = 'Task may need review before processing';
  } else {
    type = 'success';
    title = 'Task is ready for automated processing';
  }

  // Build details
  const details: string[] = [
    `Classification: ${heuristics.classification}`,
    `Complexity: ${heuristics.estimatedComplexity}`,
    `Confidence: ${confidence.level} (${confidence.overall}/100)`,
  ];

  // Add breakdown scores
  details.push('');
  details.push('Score breakdown:');
  details.push(`  - Clarity: ${confidence.breakdown.clarity}/25`);
  details.push(`  - Technical detail: ${confidence.breakdown.technicalDetail}/25`);
  details.push(`  - Scope definition: ${confidence.breakdown.scopeDefinition}/25`);
  details.push(`  - Acceptance criteria: ${confidence.breakdown.acceptanceCriteria}/25`);

  // Collect suggestions
  const suggestions = [
    ...reasons.filter((r) => r.suggestion).map((r) => r.suggestion!),
    ...confidence.suggestions,
  ];

  // Deduplicate suggestions
  const uniqueSuggestions = [...new Set(suggestions)];

  return {
    type,
    title,
    details,
    suggestions: uniqueSuggestions,
  };
}

/**
 * Format analysis message as Markdown
 *
 * @param message - Analysis message
 * @returns Markdown string
 */
export function formatMessageAsMarkdown(message: AnalysisMessage): string {
  const lines: string[] = [];

  // Header with icon
  const icons = {
    success: '[OK]',
    warning: '[WARNING]',
    error: '[ERROR]',
  };

  lines.push(`## ${icons[message.type]} ${message.title}`);
  lines.push('');

  // Details
  for (const detail of message.details) {
    if (detail === '') {
      lines.push('');
    } else if (detail.startsWith('  ')) {
      lines.push(detail);
    } else {
      lines.push(`- ${detail}`);
    }
  }
  lines.push('');

  // Suggestions
  if (message.suggestions.length > 0) {
    lines.push('### Suggestions');
    lines.push('');
    for (const suggestion of message.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get recommendation based on confidence level
 *
 * @param level - Confidence level
 * @returns Recommendation text
 */
export function getRecommendation(level: ConfidenceLevel): string {
  const recommendations: Record<ConfidenceLevel, string> = {
    very_high: 'Proceed with automated processing',
    high: 'Automated processing recommended with quick review',
    medium: 'Review recommended before automated processing',
    low: 'Manual review required before processing',
    very_low: 'Task needs significant work before processing',
  };
  return recommendations[level];
}

/**
 * Generate notification for Asana comment
 *
 * @param message - Analysis message
 * @param recommendation - Action recommendation
 * @returns Comment text
 */
export function generateAsanaNotification(
  message: AnalysisMessage,
  recommendation: string
): string {
  const lines: string[] = [];

  lines.push(`**Auto-Fix Analysis**`);
  lines.push('');
  lines.push(`**Status:** ${message.title}`);
  lines.push(`**Recommendation:** ${recommendation}`);
  lines.push('');

  if (message.suggestions.length > 0) {
    lines.push('**To improve this task:**');
    for (const suggestion of message.suggestions.slice(0, 3)) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate detailed report
 *
 * @param heuristics - Heuristic result
 * @param confidence - Confidence score
 * @param reasons - Failure reasons
 * @returns Detailed report markdown
 */
export function generateDetailedReport(
  heuristics: HeuristicResult,
  confidence: ConfidenceScore,
  reasons: readonly FailureReason[]
): string {
  const lines: string[] = [];

  lines.push('# Task Analysis Report');
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Classification | ${heuristics.classification} |`);
  lines.push(`| Complexity | ${heuristics.estimatedComplexity} |`);
  lines.push(`| Confidence | ${confidence.level} (${confidence.overall}/100) |`);
  lines.push(`| Requires Code Change | ${heuristics.requiresCodeChange ? 'Yes' : 'No'} |`);
  lines.push(`| Has Testing Requirement | ${heuristics.hasTestingRequirement ? 'Yes' : 'No'} |`);
  lines.push('');

  // Confidence breakdown
  lines.push('## Confidence Breakdown');
  lines.push('');
  lines.push(`| Category | Score |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Clarity | ${confidence.breakdown.clarity}/25 |`);
  lines.push(`| Technical Detail | ${confidence.breakdown.technicalDetail}/25 |`);
  lines.push(`| Scope Definition | ${confidence.breakdown.scopeDefinition}/25 |`);
  lines.push(`| Acceptance Criteria | ${confidence.breakdown.acceptanceCriteria}/25 |`);
  lines.push('');

  // Issues
  if (reasons.length > 0) {
    lines.push('## Issues Found');
    lines.push('');
    for (const reason of reasons) {
      const severity = reason.severity.toUpperCase();
      lines.push(`### [${severity}] ${reason.code}`);
      lines.push('');
      lines.push(reason.message);
      if (reason.suggestion) {
        lines.push('');
        lines.push(`**Suggestion:** ${reason.suggestion}`);
      }
      lines.push('');
    }
  }

  // Positive factors
  if (confidence.positiveFactors.length > 0) {
    lines.push('## Positive Factors');
    lines.push('');
    for (const factor of confidence.positiveFactors) {
      lines.push(`- ${factor}`);
    }
    lines.push('');
  }

  // Suggested labels
  if (heuristics.suggestedLabels.length > 0) {
    lines.push('## Suggested Labels');
    lines.push('');
    lines.push(heuristics.suggestedLabels.map((l) => `\`${l}\``).join(', '));
    lines.push('');
  }

  return lines.join('\n');
}
