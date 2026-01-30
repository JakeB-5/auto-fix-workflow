/**
 * @module analyzer/task-analyzer/types
 * @description Task analyzer type definitions
 */

/**
 * Asana task from API
 */
export interface AsanaTask {
  readonly gid: string;
  readonly name: string;
  readonly notes?: string;
  readonly completed: boolean;
  readonly due_on?: string;
  readonly tags?: readonly { gid: string; name: string }[];
  readonly custom_fields?: readonly AsanaCustomField[];
  readonly parent?: { gid: string; name: string };
  readonly projects?: readonly { gid: string; name: string }[];
}

/**
 * Asana custom field
 */
export interface AsanaCustomField {
  readonly gid: string;
  readonly name: string;
  readonly type: string;
  readonly text_value?: string;
  readonly number_value?: number;
  readonly enum_value?: { gid: string; name: string };
}

/**
 * Code hint for locating relevant code
 */
export interface CodeHint {
  readonly file?: string;
  readonly function?: string;
  readonly line?: number;
  readonly confidence: number; // 0-1
}

/**
 * Information sufficiency level
 */
export type InformationSufficiency = 'sufficient' | 'partial' | 'insufficient';

/**
 * Reproducibility result
 */
export interface ReproducibilityResult {
  readonly isReproducible: boolean;
  readonly confidence: number; // 0-1
  readonly reason: string;
}

/**
 * Asana action type
 */
export type AsanaActionType =
  | 'add_comment'
  | 'update_description'
  | 'add_tag'
  | 'request_information'
  | 'mark_blocked';

/**
 * Asana action to perform
 */
export interface AsanaAction {
  readonly type: AsanaActionType;
  readonly payload: Record<string, unknown>;
}

/**
 * Complete task analysis result
 */
export interface TaskAnalysis {
  readonly taskId: string;
  readonly isReproducible: boolean;
  readonly confidence: number; // 0-1
  readonly codeHints: readonly CodeHint[];
  readonly suggestedActions: readonly AsanaAction[];
  readonly informationSufficiency: InformationSufficiency;
}

/**
 * Analyzer error codes
 */
export type AnalyzerErrorCode =
  | 'TASK_NOT_FOUND'
  | 'API_ERROR'
  | 'INVALID_TASK'
  | 'ANALYSIS_FAILED';

/**
 * Analyzer error
 */
export interface AnalyzerError {
  readonly code: AnalyzerErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
