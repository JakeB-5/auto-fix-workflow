/**
 * @module commands/init/generators/github-labels
 * @description GitHub Labels creation for auto-fix workflow
 */

import type { Result } from '../../../common/types/index.js';
import { ok, err } from '../../../common/types/index.js';

/**
 * Label definition for auto-fix workflow
 */
export interface LabelDefinition {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

/**
 * Default labels for auto-fix workflow
 */
export const AUTO_FIX_LABELS: readonly LabelDefinition[] = [
  {
    name: 'auto-fix',
    color: '0E8A16',
    description: 'Issue eligible for automated fixing',
  },
  {
    name: 'auto-fix-skip',
    color: 'FBCA04',
    description: 'Skip this issue from auto-fix processing',
  },
  {
    name: 'auto-fix-failed',
    color: 'D73A4A',
    description: 'Auto-fix attempted but failed',
  },
  {
    name: 'auto-fix-processing',
    color: '1D76DB',
    description: 'Currently being processed by auto-fix',
  },
  {
    name: 'sentry',
    color: '362D59',
    description: 'Issue originated from Sentry',
  },
  {
    name: 'asana',
    color: 'F06A6A',
    description: 'Issue originated from Asana',
  },
];

/**
 * Result of label creation
 */
export interface LabelCreationResult {
  readonly created: readonly string[];
  readonly existing: readonly string[];
  readonly failed: readonly { name: string; error: string }[];
}

/**
 * Create GitHub labels using Octokit
 *
 * @param token - GitHub token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Result with creation details
 */
export async function createGitHubLabels(
  token: string,
  owner: string,
  repo: string
): Promise<Result<LabelCreationResult, Error>> {
  try {
    // Dynamic import to avoid loading Octokit when not needed
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });

    const created: string[] = [];
    const existing: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const label of AUTO_FIX_LABELS) {
      try {
        await octokit.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
        created.push(label.name);
      } catch (error) {
        // Check if label already exists (422 error with "already_exists")
        if (
          error instanceof Error &&
          'status' in error &&
          (error as { status: number }).status === 422
        ) {
          existing.push(label.name);
        } else {
          failed.push({
            name: label.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return ok({ created, existing, failed });
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to create GitHub labels: ${String(error)}`)
    );
  }
}

/**
 * Get label names as array
 */
export function getAutoFixLabelNames(): readonly string[] {
  return AUTO_FIX_LABELS.map((label) => label.name);
}
