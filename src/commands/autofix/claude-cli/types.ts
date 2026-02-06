/**
 * @module commands/autofix/claude-cli/types
 * @description Claude CLI type definitions
 */

/**
 * Claude CLI invocation options
 */
export interface ClaudeOptions {
  /** Prompt to send to Claude */
  prompt: string;
  /** Model to use */
  model?: 'opus' | 'sonnet' | 'haiku';
  /** Allowed tools */
  allowedTools?: string[];
  /** Maximum budget in USD */
  maxBudget?: number;
  /** Working directory */
  workingDir?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Stream output to stderr in real-time (default: true) */
  streamOutput?: boolean;
}

/**
 * Claude CLI result
 */
export interface ClaudeResult {
  /** Success flag */
  success: boolean;
  /** stdout output */
  output: string;
  /** Exit code */
  exitCode: number;
  /** Usage information if available */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  /** stderr output */
  error?: string;
}

/**
 * AI integration error
 */
export interface AIError {
  readonly code: AIErrorCode;
  readonly message: string;
  readonly cause?: Error;
}

export type AIErrorCode =
  | 'ANALYSIS_FAILED'
  | 'FIX_FAILED'
  | 'CONTEXT_TOO_LARGE'
  | 'API_ERROR'
  | 'CLI_NOT_FOUND'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'BUDGET_EXCEEDED'
  | 'PARSE_ERROR'
  | 'NOT_IMPLEMENTED';

/**
 * AI integration configuration
 */
export interface AIConfig {
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly maxBudgetPerIssue?: number;
  readonly maxBudgetPerSession?: number;
  readonly preferredModel?: 'opus' | 'sonnet' | 'haiku';
  readonly fallbackModel?: 'opus' | 'sonnet' | 'haiku';
}
