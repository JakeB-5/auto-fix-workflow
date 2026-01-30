/**
 * @module checks/run-checks/retry
 * @description Retry logic utilities
 */

import type { PreviousError, CheckType } from '../../common/types/index.js';

/**
 * Error with retry context
 */
export interface RetryError extends Error {
  previousErrors: PreviousError[];
}

/**
 * Execute function with retry logic
 * @param fn - Function to execute
 * @param maxRetries - Maximum number of retries (total attempts = maxRetries + 1)
 * @param check - Check type (for error tracking)
 * @returns Function result
 * @throws RetryError if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  check?: CheckType,
): Promise<T> {
  const previousErrors: PreviousError[] = [];
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Track error
      if (check) {
        previousErrors.push({
          attempt,
          check,
          error: lastError.message,
          timestamp: new Date().toISOString(),
        });
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries + 1) {
        const retryError = new Error(
          `Failed after ${attempt} attempts: ${lastError.message}`,
        ) as RetryError;
        retryError.previousErrors = previousErrors;
        throw retryError;
      }

      // Wait before retrying (exponential backoff)
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error('Unexpected retry error');
}
