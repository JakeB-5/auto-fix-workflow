/**
 * @module analyzer/code-locator/types
 * @description Type definitions for code location and analysis
 */

/**
 * Represents a specific location in the codebase
 */
export interface CodeLocation {
  /** Absolute or relative file path */
  readonly filePath: string;
  /** Optional line number where the code is located */
  readonly lineNumber?: number;
  /** Optional function name */
  readonly functionName?: string;
  /** Optional class name */
  readonly className?: string;
  /** Confidence score for this location (0-1) */
  readonly confidence: number;
}

/**
 * Result of code location analysis
 */
export interface LocatorResult {
  /** Array of located code positions */
  readonly locations: readonly CodeLocation[];
  /** Identified components/modules */
  readonly components: readonly string[];
  /** Suggested labels for categorization */
  readonly suggestedLabels: readonly string[];
}

/**
 * Hints for code location (from issue description, stack traces, etc.)
 */
export interface CodeHint {
  /** Type of hint */
  readonly type: 'stacktrace' | 'filename' | 'function' | 'class' | 'text';
  /** Hint content */
  readonly content: string;
  /** Optional weight/priority (0-1) */
  readonly weight?: number;
}

/**
 * Stack frame from a parsed stack trace
 */
export interface StackFrame {
  /** File path from stack trace */
  readonly filePath: string;
  /** Line number */
  readonly lineNumber?: number;
  /** Column number */
  readonly columnNumber?: number;
  /** Function or method name */
  readonly functionName?: string;
  /** Class name (for OOP languages) */
  readonly className?: string;
  /** Full raw line from stack trace */
  readonly raw: string;
}

/**
 * Search result from text-based code search
 */
export interface SearchResult {
  /** File path */
  readonly filePath: string;
  /** Line number */
  readonly lineNumber: number;
  /** Matched line content */
  readonly content: string;
  /** Match confidence score */
  readonly confidence: number;
}

/**
 * Error types for code locator
 */
export enum LocatorErrorCode {
  INVALID_HINT = 'INVALID_HINT',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  SEARCH_FAILED = 'SEARCH_FAILED',
  NO_RESULTS = 'NO_RESULTS',
}

/**
 * Error object for locator operations
 */
export interface LocatorError {
  readonly code: LocatorErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
