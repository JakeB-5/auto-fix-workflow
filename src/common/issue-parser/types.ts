/**
 * @module common/issue-parser/types
 * @description Types specific to issue parsing
 */

import type {
  IssueSource,
  IssueType,
  IssuePriority,
  IssueContext,
  CodeAnalysis,
  SuggestedFix,
  AcceptanceCriteria,
} from '../types/index.js';

/**
 * Error codes for parse operations
 */
export type ParseErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_FORMAT'
  | 'MISSING_SECTION'
  | 'VALIDATION_ERROR'
  | 'AST_ERROR';

/**
 * Parse error structure
 */
export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
  readonly section?: string;
  readonly cause?: unknown;
}

/**
 * Stack trace frame parsed from issue body
 */
export interface StackFrame {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
  readonly function?: string;
}

/**
 * Extended code analysis with stack trace
 */
export interface ExtendedCodeAnalysis extends CodeAnalysis {
  readonly stackTrace?: readonly StackFrame[];
  readonly errorMessage?: string;
  readonly errorType?: string;
}

/**
 * GIVEN-WHEN-THEN scenario for acceptance criteria
 */
export interface GivenWhenThenScenario {
  readonly given: string;
  readonly when: string;
  readonly then: string;
  readonly description?: string;
}

/**
 * Extended acceptance criteria with structured scenarios
 */
export interface ExtendedAcceptanceCriteria extends AcceptanceCriteria {
  readonly scenario?: GivenWhenThenScenario | undefined;
}

/**
 * Parsed issue content from markdown body
 */
export interface ParsedIssue {
  /** Issue source (sentry, asana, manual, github) */
  readonly source: IssueSource;
  /** Source-specific ID (Sentry issue ID, Asana task ID, etc.) */
  readonly sourceId?: string;
  /** Source URL */
  readonly sourceUrl?: string;

  /** Issue type (bug, feature, etc.) */
  readonly type: IssueType;

  /** Problem description extracted from the issue */
  readonly problemDescription: string;

  /** Context information */
  readonly context: {
    readonly component?: string;
    readonly service?: string;
    readonly environment?: string;
    readonly priority?: IssuePriority;
    readonly relatedFiles: readonly string[];
    readonly relatedSymbols: readonly string[];
  };

  /** Code analysis information */
  readonly codeAnalysis?: ExtendedCodeAnalysis;

  /** Suggested fix direction */
  readonly suggestedFix?: SuggestedFix;

  /** Acceptance criteria with GIVEN-WHEN-THEN scenarios */
  readonly acceptanceCriteria: readonly ExtendedAcceptanceCriteria[];

  /** Raw sections that were parsed */
  readonly rawSections: {
    readonly [key: string]: string;
  };
}

/**
 * Validation result for parsed issue
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Validation warning (non-fatal)
 */
export interface ValidationWarning {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Section names in the standard issue template
 */
export const SECTION_NAMES = {
  SOURCE: 'Source',
  TYPE: 'Type',
  CONTEXT: 'Context',
  PROBLEM: 'Problem Description',
  PROBLEM_ALT: 'Description',
  CODE_ANALYSIS: 'Code Analysis',
  STACK_TRACE: 'Stack Trace',
  ERROR_MESSAGE: 'Error Message',
  SUGGESTED_FIX: 'Suggested Fix',
  SUGGESTED_FIX_ALT: 'Suggested Fix Direction',
  ACCEPTANCE_CRITERIA: 'Acceptance Criteria',
  ACCEPTANCE_CRITERIA_ALT: 'Done Criteria',
  RELATED_FILES: 'Related Files',
  RELATED_SYMBOLS: 'Related Symbols',
} as const;

/**
 * Default values for missing optional fields
 */
export const DEFAULT_VALUES = {
  source: 'manual' as IssueSource,
  type: 'bug' as IssueType,
  priority: 'medium' as IssuePriority,
} as const;
