/**
 * @module common/error-handler/worktree-error
 * @description Worktree operation error class
 */

import { AutofixError } from './base.js';
import type { WorktreeErrorCode } from './codes.js';

/**
 * Context for worktree errors
 */
export interface WorktreeErrorContext {
  /** Path to the worktree */
  readonly path?: string | undefined;
  /** Branch name */
  readonly branch?: string | undefined;
  /** Base branch for worktree creation */
  readonly baseBranch?: string | undefined;
  /** Repository path */
  readonly repoPath?: string | undefined;
  /** Git command that failed */
  readonly gitCommand?: string | undefined;
  /** Git stderr output */
  readonly gitStderr?: string | undefined;
  /** Git exit code */
  readonly gitExitCode?: number | undefined;
  /** Lock file path */
  readonly lockFile?: string | undefined;
  /** List of uncommitted changes */
  readonly uncommittedFiles?: readonly string[] | undefined;
}

/**
 * Error class for worktree operation errors
 *
 * @example
 * ```typescript
 * throw new WorktreeError(
 *   'WORKTREE_CREATE_FAILED',
 *   'Failed to create worktree',
 *   { path: '/path/to/worktree', branch: 'feature-branch' }
 * );
 * ```
 */
export class WorktreeError extends AutofixError {
  readonly code: WorktreeErrorCode;
  readonly context: Readonly<WorktreeErrorContext>;

  constructor(
    code: WorktreeErrorCode,
    message: string,
    context: WorktreeErrorContext = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code;
    this.context = Object.freeze({
      ...context,
      uncommittedFiles: context.uncommittedFiles
        ? Object.freeze([...context.uncommittedFiles])
        : undefined,
    });
    Object.freeze(this);
  }

  /**
   * Create a WorktreeError for creation failures
   */
  static createFailed(
    path: string,
    branch: string,
    reason: string,
    cause?: unknown
  ): WorktreeError {
    return new WorktreeError(
      'WORKTREE_CREATE_FAILED',
      `Failed to create worktree at ${path} for branch ${branch}: ${reason}`,
      { path, branch },
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a WorktreeError for removal failures
   */
  static removeFailed(path: string, reason: string, cause?: unknown): WorktreeError {
    return new WorktreeError(
      'WORKTREE_REMOVE_FAILED',
      `Failed to remove worktree at ${path}: ${reason}`,
      { path },
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a WorktreeError for not found worktrees
   */
  static notFound(path: string): WorktreeError {
    return new WorktreeError(
      'WORKTREE_NOT_FOUND',
      `Worktree not found at ${path}`,
      { path }
    );
  }

  /**
   * Create a WorktreeError for already existing worktrees
   */
  static alreadyExists(path: string, branch?: string): WorktreeError {
    const message = branch
      ? `Worktree for branch ${branch} already exists at ${path}`
      : `Worktree already exists at ${path}`;

    return new WorktreeError(
      'WORKTREE_ALREADY_EXISTS',
      message,
      { path, branch }
    );
  }

  /**
   * Create a WorktreeError for locked worktrees
   */
  static locked(path: string, lockFile?: string): WorktreeError {
    return new WorktreeError(
      'WORKTREE_LOCKED',
      `Worktree at ${path} is locked`,
      { path, lockFile }
    );
  }

  /**
   * Create a WorktreeError for dirty worktrees
   */
  static dirty(path: string, uncommittedFiles: readonly string[]): WorktreeError {
    return new WorktreeError(
      'WORKTREE_DIRTY',
      `Worktree at ${path} has uncommitted changes`,
      { path, uncommittedFiles }
    );
  }

  /**
   * Create a WorktreeError for git command failures
   */
  static gitError(
    message: string,
    gitCommand: string,
    gitStderr?: string,
    gitExitCode?: number,
    cause?: unknown
  ): WorktreeError {
    return new WorktreeError(
      'WORKTREE_GIT_ERROR',
      message,
      { gitCommand, gitStderr, gitExitCode },
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a WorktreeError for invalid paths
   */
  static pathInvalid(path: string, reason: string): WorktreeError {
    return new WorktreeError(
      'WORKTREE_PATH_INVALID',
      `Invalid worktree path ${path}: ${reason}`,
      { path }
    );
  }

  /**
   * Check if the worktree can be retried after unlock
   */
  get canRetryAfterUnlock(): boolean {
    return this.code === 'WORKTREE_LOCKED';
  }

  /**
   * Check if the worktree needs cleanup before retry
   */
  get needsCleanup(): boolean {
    return this.code === 'WORKTREE_DIRTY' || this.code === 'WORKTREE_ALREADY_EXISTS';
  }
}
