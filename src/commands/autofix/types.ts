/**
 * @module commands/autofix/types
 * @description Autofix command type definitions
 */

import type {
  GroupBy,
  IssueGroup,
  GroupProcessingStatus,
  Issue,
  PullRequest,
  CheckResult,
  WorktreeInfo,
} from '../../common/types/index.js';

/**
 * Autofix command options
 */
export interface AutofixOptions {
  /** Process all auto-fix labeled issues without confirmation */
  readonly all?: boolean;
  /** Specific issue numbers to process (empty = all auto-fix labeled) */
  readonly issueNumbers?: readonly number[];
  /** Grouping strategy */
  readonly groupBy: GroupBy;
  /** Maximum parallel worktrees */
  readonly maxParallel: number;
  /** Dry-run mode (no actual changes) */
  readonly dryRun: boolean;
  /** Maximum retry attempts per group */
  readonly maxRetries: number;
  /** Labels to filter issues */
  readonly labels?: readonly string[];
  /** Labels to exclude */
  readonly excludeLabels?: readonly string[];
  /** Base branch for PRs */
  readonly baseBranch?: string;
  /** Enable verbose output */
  readonly verbose?: boolean;
}

/**
 * Single group processing result
 */
export interface GroupResult {
  /** Group that was processed */
  readonly group: IssueGroup;
  /** Processing status */
  readonly status: GroupProcessingStatus;
  /** Created PR (if successful) */
  readonly pr?: PullRequest | undefined;
  /** Error message (if failed) */
  readonly error?: string | undefined;
  /** Error details for debugging */
  readonly errorDetails?: string | undefined;
  /** Worktree used for processing */
  readonly worktree?: WorktreeInfo | undefined;
  /** Check results */
  readonly checkResult?: CheckResult | undefined;
  /** Number of retry attempts made */
  readonly attempts: number;
  /** Processing duration in milliseconds */
  readonly durationMs: number;
  /** Start timestamp */
  readonly startedAt: Date;
  /** End timestamp */
  readonly completedAt: Date;
}

/**
 * Overall autofix result
 */
export interface AutofixResult {
  /** Results for each group */
  readonly groups: readonly GroupResult[];
  /** Total PRs created */
  readonly totalPRs: number;
  /** Total groups that failed */
  readonly totalFailed: number;
  /** Total issues processed */
  readonly totalIssues: number;
  /** Total duration in milliseconds */
  readonly totalDurationMs: number;
  /** Whether the run was a dry-run */
  readonly dryRun: boolean;
  /** Summary statistics */
  readonly stats: AutofixStats;
}

/**
 * Autofix statistics
 */
export interface AutofixStats {
  /** Issues by status */
  readonly issuesByStatus: Readonly<Record<string, number>>;
  /** Groups by status */
  readonly groupsByStatus: Readonly<Record<GroupProcessingStatus, number>>;
  /** Average processing time per group (ms) */
  readonly avgProcessingTimeMs: number;
  /** Total checks run */
  readonly totalChecksRun: number;
  /** Total checks passed */
  readonly totalChecksPassed: number;
}

/**
 * Queue item status
 */
export type QueueItemStatus =
  | 'queued'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'failed';

/**
 * Processing queue item
 */
export interface QueueItem {
  /** Item ID */
  readonly id: string;
  /** Issue group to process */
  readonly group: IssueGroup;
  /** Current status */
  status: QueueItemStatus;
  /** Current attempt number */
  attempt: number;
  /** Error if failed */
  error?: string | undefined;
  /** Worktree path if assigned */
  worktreePath?: string | undefined;
  /** Start time */
  startedAt?: Date | undefined;
}

/**
 * Pipeline stage
 */
export type PipelineStage =
  | 'init'
  | 'worktree_create'
  | 'ai_analysis'
  | 'ai_fix'
  | 'install_deps'
  | 'checks'
  | 'commit'
  | 'pr_create'
  | 'issue_update'
  | 'cleanup'
  | 'done';

/**
 * Pipeline context for a single group
 */
export interface PipelineContext {
  /** Current stage */
  stage: PipelineStage;
  /** Issue group being processed */
  readonly group: IssueGroup;
  /** Worktree info (after creation) */
  worktree?: WorktreeInfo;
  /** AI analysis result */
  analysisResult?: AIAnalysisResult;
  /** AI fix result */
  fixResult?: AIFixResult;
  /** Check result */
  checkResult?: CheckResult;
  /** Created PR */
  pr?: PullRequest;
  /** Current attempt */
  attempt: number;
  /** Max retries */
  readonly maxRetries: number;
  /** Is dry-run */
  readonly dryRun: boolean;
  /** Start time */
  readonly startedAt: Date;
  /** Errors encountered */
  errors: PipelineError[];
}

/**
 * Pipeline error
 */
export interface PipelineError {
  /** Stage where error occurred */
  readonly stage: PipelineStage;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code?: string;
  /** Timestamp */
  readonly timestamp: Date;
  /** Is recoverable */
  readonly recoverable: boolean;
}

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
  /** Issues analyzed */
  readonly issues: readonly Issue[];
  /** Files identified for modification */
  readonly filesToModify: readonly string[];
  /** Root cause of the issue(s) */
  readonly rootCause: string;
  /** Suggested fix approach */
  readonly suggestedFix: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Estimated complexity */
  readonly complexity: 'low' | 'medium' | 'high';
}

/**
 * AI fix result (stub interface)
 */
export interface AIFixResult {
  /** Files modified */
  readonly filesModified: readonly string[];
  /** Changes summary */
  readonly summary: string;
  /** Whether fix was successful */
  readonly success: boolean;
  /** Commit message */
  readonly commitMessage: string;
}

/**
 * Progress event types
 */
export type ProgressEventType =
  | 'start'
  | 'group_start'
  | 'group_stage'
  | 'group_complete'
  | 'group_failed'
  | 'group_retry'
  | 'complete'
  | 'error'
  | 'interrupted';

/**
 * Progress event
 */
export interface ProgressEvent {
  /** Event type */
  readonly type: ProgressEventType;
  /** Timestamp */
  readonly timestamp: Date;
  /** Group ID (if applicable) */
  readonly groupId?: string | undefined;
  /** Stage (if applicable) */
  readonly stage?: PipelineStage | undefined;
  /** Message */
  readonly message: string;
  /** Progress (0-100) */
  readonly progress?: number | undefined;
  /** Additional data */
  readonly data?: Record<string, unknown> | undefined;
}

/**
 * Interrupt signal handler
 */
export interface InterruptHandler {
  /** Whether interrupt is requested */
  readonly isInterrupted: boolean;
  /** Request interrupt */
  requestInterrupt(): void;
  /** Register cleanup callback */
  onCleanup(callback: () => Promise<void>): void;
  /** Wait for cleanup to complete */
  waitForCleanup(): Promise<void>;
}

/**
 * Dry-run result for a single operation
 */
export interface DryRunOperation {
  /** Operation type */
  readonly type: 'worktree' | 'branch' | 'commit' | 'pr' | 'issue_update';
  /** Description */
  readonly description: string;
  /** Would affect these resources */
  readonly affects: readonly string[];
  /** Simulated result */
  readonly simulatedResult: Record<string, unknown>;
}

/**
 * Dry-run group result
 */
export interface DryRunGroupResult {
  /** Group */
  readonly group: IssueGroup;
  /** Operations that would be performed */
  readonly operations: readonly DryRunOperation[];
  /** Predicted outcome */
  readonly predictedOutcome: 'success' | 'failure' | 'unknown';
  /** Reason for predicted outcome */
  readonly outcomeReason?: string | undefined;
}
