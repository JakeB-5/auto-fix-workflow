/**
 * @module github/update-issue/labels-manager
 * @description Label management utilities for GitHub issues
 */

import type { Octokit } from '@octokit/rest';

/**
 * Add labels to an issue
 *
 * @param octokit - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param labels - Labels to add
 * @returns Array of all labels on the issue after adding
 */
export async function addLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: readonly string[]
): Promise<string[]> {
  if (labels.length === 0) {
    return [];
  }

  const response = await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [...labels],
  });

  return response.data.map((label) =>
    typeof label === 'string' ? label : label.name ?? ''
  );
}

/**
 * Remove labels from an issue
 *
 * @param octokit - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param labels - Labels to remove
 */
export async function removeLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: readonly string[]
): Promise<void> {
  for (const label of labels) {
    try {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error) {
      // Ignore if label doesn't exist
      if ((error as { status?: number }).status !== 404) {
        throw error;
      }
    }
  }
}

/**
 * Sync labels on an issue (replace all labels)
 *
 * @param octokit - Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue number
 * @param labels - New labels to set
 * @returns Array of labels after sync
 */
export async function syncLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: readonly string[]
): Promise<string[]> {
  const response = await octokit.rest.issues.setLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [...labels],
  });

  return response.data.map((label) =>
    typeof label === 'string' ? label : label.name ?? ''
  );
}
