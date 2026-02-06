/**
 * @module commands/autofix/claude-cli/timer-utils
 * @description Timer utility functions
 */

/**
 * Sleep utility for retry backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
