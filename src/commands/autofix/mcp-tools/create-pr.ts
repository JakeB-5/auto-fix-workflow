/**
 * @module commands/autofix/mcp-tools/create-pr
 * @description PR creation MCP tool
 */

import { z } from 'zod';
import type {
  PullRequest,
  PRStatus,
  CreatePRParams,
  Issue,
} from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err } from '../../../common/types/result.js';

/**
 * Schema for create PR parameters
 */
export const CreatePRInputSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string(),
  headBranch: z.string(),
  baseBranch: z.string().optional().default('main'),
  linkedIssues: z.array(z.number()).optional(),
  labels: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  draft: z.boolean().optional().default(false),
});

export type CreatePRInput = z.infer<typeof CreatePRInputSchema>;

/**
 * PR creation error
 */
export interface CreatePRError {
  readonly code: CreatePRErrorCode;
  readonly message: string;
  readonly cause?: Error | undefined;
}

export type CreatePRErrorCode =
  | 'AUTH_FAILED'
  | 'BRANCH_NOT_FOUND'
  | 'PR_EXISTS'
  | 'VALIDATION_FAILED'
  | 'API_ERROR'
  | 'UNKNOWN';

/**
 * GitHub configuration for PR creation
 */
export interface CreatePRConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly apiBaseUrl?: string | undefined;
}

/**
 * Create PR MCP Tool
 *
 * Creates pull requests on GitHub
 */
export class CreatePRTool {
  private readonly config: CreatePRConfig;

  constructor(config: CreatePRConfig) {
    this.config = config;
  }

  /**
   * Tool name for MCP registration
   */
  static readonly toolName = 'create_pr';

  /**
   * Tool description
   */
  static readonly toolDescription = 'Create a pull request on GitHub';

  /**
   * Create a pull request
   */
  async createPR(
    params: CreatePRParams
  ): Promise<Result<PullRequest, CreatePRError>> {
    try {
      const baseUrl = this.config.apiBaseUrl ?? 'https://api.github.com';
      const url = `${baseUrl}/repos/${this.config.owner}/${this.config.repo}/pulls`;

      // Build the request body
      const body = this.buildPRBody(params);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: params.title,
          body,
          head: params.headBranch,
          base: params.baseBranch ?? 'main',
          draft: params.draft ?? false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        return err(this.mapApiError(response.status, errorData.message));
      }

      const data = await response.json() as GitHubPRResponse;

      // Add labels if specified
      if (params.labels && params.labels.length > 0) {
        await this.addLabels(data.number, params.labels);
      }

      // Request reviewers if specified
      if (params.reviewers && params.reviewers.length > 0) {
        await this.requestReviewers(data.number, params.reviewers);
      }

      return ok(this.mapPRResponse(data, params.linkedIssues ?? []));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: CreatePRError = {
        code: 'UNKNOWN',
        message: errorMessage,
      };
      if (error instanceof Error) {
        (result as { cause?: Error }).cause = error;
      }
      return err(result);
    }
  }

  /**
   * Generate PR from issue group
   */
  async createPRFromIssues(
    issues: readonly Issue[],
    branchName: string,
    baseBranch: string = 'main'
  ): Promise<Result<PullRequest, CreatePRError>> {
    const title = this.generatePRTitle(issues);
    const body = this.generatePRBodyFromIssues(issues);
    const linkedIssues = issues.map(i => i.number);
    const labels = this.extractLabels(issues);

    const params: CreatePRParams = {
      title,
      body,
      headBranch: branchName,
      baseBranch,
      draft: false,
    };
    // Set optional arrays only if they have values
    if (linkedIssues.length > 0) {
      (params as { linkedIssues?: readonly number[] }).linkedIssues = linkedIssues;
    }
    if (labels.length > 0) {
      (params as { labels?: readonly string[] }).labels = labels;
    }

    return this.createPR(params);
  }

  /**
   * Build PR body with linked issues
   */
  private buildPRBody(params: CreatePRParams): string {
    let body = params.body;

    // Add linked issues section
    if (params.linkedIssues && params.linkedIssues.length > 0) {
      const closesSection = params.linkedIssues
        .map(num => `Closes #${num}`)
        .join('\n');

      body = `${body}\n\n---\n\n${closesSection}`;
    }

    // Add auto-generated note
    body = `${body}\n\n---\n\n*This PR was auto-generated by auto-fix-workflow*`;

    return body;
  }

  /**
   * Generate PR title from issues
   */
  private generatePRTitle(issues: readonly Issue[]): string {
    if (issues.length === 1) {
      const issue = issues[0]!;
      return `fix: ${issue.title}`;
    }

    // Multiple issues - summarize
    const components = [...new Set(issues.map(i => i.context.component))];
    if (components.length === 1) {
      return `fix(${components[0]}): address ${issues.length} issues`;
    }

    return `fix: address ${issues.length} issues`;
  }

  /**
   * Generate PR body from issues
   */
  private generatePRBodyFromIssues(issues: readonly Issue[]): string {
    const sections: string[] = [];

    // Summary section
    sections.push('## Summary\n');
    sections.push(`This PR addresses ${issues.length} issue(s):\n`);

    for (const issue of issues) {
      sections.push(`- #${issue.number}: ${issue.title}`);
    }

    // Changes section
    sections.push('\n## Changes\n');
    sections.push('*Auto-generated fixes for the following issues:*\n');

    for (const issue of issues) {
      sections.push(`### Issue #${issue.number}\n`);
      sections.push(`**${issue.title}**\n`);
      if (issue.suggestedFix) {
        sections.push(`${issue.suggestedFix.description}\n`);
      }
    }

    // Testing section
    sections.push('\n## Testing\n');
    sections.push('- [ ] Tests pass locally');
    sections.push('- [ ] Lint checks pass');
    sections.push('- [ ] Type checks pass');

    return sections.join('\n');
  }

  /**
   * Extract unique labels from issues
   */
  private extractLabels(issues: readonly Issue[]): string[] {
    const labels = new Set<string>();

    // Add auto-fix label
    labels.add('auto-fix');

    // Add type labels
    for (const issue of issues) {
      labels.add(issue.type);
    }

    // Add priority if any high priority
    const hasCritical = issues.some(i => i.context.priority === 'critical');
    const hasHigh = issues.some(i => i.context.priority === 'high');

    if (hasCritical) {
      labels.add('priority:critical');
    } else if (hasHigh) {
      labels.add('priority:high');
    }

    return [...labels];
  }

  /**
   * Add labels to PR
   */
  private async addLabels(prNumber: number, labels: readonly string[]): Promise<void> {
    const baseUrl = this.config.apiBaseUrl ?? 'https://api.github.com';
    const url = `${baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues/${prNumber}/labels`;

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels }),
    });
  }

  /**
   * Request reviewers for PR
   */
  private async requestReviewers(
    prNumber: number,
    reviewers: readonly string[]
  ): Promise<void> {
    const baseUrl = this.config.apiBaseUrl ?? 'https://api.github.com';
    const url = `${baseUrl}/repos/${this.config.owner}/${this.config.repo}/pulls/${prNumber}/requested_reviewers`;

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reviewers }),
    });
  }

  /**
   * Map GitHub PR response to PullRequest
   */
  private mapPRResponse(
    data: GitHubPRResponse,
    linkedIssues: readonly number[]
  ): PullRequest {
    return {
      number: data.number,
      title: data.title,
      body: data.body ?? '',
      state: this.mapPRState(data.state, data.draft),
      headBranch: data.head.ref,
      baseBranch: data.base.ref,
      linkedIssues,
      labels: data.labels.map(l => l.name),
      reviewers: data.requested_reviewers?.map(r => r.login) ?? [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      url: data.html_url,
      changedFiles: data.changed_files ?? 0,
      additions: data.additions ?? 0,
      deletions: data.deletions ?? 0,
    };
  }

  /**
   * Map PR state
   */
  private mapPRState(state: string, draft?: boolean): PRStatus {
    if (draft) return 'draft';
    if (state === 'open') return 'open';
    if (state === 'closed') return 'closed';
    if (state === 'merged') return 'merged';
    return 'open';
  }

  /**
   * Map API error to CreatePRError
   */
  private mapApiError(status: number, message?: string): CreatePRError {
    switch (status) {
      case 401:
        return { code: 'AUTH_FAILED', message: 'GitHub authentication failed' };
      case 404:
        return { code: 'BRANCH_NOT_FOUND', message: message ?? 'Branch or repository not found' };
      case 422:
        if (message?.includes('pull request already exists')) {
          return { code: 'PR_EXISTS', message: 'A pull request already exists for this branch' };
        }
        return { code: 'VALIDATION_FAILED', message: message ?? 'Validation failed' };
      default:
        return { code: 'API_ERROR', message: message ?? `GitHub API error: ${status}` };
    }
  }
}

/**
 * GitHub PR API response type
 */
interface GitHubPRResponse {
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft?: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  head: { ref: string };
  base: { ref: string };
  labels: Array<{ name: string }>;
  requested_reviewers?: Array<{ login: string }>;
  changed_files?: number;
  additions?: number;
  deletions?: number;
}

/**
 * Create tool definition for MCP server
 */
export function createCreatePRTool(config: CreatePRConfig) {
  const tool = new CreatePRTool(config);

  return {
    name: CreatePRTool.toolName,
    description: CreatePRTool.toolDescription,
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'PR title',
        },
        body: {
          type: 'string',
          description: 'PR description',
        },
        headBranch: {
          type: 'string',
          description: 'Source branch',
        },
        baseBranch: {
          type: 'string',
          description: 'Target branch',
        },
        linkedIssues: {
          type: 'array',
          items: { type: 'number' },
          description: 'Issue numbers to link',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to add',
        },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Reviewers to request',
        },
        draft: {
          type: 'boolean',
          description: 'Create as draft PR',
        },
      },
      required: ['title', 'body', 'headBranch'],
    },
    handler: async (params: CreatePRInput) => {
      const prParams: CreatePRParams = {
        title: params.title,
        body: params.body,
        headBranch: params.headBranch,
        baseBranch: params.baseBranch,
        draft: params.draft,
      };
      if (params.linkedIssues && params.linkedIssues.length > 0) {
        (prParams as { linkedIssues?: readonly number[] }).linkedIssues = params.linkedIssues;
      }
      if (params.labels && params.labels.length > 0) {
        (prParams as { labels?: readonly string[] }).labels = params.labels;
      }
      if (params.reviewers && params.reviewers.length > 0) {
        (prParams as { reviewers?: readonly string[] }).reviewers = params.reviewers;
      }
      return tool.createPR(prParams);
    },
  };
}
