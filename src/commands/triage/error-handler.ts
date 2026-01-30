/**
 * @module commands/triage/error-handler
 * @description Error handling and retry logic for triage operations
 */

import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';

/**
 * Triage error codes
 */
export type TriageErrorCode =
  | 'ASANA_API_ERROR'
  | 'GITHUB_API_ERROR'
  | 'AI_ANALYSIS_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Triage error with code and metadata
 */
export class TriageError extends Error {
  readonly code: TriageErrorCode;
  readonly retryable: boolean;
  readonly context?: Record<string, unknown>;
  readonly originalCause?: Error;

  constructor(
    message: string,
    code: TriageErrorCode,
    options: {
      retryable?: boolean;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = 'TriageError';
    this.code = code;
    this.retryable = options.retryable ?? isRetryableCode(code);
    this.context = options.context;
    this.originalCause = options.cause;
  }
}

/**
 * Check if an error code is retryable by default
 */
function isRetryableCode(code: TriageErrorCode): boolean {
  switch (code) {
    case 'NETWORK_ERROR':
    case 'RATE_LIMIT_ERROR':
    case 'ASANA_API_ERROR':
    case 'GITHUB_API_ERROR':
      return true;
    default:
      return false;
  }
}

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of attempts */
  readonly maxAttempts: number;
  /** Initial delay in milliseconds */
  readonly initialDelayMs: number;
  /** Maximum delay in milliseconds */
  readonly maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  readonly backoffMultiplier?: number;
  /** Jitter factor (0-1, default: 0.1) */
  readonly jitterFactor?: number;
  /** Callback on retry */
  readonly onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  /** Custom retry predicate */
  readonly shouldRetry?: (error: Error) => boolean;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<Result<T, Error>> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return ok(result);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = opts.shouldRetry
        ? opts.shouldRetry(lastError)
        : isRetryableError(lastError);

      if (!shouldRetry || attempt >= opts.maxAttempts) {
        break;
      }

      // Calculate delay with jitter
      const jitter = opts.jitterFactor ?? 0.1;
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
      const actualDelay = Math.min(delay + jitterAmount, opts.maxDelayMs);

      // Notify callback
      opts.onRetry?.(attempt, lastError, actualDelay);

      // Wait before retrying
      await sleep(actualDelay);

      // Increase delay for next attempt
      delay = Math.min(delay * (opts.backoffMultiplier ?? 2), opts.maxDelayMs);
    }
  }

  return err(lastError ?? new Error('All retry attempts failed'));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  // TriageError with retryable flag
  if (error instanceof TriageError) {
    return error.retryable;
  }

  // Network errors
  if (error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed')) {
    return true;
  }

  // Rate limit errors (common patterns)
  if (error.message.includes('rate limit') ||
      error.message.includes('429') ||
      error.message.includes('too many requests')) {
    return true;
  }

  // Server errors (5xx)
  if (error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504')) {
    return true;
  }

  return false;
}

/**
 * Handle a triage error and convert to TriageError
 */
export function handleTriageError(error: unknown, context?: string): TriageError {
  if (error instanceof TriageError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  // Categorize the error
  let code: TriageErrorCode = 'UNKNOWN_ERROR';

  if (message.includes('Asana') || message.includes('asana')) {
    code = 'ASANA_API_ERROR';
  } else if (message.includes('GitHub') || message.includes('github') || message.includes('Octokit')) {
    code = 'GITHUB_API_ERROR';
  } else if (message.includes('AI') || message.includes('analysis') || message.includes('Claude')) {
    code = 'AI_ANALYSIS_ERROR';
  } else if (message.includes('config') || message.includes('Config')) {
    code = 'CONFIGURATION_ERROR';
  } else if (message.includes('valid') || message.includes('Valid')) {
    code = 'VALIDATION_ERROR';
  } else if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('fetch')) {
    code = 'NETWORK_ERROR';
  } else if (message.includes('rate limit') || message.includes('429')) {
    code = 'RATE_LIMIT_ERROR';
  } else if (message.includes('permission') || message.includes('forbidden') || message.includes('403')) {
    code = 'PERMISSION_ERROR';
  } else if (message.includes('not found') || message.includes('404')) {
    code = 'NOT_FOUND_ERROR';
  }

  const contextMessage = context ? `${context}: ${message}` : message;

  return new TriageError(contextMessage, code, { cause });
}

/**
 * Format error for display
 */
export function formatError(error: Error): string {
  if (error instanceof TriageError) {
    const lines = [
      `Error [${error.code}]: ${error.message}`,
    ];

    if (error.retryable) {
      lines.push('  This error may be retryable.');
    }

    if (error.context) {
      lines.push(`  Context: ${JSON.stringify(error.context)}`);
    }

    if (error.originalCause) {
      lines.push(`  Caused by: ${error.originalCause.message}`);
    }

    return lines.join('\n');
  }

  return `Error: ${error.message}`;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an error aggregator for batch operations
 */
export class ErrorAggregator {
  private readonly errors: Map<string, TriageError[]> = new Map();

  add(taskId: string, error: TriageError): void {
    const existing = this.errors.get(taskId) ?? [];
    existing.push(error);
    this.errors.set(taskId, existing);
  }

  hasErrors(): boolean {
    return this.errors.size > 0;
  }

  getErrors(): ReadonlyMap<string, readonly TriageError[]> {
    return this.errors;
  }

  getErrorCount(): number {
    let count = 0;
    const values = Array.from(this.errors.values());
    for (const errors of values) {
      count += errors.length;
    }
    return count;
  }

  getTasksWithErrors(): readonly string[] {
    return Array.from(this.errors.keys());
  }

  getRetryableTasks(): readonly string[] {
    const retryable: string[] = [];
    const entries = Array.from(this.errors.entries());
    for (const [taskId, errors] of entries) {
      // A task is retryable if its last error was retryable
      const lastError = errors[errors.length - 1];
      if (lastError?.retryable) {
        retryable.push(taskId);
      }
    }
    return retryable;
  }

  format(): string {
    const lines: string[] = ['=== Error Summary ==='];

    const entries = Array.from(this.errors.entries());
    for (const [taskId, errors] of entries) {
      lines.push(`\nTask ${taskId}:`);
      for (const error of errors) {
        lines.push(`  - [${error.code}] ${error.message}`);
      }
    }

    lines.push(`\nTotal: ${this.getErrorCount()} error(s) in ${this.errors.size} task(s)`);
    const retryable = this.getRetryableTasks();
    if (retryable.length > 0) {
      lines.push(`Retryable: ${retryable.length} task(s)`);
    }

    return lines.join('\n');
  }
}
