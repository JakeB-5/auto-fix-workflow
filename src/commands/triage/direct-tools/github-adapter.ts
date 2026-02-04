/**
 * @module commands/triage/direct-tools/github-adapter
 * @description Direct GitHub API adapter for standalone CLI mode
 */

import type { GitHubConfig } from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err, isSuccess } from '../../../common/types/result.js';
import type { GitHubToolset } from '../toolset.types.js';
import type { GitHubIssueParams, GitHubIssueResult } from '../types.js';

// Import existing GitHub API module
import { handleCreateIssueTool } from '../../../github/create-issue/tool.js';

/**
 * GitHub direct adapter
 *
 * Wraps the existing GitHub API modules to implement the GitHubToolset interface.
 */
export class GitHubDirectAdapter implements GitHubToolset {
  constructor(private readonly config: GitHubConfig) {}

  async createIssue(
    params: GitHubIssueParams & { owner: string; repo: string }
  ): Promise<Result<GitHubIssueResult, Error>> {
    try {
      const result = await handleCreateIssueTool(
        {
          owner: params.owner,
          repo: params.repo,
          title: params.title,
          body: params.body,
          labels: params.labels ? [...params.labels] : undefined,
          assignees: params.assignees ? [...params.assignees] : undefined,
          milestone: params.milestone,
          checkDuplicates: true,
          autoInferLabels: true,
          useAutoFixLabels: true,
        },
        this.config.token,
        undefined, // asanaConfig not needed here
        this.config.labels
      );

      if (isSuccess(result)) {
        return ok({
          number: result.data.number,
          url: result.data.url,
          id: result.data.number, // GitHub uses number as the primary identifier
        });
      } else {
        // result is Failure<GitHubApiError>
        return err(new Error(result.error.message || 'Failed to create issue'));
      }
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Create GitHub direct adapter
 */
export function createGitHubDirectAdapter(config: GitHubConfig): GitHubDirectAdapter {
  return new GitHubDirectAdapter(config);
}
