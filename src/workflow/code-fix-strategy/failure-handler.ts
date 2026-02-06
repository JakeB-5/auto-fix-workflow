/**
 * @module workflow/code-fix-strategy/failure-handler
 * @description Handle final fix failures and update issues
 */

import type { CheckType } from '../../common/types/check.js';
import type { IssueGroup } from '../../common/types/index.js';
import type { FixAttempt } from './types.js';

/**
 * Handle final failure after all retry attempts exhausted
 *
 * @param group - Issue group that failed
 * @param attempts - All fix attempts
 * @returns Failure summary
 */
export function handleFailure(
  group: IssueGroup,
  attempts: readonly FixAttempt[]
): FailureSummary {
  const baseSummary = generateFailureSummary(group, attempts);
  const issueComment = formatFailureComment({
    ...baseSummary,
    issueComment: '',
  });

  return {
    ...baseSummary,
    issueComment,
  };
}

/**
 * Failure summary interface
 */
export interface FailureSummary {
  /** Group ID */
  readonly groupId: string;
  /** Total attempts made */
  readonly totalAttempts: number;
  /** Primary failure reason */
  readonly reason: string;
  /** Failed checks summary */
  readonly failedChecks: readonly string[];
  /** Suggested next steps */
  readonly suggestions: readonly string[];
  /** Formatted comment for issues */
  readonly issueComment: string;
}

/**
 * Generate failure summary
 */
function generateFailureSummary(
  group: IssueGroup,
  attempts: readonly FixAttempt[]
): Omit<FailureSummary, 'issueComment'> {
  const lastAttempt = attempts[attempts.length - 1];
  const reason = determinePrimaryReason(attempts);
  const failedChecks = lastAttempt !== undefined ? extractFailedChecks(lastAttempt) : [];
  const suggestions = generateSuggestions(group, attempts);

  return {
    groupId: group.id,
    totalAttempts: attempts.length,
    reason,
    failedChecks,
    suggestions,
  };
}

/**
 * Determine primary failure reason
 */
function determinePrimaryReason(
  attempts: readonly FixAttempt[]
): string {
  const lastAttempt = attempts[attempts.length - 1];

  if (!lastAttempt) {
    return 'No attempts made';
  }

  // Check for specific failure patterns
  if (lastAttempt.error) {
    return lastAttempt.error;
  }

  const failedChecks = lastAttempt.checkResult.results.filter(
    (r) => !r.passed
  );

  if (failedChecks.length === 0) {
    return 'Unknown failure';
  }

  // Most common failed check
  const checkCounts = new Map<CheckType, number>();
  for (const check of failedChecks) {
    checkCounts.set(
      check.check,
      (checkCounts.get(check.check) || 0) + 1
    );
  }

  let maxCheck = failedChecks[0]?.check;
  let maxCount = 0;

  Array.from(checkCounts.entries()).forEach(([check, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxCheck = check;
    }
  });

  return `${maxCheck ?? 'unknown'} checks failed repeatedly`;
}

/**
 * Extract failed checks from attempt
 */
function extractFailedChecks(attempt: FixAttempt): readonly string[] {
  return attempt.checkResult.results
    .filter((r) => !r.passed)
    .map((r) => {
      const error = r.error ?? 'Unknown error';
      return `${r.check}: ${error}`;
    });
}

/**
 * Generate suggestions for manual intervention
 */
function generateSuggestions(
  group: IssueGroup,
  attempts: readonly FixAttempt[]
): readonly string[] {
  const suggestions: string[] = [];

  // Analyze failure patterns
  const hasTestFailures = attempts.some((a) =>
    a.checkResult.results.some((r) => r.check === 'test' && !r.passed)
  );

  const hasTypeErrors = attempts.some((a) =>
    a.checkResult.results.some((r) => r.check === 'typecheck' && !r.passed)
  );

  const hasLintErrors = attempts.some((a) =>
    a.checkResult.results.some((r) => r.check === 'lint' && !r.passed)
  );

  // Generate specific suggestions
  if (hasTestFailures) {
    suggestions.push(
      'Review test failures - may require updating test expectations or fixing logic bugs',
      'Consider if the issue requires changes beyond the affected files'
    );
  }

  if (hasTypeErrors) {
    suggestions.push(
      'Fix TypeScript type errors - may need to update type definitions',
      'Check if new types need to be imported or defined'
    );
  }

  if (hasLintErrors) {
    suggestions.push(
      'Address linting issues following project style guide',
      'Some linting errors may indicate deeper code quality issues'
    );
  }

  // General suggestions
  suggestions.push(
    'Review the related files listed in the issue',
    'Consider breaking the fix into smaller, incremental changes',
    'Manual intervention may be required for this issue'
  );

  // Group-specific suggestions
  if (group.issues.length > 3) {
    suggestions.push(
      'Consider splitting this group into smaller groups',
      'Some issues may have conflicting requirements'
    );
  }

  return suggestions;
}

/**
 * Format failure comment for GitHub issues
 */
function formatFailureComment(summary: FailureSummary): string {
  const lines: string[] = [];

  lines.push('## Automated Fix Failed');
  lines.push('');
  lines.push(
    `After ${summary.totalAttempts} attempt(s), the automated fix was unable to resolve this issue group.`
  );
  lines.push('');

  // Failure reason
  lines.push('### Reason');
  lines.push(summary.reason);
  lines.push('');

  // Failed checks
  if (summary.failedChecks.length > 0) {
    lines.push('### Failed Checks');
    for (const check of summary.failedChecks) {
      lines.push(`- ${check}`);
    }
    lines.push('');
  }

  // Suggestions
  lines.push('### Suggested Next Steps');
  for (const suggestion of summary.suggestions) {
    lines.push(`- ${suggestion}`);
  }
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('*This issue requires manual intervention.*');
  lines.push('');
  lines.push(
    '**Labels:** `needs-manual-fix`, `automated-fix-failed`'
  );

  return lines.join('\n');
}

/**
 * Create failure labels for issues
 */
export function createFailureLabels(): readonly string[] {
  return ['needs-manual-fix', 'automated-fix-failed'];
}

/**
 * Determine if failure is recoverable
 *
 * @param attempts - Fix attempts
 * @returns True if might succeed with different approach
 */
export function isRecoverableFailure(
  attempts: readonly FixAttempt[]
): boolean {
  // Check if we're showing improvement
  if (attempts.length < 2) {
    return true;
  }

  const lastTwo = attempts.slice(-2);
  const lastPassed = lastTwo[1]?.checkResult.results.filter(
    (r) => r.passed
  ).length ?? 0;
  const prevPassed = lastTwo[0]?.checkResult.results.filter(
    (r) => r.passed
  ).length ?? 0;

  // Recoverable if we're making progress
  return lastPassed >= prevPassed;
}
