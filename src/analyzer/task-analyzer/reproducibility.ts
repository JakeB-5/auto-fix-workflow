/**
 * @module analyzer/task-analyzer/reproducibility
 * @description Reproducibility judgment engine
 */

import type { AsanaTask, ReproducibilityResult } from './types.js';

/**
 * Keywords indicating reproducible issues
 */
const REPRODUCIBLE_KEYWORDS = [
  'always',
  'every time',
  'consistently',
  'reproducible',
  'steps to reproduce',
  'reproduction',
  'reproduce',
  'reliably',
  '100%',
];

/**
 * Keywords indicating non-reproducible issues
 */
const NON_REPRODUCIBLE_KEYWORDS = [
  'sometimes',
  'occasionally',
  'intermittent',
  'random',
  'sporadic',
  'rare',
  'once',
  'cannot reproduce',
];

/**
 * Keywords indicating error information
 */
const ERROR_KEYWORDS = [
  'error',
  'exception',
  'stack trace',
  'traceback',
  'crash',
  'failure',
  'failed',
  'line',
  'function',
  'file',
];

/**
 * Analyze reproducibility of a task
 */
export function analyzeReproducibility(task: AsanaTask): ReproducibilityResult {
  const text = `${task.name} ${task.notes || ''}`.toLowerCase();

  // Check for explicit reproducibility markers
  const reproducibleCount = REPRODUCIBLE_KEYWORDS.filter((keyword) =>
    text.includes(keyword)
  ).length;

  const nonReproducibleCount = NON_REPRODUCIBLE_KEYWORDS.filter((keyword) =>
    text.includes(keyword)
  ).length;

  // Check for error details
  const hasErrorDetails = ERROR_KEYWORDS.some((keyword) =>
    text.includes(keyword)
  );

  // Check for steps
  const hasSteps =
    text.includes('step') ||
    text.includes('1.') ||
    text.includes('2.') ||
    /\d+\.\s/.test(text);

  // Calculate base confidence
  let confidence = 0.5; // Start neutral

  if (reproducibleCount > 0) {
    confidence += reproducibleCount * 0.15;
  }

  if (nonReproducibleCount > 0) {
    confidence -= nonReproducibleCount * 0.2;
  }

  if (hasErrorDetails) {
    confidence += 0.2;
  }

  if (hasSteps) {
    confidence += 0.15;
  }

  // Check for code references
  const hasCodeReferences =
    text.includes('function') ||
    text.includes('method') ||
    text.includes('class') ||
    text.includes('file') ||
    /\w+\.\w+/.test(text) || // Method calls
    /\w+\(.*\)/.test(text); // Function calls

  if (hasCodeReferences) {
    confidence += 0.1;
  }

  // Clamp confidence to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  // Determine reproducibility (threshold: 0.6)
  const isReproducible = confidence >= 0.6;

  // Generate reason
  const reasons: string[] = [];
  if (reproducibleCount > 0) {
    reasons.push('contains reproducibility indicators');
  }
  if (nonReproducibleCount > 0) {
    reasons.push('contains intermittent issue indicators');
  }
  if (hasErrorDetails) {
    reasons.push('includes error details');
  }
  if (hasSteps) {
    reasons.push('provides reproduction steps');
  }
  if (hasCodeReferences) {
    reasons.push('references specific code');
  }

  const reason = reasons.length > 0
    ? reasons.join(', ')
    : 'insufficient reproducibility information';

  return {
    isReproducible,
    confidence,
    reason,
  };
}
