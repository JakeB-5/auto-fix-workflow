/**
 * @module commands/init/validators
 * @description Token validation utilities for GitHub and Asana
 */

import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';

/**
 * Validation result with username if successful
 */
export interface ValidationResult {
  valid: boolean;
  username?: string;  // If validation succeeded, return username
  error?: string;
}

/**
 * Timeout for network requests (5 seconds)
 */
const VALIDATION_TIMEOUT_MS = 5000;

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Validate GitHub token format (offline check)
 *
 * GitHub token formats:
 * - Personal Access Token (classic): ghp_*
 * - Personal Access Token (fine-grained): github_pat_*
 * - OAuth token: gho_*
 *
 * @param token - GitHub token to validate
 * @returns true if format is valid
 */
export function validateGitHubTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const trimmedToken = token.trim();

  return (
    trimmedToken.startsWith('ghp_') ||
    trimmedToken.startsWith('github_pat_') ||
    trimmedToken.startsWith('gho_')
  );
}

/**
 * Validate Asana token format (offline check)
 *
 * Asana token formats:
 * - Personal Access Token: starts with "1/" or is 32+ characters
 *
 * @param token - Asana token to validate
 * @returns true if format is valid
 */
export function validateAsanaTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const trimmedToken = token.trim();

  return trimmedToken.startsWith('1/') || trimmedToken.length >= 32;
}

/**
 * Validate GitHub token via API
 *
 * Makes a request to GET https://api.github.com/user
 * to verify the token and retrieve the username.
 *
 * @param token - GitHub token to validate
 * @returns Result with ValidationResult containing username on success
 */
export async function validateGitHubToken(
  token: string
): Promise<Result<ValidationResult, Error>> {
  try {
    const controller = createTimeoutController(VALIDATION_TIMEOUT_MS);

    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });

    if (response.status === 200) {
      const data = await response.json() as { login: string };
      return ok({
        valid: true,
        username: data.login,
      });
    }

    if (response.status === 401) {
      return ok({
        valid: false,
        error: 'Invalid GitHub token',
      });
    }

    if (response.status === 403) {
      return ok({
        valid: false,
        error: 'GitHub token lacks required permissions',
      });
    }

    return ok({
      valid: false,
      error: `GitHub API returned status ${response.status}`,
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return err(new Error('GitHub API request timed out'));
      }

      // Network errors should be returned as errors so caller can fall back to format validation
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return err(new Error(`Network error while validating GitHub token: ${error.message}`));
      }

      return err(error);
    }

    return err(new Error('Unknown error while validating GitHub token'));
  }
}

/**
 * Validate Asana token via API
 *
 * Makes a request to GET https://app.asana.com/api/1.0/users/me
 * to verify the token and retrieve the username.
 *
 * @param token - Asana token to validate
 * @returns Result with ValidationResult containing username on success
 */
export async function validateAsanaToken(
  token: string
): Promise<Result<ValidationResult, Error>> {
  try {
    const controller = createTimeoutController(VALIDATION_TIMEOUT_MS);

    const response = await fetch('https://app.asana.com/api/1.0/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 200) {
      const data = await response.json() as { data: { name?: string; email?: string } };
      return ok({
        valid: true,
        username: data.data?.name || data.data?.email,
      });
    }

    if (response.status === 401) {
      return ok({
        valid: false,
        error: 'Invalid Asana token',
      });
    }

    if (response.status === 403) {
      return ok({
        valid: false,
        error: 'Asana token lacks required permissions',
      });
    }

    return ok({
      valid: false,
      error: `Asana API returned status ${response.status}`,
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return err(new Error('Asana API request timed out'));
      }

      // Network errors should be returned as errors so caller can fall back to format validation
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return err(new Error(`Network error while validating Asana token: ${error.message}`));
      }

      return err(error);
    }

    return err(new Error('Unknown error while validating Asana token'));
  }
}

/**
 * Combined validator with fallback to format check on network error
 *
 * This function attempts online validation first, and falls back to
 * offline format validation if network is unavailable.
 *
 * @param type - Token type ('github' or 'asana')
 * @param token - Token to validate
 * @param skipOnlineValidation - If true, only perform format validation
 * @returns Result with ValidationResult
 */
export async function validateToken(
  type: 'github' | 'asana',
  token: string,
  skipOnlineValidation?: boolean
): Promise<Result<ValidationResult, Error>> {
  // If online validation is skipped, use format validation only
  if (skipOnlineValidation) {
    const isValid = type === 'github'
      ? validateGitHubTokenFormat(token)
      : validateAsanaTokenFormat(token);

    return ok({
      valid: isValid,
      error: isValid ? undefined : `Invalid ${type} token format`,
    });
  }

  // Try online validation
  const onlineResult = type === 'github'
    ? await validateGitHubToken(token)
    : await validateAsanaToken(token);

  // If online validation succeeded (no network error), return the result
  if (onlineResult.success) {
    return onlineResult;
  }

  // Network error occurred, fall back to format validation
  const isValid = type === 'github'
    ? validateGitHubTokenFormat(token)
    : validateAsanaTokenFormat(token);

  return ok({
    valid: isValid,
    error: isValid
      ? undefined
      : `Unable to verify token online and format appears invalid`,
  });
}
