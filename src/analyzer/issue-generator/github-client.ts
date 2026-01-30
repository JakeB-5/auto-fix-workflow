/**
 * @module analyzer/issue-generator/github-client
 * @description GitHub API client for issue creation
 */

import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { GeneratorError } from './types.js';
import { GeneratorErrorCode } from './types.js';

/**
 * Parameters for creating a GitHub issue
 */
export interface CreateIssueParams {
  /** Issue title */
  readonly title: string;
  /** Issue body (Markdown) */
  readonly body: string;
  /** Labels to apply */
  readonly labels: readonly string[];
}

/**
 * Created GitHub issue information
 */
export interface CreatedIssue {
  /** Issue number */
  readonly number: number;
  /** Issue URL */
  readonly url: string;
  /** HTML URL for browser */
  readonly htmlUrl: string;
}

/**
 * GitHub API client for issue operations
 */
export class GitHubClient {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;

  constructor(config: {
    readonly owner: string;
    readonly repo: string;
    readonly token: string;
  }) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.token = config.token;
  }

  /**
   * Create a GitHub issue
   *
   * @param params - Issue creation parameters
   * @returns Result containing created issue info or error
   */
  async createIssue(
    params: CreateIssueParams
  ): Promise<Result<CreatedIssue, GeneratorError>> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.owner}/${this.repo}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: params.title,
            body: params.body,
            labels: params.labels,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return err({
          code: GeneratorErrorCode.GITHUB_API_ERROR,
          message: `GitHub API error: ${response.status} ${response.statusText}`,
          cause: errorData,
        });
      }

      const data = await response.json() as {
        number: number;
        url: string;
        html_url: string;
      };

      return ok({
        number: data.number,
        url: data.url,
        htmlUrl: data.html_url,
      });
    } catch (error) {
      return err({
        code: GeneratorErrorCode.GITHUB_API_ERROR,
        message: 'Failed to create GitHub issue',
        cause: error,
      });
    }
  }

  /**
   * Check if labels exist in the repository
   *
   * @param labels - Labels to check
   * @returns Result containing boolean or error
   */
  async labelsExist(
    labels: readonly string[]
  ): Promise<Result<boolean, GeneratorError>> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.owner}/${this.repo}/labels`,
        {
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        return err({
          code: GeneratorErrorCode.GITHUB_API_ERROR,
          message: `Failed to fetch labels: ${response.status}`,
        });
      }

      const existingLabels = await response.json() as Array<{ name: string }>;
      const existingNames = new Set(
        existingLabels.map((l) => l.name)
      );

      const allExist = labels.every((label) => existingNames.has(label));
      return ok(allExist);
    } catch (error) {
      return err({
        code: GeneratorErrorCode.GITHUB_API_ERROR,
        message: 'Failed to check labels',
        cause: error,
      });
    }
  }

  /**
   * Create a label in the repository
   *
   * @param name - Label name
   * @param color - Label color (hex without #)
   * @param description - Label description
   * @returns Result containing void or error
   */
  async createLabel(
    name: string,
    color: string = '0E8A16',
    description: string = ''
  ): Promise<Result<void, GeneratorError>> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.owner}/${this.repo}/labels`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${this.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            color,
            description,
          }),
        }
      );

      if (!response.ok && response.status !== 422) {
        // 422 = label already exists, which is fine
        return err({
          code: GeneratorErrorCode.GITHUB_API_ERROR,
          message: `Failed to create label: ${response.status}`,
        });
      }

      return ok(undefined);
    } catch (error) {
      return err({
        code: GeneratorErrorCode.GITHUB_API_ERROR,
        message: 'Failed to create label',
        cause: error,
      });
    }
  }
}
