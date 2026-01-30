/**
 * @module workflow/code-fix-strategy/checker
 * @description Verification check integration
 */

import type {
  CheckResult,
  CheckType,
  RunChecksParams,
  Result,
  CheckError,
} from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';

/**
 * Run verification checks on a worktree
 *
 * @param worktreePath - Path to worktree
 * @param checks - Checks to run (default: all)
 * @returns Check result
 */
export async function runVerificationChecks(
  worktreePath: string,
  checks: readonly CheckType[] = ['test', 'typecheck', 'lint']
): Promise<Result<CheckResult, CheckError>> {
  try {
    const params: RunChecksParams = {
      worktreePath,
      checks,
      failFast: false,
      timeout: 300000, // 5 minutes
    };

    // This will be integrated with the actual checks module
    // For now, return a mock implementation
    const result = await runChecksInternal(params);
    return ok(result);
  } catch (error) {
    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Internal implementation - will be replaced with actual checks module integration
 */
async function runChecksInternal(
  params: RunChecksParams
): Promise<CheckResult> {
  const startTime = Date.now();

  // Mock implementation - replace with actual checks module
  const results = params.checks.map((check) => ({
    check,
    passed: true,
    status: 'passed' as const,
    durationMs: 1000,
  }));

  return {
    passed: results.every((r) => r.passed),
    results,
    attempt: 1,
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * Validate worktree path
 *
 * @param worktreePath - Path to validate
 * @returns True if valid
 */
export function isValidWorktreePath(worktreePath: string): boolean {
  // Basic validation - actual implementation will check if directory exists
  return (
    typeof worktreePath === 'string' &&
    worktreePath.length > 0 &&
    !worktreePath.includes('..')
  );
}

/**
 * Get recommended checks based on file changes
 *
 * @param changedFiles - Array of changed file paths
 * @returns Recommended check types
 */
export function getRecommendedChecks(
  changedFiles: readonly string[]
): readonly CheckType[] {
  const checks = new Set<CheckType>();

  // Always run lint
  checks.add('lint');

  for (const file of changedFiles) {
    // TypeScript/JavaScript files
    if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      checks.add('typecheck');
      checks.add('test');
    }

    // Test files
    if (file.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
      checks.add('test');
    }
  }

  return Array.from(checks);
}

/**
 * Format check result for display
 *
 * @param result - Check result
 * @returns Formatted string
 */
export function formatCheckResult(result: CheckResult): string {
  const lines: string[] = [];

  lines.push(
    `Checks ${result.passed ? 'PASSED' : 'FAILED'} (attempt ${result.attempt})`
  );
  lines.push(`Duration: ${result.totalDurationMs}ms`);
  lines.push('');

  for (const check of result.results) {
    const status = check.passed ? '✓' : '✗';
    lines.push(`${status} ${check.check}: ${check.status} (${check.durationMs}ms)`);

    if (check.error) {
      lines.push(`  Error: ${check.error}`);
    }

    if (check.stderr && !check.passed) {
      const errorLines = check.stderr.split('\n').slice(0, 3);
      for (const line of errorLines) {
        lines.push(`  ${line}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Determine if checks can be skipped
 *
 * @param changedFiles - Changed file paths
 * @returns True if checks can be skipped
 */
export function canSkipChecks(
  changedFiles: readonly string[]
): boolean {
  // Skip checks only for documentation-only changes
  const allDocs = changedFiles.every((file) =>
    file.match(/\.(md|txt|pdf|doc|docx)$/i)
  );

  return allDocs && changedFiles.length > 0;
}
