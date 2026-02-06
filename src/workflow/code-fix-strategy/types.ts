/**
 * @module workflow/code-fix-strategy/types
 * @description Code fix strategy types
 */

import type { CheckResult } from '../../common/types/index.js';

/**
 * File change information
 */
export interface FileChange {
  /** File path */
  readonly path: string;
  /** Change type */
  readonly type: 'added' | 'modified' | 'deleted';
  /** Number of added lines */
  readonly additions: number;
  /** Number of deleted lines */
  readonly deletions: number;
  /** File content (if added or modified) */
  readonly content?: string | undefined;
}

/**
 * Fix strategy configuration
 */
export interface FixStrategy {
  /** Maximum retry attempts */
  readonly maxRetries: number;
  /** Forbidden code patterns */
  readonly forbiddenPatterns: readonly string[];
  /** Allowed modification scopes */
  readonly allowedScopes: readonly string[];
}

/**
 * Fix attempt result
 */
export interface FixAttempt {
  /** Attempt number (1-indexed) */
  readonly attempt: number;
  /** File changes made */
  readonly changes: readonly FileChange[];
  /** Check result */
  readonly checkResult: CheckResult;
  /** Success status */
  readonly success: boolean;
  /** Timestamp */
  readonly timestamp: Date;
  /** Error message if failed */
  readonly error?: string | undefined;
}

/**
 * Scope analysis result
 */
export interface ScopeAnalysis {
  /** Total files changed */
  readonly totalFiles: number;
  /** Changed directories */
  readonly directories: readonly string[];
  /** Whether changes are too broad */
  readonly isTooBoard: boolean;
  /** Warning message if too broad */
  readonly warning?: string | undefined;
  /** Affected components */
  readonly components: readonly string[];
}

/**
 * Forbidden pattern detection result
 */
export interface ForbiddenPatternMatch {
  /** Matched pattern */
  readonly pattern: string;
  /** File path */
  readonly filePath: string;
  /** Line number */
  readonly lineNumber: number;
  /** Matched content */
  readonly content: string;
}

/**
 * Fix error type
 */
export interface FixError {
  /** Error code */
  readonly code: FixErrorCode;
  /** Error message */
  readonly message: string;
  /** Failed attempts */
  readonly attempts?: readonly FixAttempt[] | undefined;
  /** Additional context */
  readonly context?: Record<string, unknown> | undefined;
}

/**
 * Fix error codes
 */
export type FixErrorCode =
  | 'FORBIDDEN_PATTERN_DETECTED'
  | 'SCOPE_TOO_BROAD'
  | 'MAX_RETRIES_EXCEEDED'
  | 'CHECK_FAILED'
  | 'COMMIT_FAILED'
  | 'PR_CREATION_FAILED'
  | 'UNKNOWN_ERROR';
