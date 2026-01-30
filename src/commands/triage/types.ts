/**
 * @module commands/triage/types
 * @description Triage command type definitions
 */

import type { IssuePriority, IssueType } from '../../common/types/index.js';

/**
 * Triage operation mode
 */
export type TriageMode = 'interactive' | 'batch' | 'single';

/**
 * Triage command options
 */
export interface TriageOptions {
  /** Operation mode */
  readonly mode: TriageMode;
  /** Whether to simulate without making changes */
  readonly dryRun: boolean;
  /** Target Asana project ID */
  readonly projectId?: string;
  /** Target Asana section ID */
  readonly sectionId?: string;
  /** Filter by priority */
  readonly priority?: IssuePriority;
  /** Maximum number of tasks to process */
  readonly limit?: number;
  /** Skip confirmation prompts */
  readonly skipConfirmation?: boolean;
  /** Verbose output */
  readonly verbose?: boolean;
}

/**
 * Triage operation result
 */
export interface TriageResult {
  /** Total tasks processed */
  readonly processed: number;
  /** GitHub issues created */
  readonly created: number;
  /** Tasks skipped */
  readonly skipped: number;
  /** Tasks that failed to process */
  readonly failed: number;
  /** Details of created issues */
  readonly createdIssues?: readonly CreatedIssueInfo[];
  /** Details of failures */
  readonly failures?: readonly TriageFailure[];
  /** Duration in milliseconds */
  readonly durationMs?: number;
}

/**
 * Information about a created GitHub issue
 */
export interface CreatedIssueInfo {
  /** Asana task GID */
  readonly asanaTaskGid: string;
  /** GitHub issue number */
  readonly githubIssueNumber: number;
  /** GitHub issue URL */
  readonly githubIssueUrl: string;
  /** Issue title */
  readonly title: string;
}

/**
 * Information about a triage failure
 */
export interface TriageFailure {
  /** Asana task GID */
  readonly asanaTaskGid: string;
  /** Task title */
  readonly title: string;
  /** Error message */
  readonly error: string;
  /** Whether the operation can be retried */
  readonly retryable: boolean;
}

/**
 * Asana task representation for triage
 */
export interface AsanaTask {
  /** Task GID */
  readonly gid: string;
  /** Task name/title */
  readonly name: string;
  /** Task notes/description */
  readonly notes: string;
  /** Task permalink URL */
  readonly permalinkUrl: string;
  /** Task due date (ISO string) */
  readonly dueOn?: string;
  /** Task due datetime (ISO string) */
  readonly dueAt?: string;
  /** Assignee information */
  readonly assignee?: {
    readonly gid: string;
    readonly name: string;
    readonly email?: string;
  };
  /** Custom fields */
  readonly customFields?: readonly AsanaCustomField[];
  /** Tags */
  readonly tags?: readonly AsanaTag[];
  /** Project memberships */
  readonly memberships?: readonly AsanaMembership[];
  /** Created at timestamp */
  readonly createdAt: string;
  /** Modified at timestamp */
  readonly modifiedAt: string;
  /** Completion status */
  readonly completed: boolean;
}

/**
 * Asana custom field
 */
export interface AsanaCustomField {
  readonly gid: string;
  readonly name: string;
  readonly displayValue?: string;
  readonly type: 'text' | 'enum' | 'number' | 'date' | 'people';
  readonly enumValue?: {
    readonly gid: string;
    readonly name: string;
  };
  readonly textValue?: string;
  readonly numberValue?: number;
}

/**
 * Asana tag
 */
export interface AsanaTag {
  readonly gid: string;
  readonly name: string;
}

/**
 * Asana project membership
 */
export interface AsanaMembership {
  readonly project: {
    readonly gid: string;
    readonly name: string;
  };
  readonly section?: {
    readonly gid: string;
    readonly name: string;
  };
}

/**
 * AI analysis result for a task
 */
export interface TaskAnalysis {
  /** Detected issue type */
  readonly issueType: IssueType;
  /** Detected priority */
  readonly priority: IssuePriority;
  /** Suggested labels */
  readonly labels: readonly string[];
  /** Component name */
  readonly component: string;
  /** Related file paths */
  readonly relatedFiles: readonly string[];
  /** Summary for GitHub issue */
  readonly summary: string;
  /** Acceptance criteria */
  readonly acceptanceCriteria: readonly string[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

/**
 * GitHub issue creation parameters
 */
export interface GitHubIssueParams {
  /** Issue title */
  readonly title: string;
  /** Issue body (Markdown) */
  readonly body: string;
  /** Labels to apply */
  readonly labels?: readonly string[];
  /** Assignees (GitHub usernames) */
  readonly assignees?: readonly string[];
  /** Milestone number */
  readonly milestone?: number;
}

/**
 * GitHub issue creation result
 */
export interface GitHubIssueResult {
  /** Issue number */
  readonly number: number;
  /** Issue URL */
  readonly url: string;
  /** Issue ID */
  readonly id: number;
}

/**
 * Asana task update parameters
 */
export interface AsanaTaskUpdateParams {
  /** Task GID */
  readonly taskGid: string;
  /** New section GID */
  readonly sectionGid?: string;
  /** Tags to add */
  readonly addTags?: readonly string[];
  /** Tags to remove */
  readonly removeTags?: readonly string[];
  /** Custom field updates */
  readonly customFields?: Record<string, string | number | null>;
  /** Notes to append */
  readonly appendNotes?: string;
  /** Mark as completed */
  readonly completed?: boolean;
}

/**
 * Triage configuration
 */
export interface TriageConfig {
  /** Default Asana project GID */
  readonly defaultProjectGid?: string;
  /** Default Asana section name for triage */
  readonly triageSectionName: string;
  /** Section name to move tasks after processing */
  readonly processedSectionName: string;
  /** Tag to add after GitHub issue creation */
  readonly syncedTagName: string;
  /** GitHub labels to always include */
  readonly defaultLabels: readonly string[];
  /** Priority field name in Asana */
  readonly priorityFieldName: string;
  /** Component field name in Asana */
  readonly componentFieldName: string;
  /** GitHub issue number field name in Asana */
  readonly githubIssueFieldName: string;
  /** Maximum tasks per batch */
  readonly maxBatchSize: number;
  /** Retry configuration */
  readonly retry: {
    readonly maxAttempts: number;
    readonly initialDelayMs: number;
    readonly maxDelayMs: number;
  };
}

/**
 * Default triage configuration
 */
export const DEFAULT_TRIAGE_CONFIG: TriageConfig = {
  triageSectionName: 'Triage',
  processedSectionName: 'To Do',
  syncedTagName: 'github-synced',
  defaultLabels: ['auto-fix'],
  priorityFieldName: 'Priority',
  componentFieldName: 'Component',
  githubIssueFieldName: 'GitHub Issue',
  maxBatchSize: 50,
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  },
};
