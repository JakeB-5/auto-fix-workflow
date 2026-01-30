/**
 * @module checks/run-checks/runner
 * @description Main check runner orchestration
 */

import { promises as fs } from 'fs';
import type {
  RunChecksParams,
  RunChecksResult,
  CheckResult,
  SingleCheckResult,
  CheckType,
  CheckError,
  PreviousError,
} from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import { detectPackageManager } from './package-manager.js';
import { getCheckCommand } from './command-mapper.js';
import { executeCommand } from './executor.js';
import { withRetry, type RetryError } from './retry.js';

/**
 * Default check execution order
 */
const DEFAULT_CHECK_ORDER: readonly CheckType[] = ['typecheck', 'lint', 'test'];

/**
 * Validate worktree path exists
 */
async function validateWorktreePath(worktreePath: string): Promise<CheckError | null> {
  try {
    const stat = await fs.stat(worktreePath);
    if (!stat.isDirectory()) {
      return {
        code: 'WORKTREE_NOT_FOUND',
        message: `Worktree path is not a directory: ${worktreePath}`,
      };
    }
    return null;
  } catch {
    return {
      code: 'WORKTREE_NOT_FOUND',
      message: `Worktree path does not exist: ${worktreePath}`,
    };
  }
}

/**
 * Validate checks array
 */
function validateChecks(checks: readonly CheckType[]): CheckError | null {
  if (checks.length === 0) {
    return {
      code: 'INVALID_CHECKS',
      message: 'No checks specified',
    };
  }

  const validChecks: CheckType[] = ['lint', 'typecheck', 'test'];
  const invalidChecks = checks.filter((c) => !validChecks.includes(c));

  if (invalidChecks.length > 0) {
    return {
      code: 'INVALID_CHECKS',
      message: `Invalid check types: ${invalidChecks.join(', ')}`,
      context: { invalidChecks },
    };
  }

  return null;
}

/**
 * Order checks according to execution priority
 */
function orderChecks(checks: readonly CheckType[]): CheckType[] {
  return DEFAULT_CHECK_ORDER.filter((c) => checks.includes(c));
}

/**
 * Run quality checks on a worktree
 * @param params - Check execution parameters
 * @returns Check results or error
 */
export async function runChecks(params: RunChecksParams): Promise<RunChecksResult> {
  const startTime = Date.now();
  const {
    worktreePath,
    checks,
    failFast = true,
    timeout,
  } = params;

  // Validate worktree path
  const worktreeError = await validateWorktreePath(worktreePath);
  if (worktreeError) {
    return err(worktreeError);
  }

  // Validate checks
  const checksError = validateChecks(checks);
  if (checksError) {
    return err(checksError);
  }

  try {
    // Detect package manager
    const packageManager = await detectPackageManager(worktreePath);

    // Order checks
    const orderedChecks = orderChecks(checks);

    // Execute checks with retry logic
    const MAX_RETRIES = 2; // Total 3 attempts (1 initial + 2 retries)
    let finalAttempt = 1;
    let previousErrors: PreviousError[] = [];
    let maxRetriesExceeded = false;
    let currentAttempt = 0;

    const executeChecks = async () => {
      currentAttempt++;
      const results: SingleCheckResult[] = [];
      let allPassed = true;

      for (const check of orderedChecks) {
        // Get command for this check
        const command = getCheckCommand(check, packageManager, worktreePath, timeout);

        // Execute check
        const result = await executeCommand(command);
        results.push(result);

        // Update overall status
        if (!result.passed) {
          allPassed = false;

          // Stop on first failure if failFast is enabled
          if (failFast) {
            break;
          }
        }
      }

      // If any check failed, throw error to trigger retry
      if (!allPassed) {
        const failedChecks = results.filter(r => !r.passed);
        const errorMessage = failedChecks
          .map(r => `${r.check}: ${r.error || 'failed'}`)
          .join(', ');
        throw new Error(`Checks failed: ${errorMessage}`);
      }

      return results;
    };

    let results: SingleCheckResult[];

    try {
      // Execute checks with retry logic
      results = await withRetry(
        executeChecks,
        MAX_RETRIES,
        orderedChecks[0], // Use first check for error tracking
      );
      finalAttempt = currentAttempt; // Successful attempt number
    } catch (error) {
      // Extract retry information
      if (error && typeof error === 'object' && 'previousErrors' in error) {
        const retryError = error as RetryError;
        previousErrors = retryError.previousErrors;
        finalAttempt = previousErrors.length > 0 ? previousErrors[previousErrors.length - 1].attempt : MAX_RETRIES + 1;
        maxRetriesExceeded = true;
      } else {
        finalAttempt = currentAttempt || 1;
      }

      // Execute one final time to get the actual results for reporting
      results = [];
      let allPassed = true;

      for (const check of orderedChecks) {
        const command = getCheckCommand(check, packageManager, worktreePath, timeout);
        const result = await executeCommand(command);
        results.push(result);

        if (!result.passed) {
          allPassed = false;
          if (failFast) {
            break;
          }
        }
      }
    }

    // Build final result
    const totalDurationMs = Date.now() - startTime;
    const allPassed = results.every(r => r.passed);

    const checkResult: CheckResult = {
      passed: allPassed,
      results,
      attempt: finalAttempt,
      maxRetriesExceeded,
      previousErrors: previousErrors.length > 0 ? previousErrors : undefined,
      totalDurationMs,
    };

    return ok(checkResult);
  } catch (error) {
    return err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
      context: { error },
    });
  }
}
