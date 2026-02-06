/**
 * @module workflow/code-fix-strategy/retry-strategy
 * @description Retry strategy for failed fix attempts
 */

import type { FixAttempt, FixStrategy } from './types.js';
import type { CheckType } from '../../common/types/index.js';

/**
 * Determine if a fix should be retried
 *
 * @param attempt - Current fix attempt
 * @param strategy - Fix strategy configuration
 * @returns True if should retry
 */
export function shouldRetry(
  attempt: FixAttempt,
  strategy: FixStrategy
): boolean {
  // Don't retry if already successful
  if (attempt.success) {
    return false;
  }

  // Don't retry if max retries exceeded
  if (attempt.attempt >= strategy.maxRetries) {
    return false;
  }

  // Don't retry if no checks were run
  if (attempt.checkResult.results.length === 0) {
    return false;
  }

  // Retry if any check failed (not timed out or skipped)
  const hasRetriableFailure = attempt.checkResult.results.some(
    (result) =>
      result.status === 'failed'
  );

  return hasRetriableFailure;
}

/**
 * Generate feedback for the next fix attempt
 *
 * @param attempt - Failed fix attempt
 * @returns Feedback message for next attempt
 */
export function generateRetryFeedback(
  attempt: FixAttempt
): string {
  const lines: string[] = [
    `Attempt ${attempt.attempt} failed.`,
    '',
    'Failed checks:',
  ];

  const failedChecks = attempt.checkResult.results.filter(
    (r) => r.status === 'failed'
  );

  for (const check of failedChecks) {
    lines.push(`  - ${check.check}: ${check.error || 'Unknown error'}`);

    if (check.stderr) {
      const errorLines = check.stderr.split('\n').slice(0, 5);
      for (const line of errorLines) {
        lines.push(`    ${line}`);
      }
    }
  }

  lines.push('');
  lines.push('Suggestions for next attempt:');
  lines.push(...generateSuggestions(failedChecks));

  return lines.join('\n');
}

/**
 * Generate suggestions based on failed checks
 *
 * @param failedChecks - Failed check results
 * @returns Array of suggestion strings
 */
function generateSuggestions(
  failedChecks: readonly { check: CheckType; error?: string | undefined; stderr?: string | undefined }[]
): string[] {
  const suggestions: string[] = [];

  for (const check of failedChecks) {
    switch (check.check) {
      case 'test':
        suggestions.push(
          '  - Review test failures and ensure changes maintain existing functionality',
          '  - Check if new test cases are needed for new code paths'
        );
        break;

      case 'typecheck':
        suggestions.push(
          '  - Fix type errors by adding proper type annotations',
          '  - Ensure imported types are available and correctly used'
        );
        break;

      case 'lint':
        suggestions.push(
          '  - Fix linting errors following the project style guide',
          '  - Run auto-fix for fixable linting issues'
        );
        break;
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      '  - Review error messages carefully',
      '  - Ensure changes are minimal and focused on the issue'
    );
  }

  return suggestions;
}

/**
 * Get next retry delay in milliseconds
 *
 * @param attemptNumber - Current attempt number (1-indexed)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  const baseDelay = 1000;
  const maxDelay = 10000;
  const delay = baseDelay * Math.pow(2, attemptNumber - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Calculate success probability based on previous attempts
 *
 * @param attempts - All previous attempts
 * @returns Success probability (0-1)
 */
export function calculateSuccessProbability(
  attempts: readonly FixAttempt[]
): number {
  if (attempts.length === 0) {
    return 1.0; // First attempt has highest probability
  }

  // Each failure reduces probability
  const baseProb = 0.8; // 80% base probability
  const reduction = 0.2; // 20% reduction per failure
  const probability = baseProb - (attempts.length * reduction);

  return Math.max(0.1, probability); // Minimum 10% probability
}

/**
 * Determine if changes are improving over attempts
 *
 * @param attempts - All attempts so far
 * @returns True if showing improvement
 */
export function isImproving(
  attempts: readonly FixAttempt[]
): boolean {
  if (attempts.length < 2) {
    return true;
  }

  const latest = attempts[attempts.length - 1];
  const previous = attempts[attempts.length - 2];

  if (!latest || !previous) {
    return true;
  }

  // Count passed checks
  const latestPassed = latest.checkResult.results.filter(
    (r) => r.status === 'passed'
  ).length;
  const previousPassed = previous.checkResult.results.filter(
    (r) => r.status === 'passed'
  ).length;

  // Improvement if more checks passed
  return latestPassed > previousPassed;
}
