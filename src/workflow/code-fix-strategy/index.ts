/**
 * @module workflow/code-fix-strategy
 * @description Code fix strategy module - orchestrates the fix process
 */

// Types
export type {
  FixStrategy,
  FixAttempt,
  FileChange,
  ScopeAnalysis,
  ForbiddenPatternMatch,
  FixError,
  FixErrorCode,
} from './types.js';

// Constants
export {
  DEFAULT_MAX_RETRIES,
  FORBIDDEN_PATTERNS,
  DEFAULT_ALLOWED_SCOPES,
  MAX_FILES_PER_FIX,
  MAX_DIRECTORIES_PER_FIX,
} from './constants.js';

// Forbidden patterns
export {
  detectForbiddenPatterns,
  hasForbiddenPatterns,
  formatForbiddenPatterns,
} from './forbidden-patterns.js';

// Scope analysis
export {
  analyzeScope,
  isWithinAllowedScopes,
  getFilesOutsideScopes,
} from './scope-analyzer.js';

// Retry strategy
export {
  shouldRetry,
  generateRetryFeedback,
  getRetryDelay,
  calculateSuccessProbability,
  isImproving,
} from './retry-strategy.js';

// Commit message
export type { CommitType } from './commit-message.js';
export {
  generateCommitMessage,
  validateCommitMessage,
} from './commit-message.js';

// PR creator
export {
  createPRParams,
  formatPR,
} from './pr-creator.js';

// Checker
export {
  runVerificationChecks,
  isValidWorktreePath,
  getRecommendedChecks,
  formatCheckResult,
  canSkipChecks,
} from './checker.js';

// Failure handler
export type { FailureSummary } from './failure-handler.js';
export {
  handleFailure,
  createFailureLabels,
  isRecoverableFailure,
} from './failure-handler.js';

// Orchestrator
export type { FixStrategyStatus } from './orchestrator.js';
export {
  executeFixStrategy,
  getFixStatus,
} from './orchestrator.js';
