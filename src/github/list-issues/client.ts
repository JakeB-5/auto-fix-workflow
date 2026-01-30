/**
 * @module github/list-issues/client
 * @description GitHub API client utilities for issue operations
 */

import { Octokit } from '@octokit/rest';

/**
 * Create a GitHub API client with the provided token
 *
 * @param token - GitHub personal access token
 * @returns Configured Octokit instance
 */
export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    // Enable conditional requests for rate limit efficiency
    request: {
      // Use If-None-Match header for ETags
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
    // Automatic retry on rate limit and server errors
    retry: {
      enabled: true,
    },
    // Throttle requests to respect rate limits
    throttle: {
      onRateLimit: (retryAfter: number, options: any, octokit: Octokit) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );

        // Retry twice after hitting rate limit
        if (options.request.retryCount < 2) {
          octokit.log.info(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (retryAfter: number, options: any, octokit: Octokit) => {
        octokit.log.warn(
          `Secondary rate limit hit for request ${options.method} ${options.url}`
        );
        // Don't retry on secondary rate limits
        return false;
      },
    },
  });
}

/**
 * Check if an error is a rate limit error
 *
 * @param error - Error to check
 * @returns True if the error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as any).status === 403 || (error as any).status === 429;
  }
  return false;
}

/**
 * Get rate limit information from the client
 *
 * @param client - Octokit client instance
 * @returns Rate limit information
 */
export async function getRateLimit(client: Octokit): Promise<{
  readonly limit: number;
  readonly remaining: number;
  readonly reset: Date;
}> {
  const { data } = await client.rateLimit.get();
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
  };
}
