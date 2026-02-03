/**
 * @module commands/init/generators/branch
 * @description Git branch creation for auto-fix workflow
 */

import type { Result } from '../../../common/types/index.js';
import { ok, err } from '../../../common/types/index.js';

/**
 * Result of branch creation
 */
export interface BranchCreationResult {
  readonly created: boolean;
  readonly alreadyExists: boolean;
  readonly pushed: boolean;
  readonly branchName: string;
}

/**
 * Default branch name for auto-fix PRs
 */
export const AUTO_FIX_BRANCH = 'autofixing';

/**
 * Create the autofixing branch using simple-git
 *
 * @param projectRoot - Project root path
 * @param pushToRemote - Whether to push the branch to origin
 * @returns Result with creation details
 */
export async function createAutofixBranch(
  projectRoot: string,
  pushToRemote: boolean = true
): Promise<Result<BranchCreationResult, Error>> {
  try {
    // Dynamic import to avoid loading simple-git when not needed
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(projectRoot);

    // Check if branch already exists locally
    const branches = await git.branchLocal();
    const branchExists = branches.all.includes(AUTO_FIX_BRANCH);

    if (branchExists) {
      return ok({
        created: false,
        alreadyExists: true,
        pushed: false,
        branchName: AUTO_FIX_BRANCH,
      });
    }

    // Get current branch to return to
    const currentBranch = branches.current;

    // Create the branch from current HEAD
    await git.checkoutLocalBranch(AUTO_FIX_BRANCH);

    let pushed = false;
    if (pushToRemote) {
      try {
        // Check if remote exists
        const remotes = await git.getRemotes();
        const hasOrigin = remotes.some((r) => r.name === 'origin');

        if (hasOrigin) {
          await git.push('origin', AUTO_FIX_BRANCH, ['--set-upstream']);
          pushed = true;
        }
      } catch (pushError) {
        // Push failed but branch was created locally - don't fail the whole operation
        console.warn(
          `Warning: Could not push ${AUTO_FIX_BRANCH} to origin: ${
            pushError instanceof Error ? pushError.message : String(pushError)
          }`
        );
      }
    }

    // Return to original branch
    await git.checkout(currentBranch);

    return ok({
      created: true,
      alreadyExists: false,
      pushed,
      branchName: AUTO_FIX_BRANCH,
    });
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to create autofixing branch: ${String(error)}`)
    );
  }
}

/**
 * Check if autofixing branch exists
 */
export async function autofixBranchExists(projectRoot: string): Promise<boolean> {
  try {
    const { simpleGit } = await import('simple-git');
    const git = simpleGit(projectRoot);
    const branches = await git.branchLocal();
    return branches.all.includes(AUTO_FIX_BRANCH);
  } catch {
    return false;
  }
}
