/**
 * @module workflow/code-fix-strategy/orchestrator
 * @description Orchestrate the complete fix strategy workflow
 */

import type {
  IssueGroup,
  PullRequest,
  Result,
} from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type {
  FixStrategy,
  FixAttempt,
  FixError,
  FileChange,
} from './types.js';
import { DEFAULT_MAX_RETRIES, DEFAULT_ALLOWED_SCOPES } from './constants.js';
import { detectForbiddenPatterns } from './forbidden-patterns.js';
import { analyzeScope, isWithinAllowedScopes } from './scope-analyzer.js';
import { shouldRetry, generateRetryFeedback } from './retry-strategy.js';
import { generateCommitMessage } from './commit-message.js';
import { createPRParams } from './pr-creator.js';
import { runVerificationChecks } from './checker.js';
import { handleFailure } from './failure-handler.js';

/**
 * Execute fix strategy for an issue group
 *
 * @param group - Issue group to fix
 * @param strategy - Fix strategy configuration
 * @returns Result with PR or error
 */
export async function executeFixStrategy(
  group: IssueGroup,
  strategy: Partial<FixStrategy> = {}
): Promise<Result<PullRequest, FixError>> {
  const fullStrategy: FixStrategy = {
    maxRetries: strategy.maxRetries ?? DEFAULT_MAX_RETRIES,
    forbiddenPatterns: strategy.forbiddenPatterns ?? [],
    allowedScopes: strategy.allowedScopes ?? DEFAULT_ALLOWED_SCOPES,
  };

  const attempts: FixAttempt[] = [];

  for (let attempt = 1; attempt <= fullStrategy.maxRetries; attempt++) {
    // Generate fix (this will be integrated with AI service)
    const fixResult = await generateFix(group, attempts);

    if (!fixResult.success) {
      return err({
        code: 'UNKNOWN_ERROR',
        message: fixResult.error.message,
        attempts,
      });
    }

    const changes = fixResult.data;

    // Validate changes
    const validationResult = validateChanges(changes, fullStrategy);
    if (!validationResult.success) {
      return validationResult;
    }

    // Run verification checks
    const worktreePath = `/tmp/worktree-${group.id}`;
    const checkResult = await runVerificationChecks(worktreePath);

    if (!checkResult.success) {
      return err({
        code: 'CHECK_FAILED',
        message: checkResult.error.message,
        attempts,
      });
    }

    const fixAttempt: FixAttempt = {
      attempt,
      changes,
      checkResult: checkResult.data,
      success: checkResult.data.passed,
      timestamp: new Date(),
    };

    attempts.push(fixAttempt);

    // Check if successful
    if (fixAttempt.success) {
      // Commit and create PR
      return await createPullRequest(group, changes, attempts);
    }

    // Check if should retry
    if (!shouldRetry(fixAttempt, fullStrategy)) {
      break;
    }

    // Generate feedback for next attempt
    const feedback = generateRetryFeedback(fixAttempt);
    console.log(`Retry ${attempt + 1}:\n${feedback}`);
  }

  // All attempts failed
  const failureSummary = handleFailure(group, attempts);

  return err({
    code: 'MAX_RETRIES_EXCEEDED',
    message: failureSummary.reason,
    attempts,
    context: {
      failedChecks: failureSummary.failedChecks,
      suggestions: failureSummary.suggestions,
    },
  });
}

/**
 * Validate file changes against strategy
 */
function validateChanges(
  changes: readonly FileChange[],
  strategy: FixStrategy
): Result<void, FixError> {
  // Check forbidden patterns
  const forbiddenMatches = detectForbiddenPatterns(
    changes,
    strategy.forbiddenPatterns
  );

  if (forbiddenMatches.length > 0) {
    return err({
      code: 'FORBIDDEN_PATTERN_DETECTED',
      message: 'Forbidden patterns detected in changes',
      context: {
        matches: forbiddenMatches,
      },
    });
  }

  // Check scope
  const scopeAnalysis = analyzeScope(changes);

  if (scopeAnalysis.isTooBoard) {
    return err({
      code: 'SCOPE_TOO_BROAD',
      message: scopeAnalysis.warning || 'Changes are too broad',
      context: {
        analysis: scopeAnalysis,
      },
    });
  }

  // Check allowed scopes
  if (!isWithinAllowedScopes(changes, strategy.allowedScopes)) {
    return err({
      code: 'SCOPE_TOO_BROAD',
      message: 'Changes outside allowed scopes',
      context: {
        allowedScopes: strategy.allowedScopes,
      },
    });
  }

  return ok(undefined);
}

/**
 * Generate fix for issue group
 * This is a placeholder - will be integrated with AI service
 */
async function generateFix(
  group: IssueGroup,
  previousAttempts: readonly FixAttempt[]
): Promise<Result<readonly FileChange[], FixError>> {
  // TODO: Integrate with AI service to generate actual fix

  // Mock implementation
  const changes: FileChange[] = [];

  return ok(changes);
}

/**
 * Create pull request from successful fix
 */
async function createPullRequest(
  group: IssueGroup,
  changes: readonly FileChange[],
  attempts: readonly FixAttempt[]
): Promise<Result<PullRequest, FixError>> {
  try {
    // Generate commit message
    const commitMessage = generateCommitMessage(group.issues, changes);

    // Create PR parameters
    const prParams = createPRParams(group, changes);

    // TODO: Integrate with GitHub service to create actual PR

    // Mock PR creation
    const pr: PullRequest = {
      number: 1,
      title: prParams.title,
      body: prParams.body,
      state: 'open',
      headBranch: prParams.headBranch,
      baseBranch: prParams.baseBranch || 'main',
      linkedIssues: prParams.linkedIssues || [],
      labels: prParams.labels || [],
      reviewers: prParams.reviewers || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      url: `https://github.com/owner/repo/pull/1`,
      changedFiles: changes.length,
      additions: changes.reduce((sum, c) => sum + c.additions, 0),
      deletions: changes.reduce((sum, c) => sum + c.deletions, 0),
    };

    return ok(pr);
  } catch (error) {
    return err({
      code: 'PR_CREATION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
      attempts,
    });
  }
}

/**
 * Get fix strategy status
 */
export interface FixStrategyStatus {
  /** Current attempt number */
  readonly currentAttempt: number;
  /** Maximum attempts */
  readonly maxAttempts: number;
  /** All attempts so far */
  readonly attempts: readonly FixAttempt[];
  /** Whether fix is complete */
  readonly complete: boolean;
  /** Success status */
  readonly success: boolean;
}

/**
 * Get current status of fix strategy
 */
export function getFixStatus(
  attempts: readonly FixAttempt[],
  maxRetries: number
): FixStrategyStatus {
  const lastAttempt = attempts[attempts.length - 1];

  return {
    currentAttempt: attempts.length,
    maxAttempts: maxRetries,
    attempts,
    complete: lastAttempt?.success || attempts.length >= maxRetries,
    success: lastAttempt?.success || false,
  };
}
