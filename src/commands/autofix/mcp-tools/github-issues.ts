/**
 * @module commands/autofix/mcp-tools/github-issues
 * @description GitHub Issues MCP tool for fetching and managing issues
 */

import { z } from 'zod';
import type { Issue, IssueStatus, IssueType, IssuePriority, IssueSource } from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err } from '../../../common/types/result.js';

/**
 * Schema for fetch issues parameters
 */
export const FetchIssuesParamsSchema = z.object({
  /** Issue numbers to fetch (empty = fetch by labels) */
  issueNumbers: z.array(z.number()).optional(),
  /** Labels to filter by */
  labels: z.array(z.string()).optional(),
  /** Labels to exclude */
  excludeLabels: z.array(z.string()).optional(),
  /** Issue state filter */
  state: z.enum(['open', 'closed', 'all']).optional().default('open'),
  /** Maximum issues to fetch */
  limit: z.number().min(1).max(100).optional().default(50),
});

export type FetchIssuesParams = z.infer<typeof FetchIssuesParamsSchema>;

/**
 * Fetch issues result
 */
export interface FetchIssuesResult {
  /** Fetched issues */
  readonly issues: readonly Issue[];
  /** Total count (may exceed fetched) */
  readonly totalCount: number;
  /** Whether more issues exist */
  readonly hasMore: boolean;
}

/**
 * GitHub Issues MCP Tool error
 */
export interface GitHubIssuesError {
  /** Error code */
  readonly code: GitHubIssuesErrorCode;
  /** Error message */
  readonly message: string;
  /** Original error */
  readonly cause?: Error;
}

export type GitHubIssuesErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'INVALID_PARAMS'
  | 'UNKNOWN';

/**
 * GitHub configuration for the tool
 */
export interface GitHubIssuesConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly apiBaseUrl?: string | undefined;
  readonly autoFixLabel?: string | undefined;
}

/**
 * GitHub Issues MCP Tool
 *
 * Provides functionality to fetch and manage GitHub issues
 */
export class GitHubIssuesTool {
  private readonly config: GitHubIssuesConfig;

  constructor(config: GitHubIssuesConfig) {
    this.config = config;
  }

  /**
   * Tool name for MCP registration
   */
  static readonly toolName = 'github_issues_fetch';

  /**
   * Tool description for MCP
   */
  static readonly toolDescription = 'Fetch GitHub issues for auto-fix processing';

  /**
   * Input schema for MCP
   */
  static readonly inputSchema = FetchIssuesParamsSchema;

  /**
   * Fetch issues from GitHub
   */
  async fetchIssues(
    params: FetchIssuesParams
  ): Promise<Result<FetchIssuesResult, GitHubIssuesError>> {
    const validation = FetchIssuesParamsSchema.safeParse(params);
    if (!validation.success) {
      return err({
        code: 'INVALID_PARAMS',
        message: `Invalid parameters: ${validation.error.message}`,
      });
    }

    const validParams = validation.data;

    try {
      // If specific issue numbers provided, fetch those
      if (validParams.issueNumbers && validParams.issueNumbers.length > 0) {
        const issues = await this.fetchIssuesByNumbers(validParams.issueNumbers);
        return ok({
          issues,
          totalCount: issues.length,
          hasMore: false,
        });
      }

      // Otherwise, fetch by labels
      const issues = await this.fetchIssuesByLabels(
        validParams.labels ?? [this.config.autoFixLabel ?? 'auto-fix'],
        validParams.excludeLabels ?? [],
        validParams.state,
        validParams.limit
      );

      return ok({
        issues,
        totalCount: issues.length,
        hasMore: issues.length >= validParams.limit,
      });
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * Fetch issues by their numbers
   */
  private async fetchIssuesByNumbers(
    issueNumbers: readonly number[]
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    for (const num of issueNumbers) {
      const issue = await this.fetchSingleIssue(num);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Fetch a single issue by number
   */
  private async fetchSingleIssue(issueNumber: number): Promise<Issue | null> {
    const baseUrl = this.config.apiBaseUrl ?? 'https://api.github.com';
    const url = `${baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GitHubIssueResponse;
    return this.mapGitHubIssue(data);
  }

  /**
   * Fetch issues by labels
   */
  private async fetchIssuesByLabels(
    labels: readonly string[],
    excludeLabels: readonly string[],
    state: 'open' | 'closed' | 'all',
    limit: number
  ): Promise<Issue[]> {
    const baseUrl = this.config.apiBaseUrl ?? 'https://api.github.com';
    const labelsParam = labels.join(',');
    const url = `${baseUrl}/repos/${this.config.owner}/${this.config.repo}/issues?labels=${encodeURIComponent(labelsParam)}&state=${state}&per_page=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GitHubIssueResponse[];

    // Filter out excluded labels and PRs
    const filteredData = data.filter(issue => {
      // Skip pull requests
      if (issue.pull_request) {
        return false;
      }

      // Skip if has excluded label
      const issueLabels = issue.labels.map(l =>
        typeof l === 'string' ? l : l.name
      );
      return !excludeLabels.some(excludeLabel =>
        issueLabels.includes(excludeLabel)
      );
    });

    return filteredData.map(issue => this.mapGitHubIssue(issue));
  }

  /**
   * Map GitHub API response to Issue type
   */
  private mapGitHubIssue(data: GitHubIssueResponse): Issue {
    const labels = data.labels.map(l => typeof l === 'string' ? l : l.name);

    return {
      number: data.number,
      title: data.title,
      body: data.body ?? '',
      state: this.mapState(data.state),
      type: this.inferType(labels),
      labels,
      assignees: data.assignees?.map(a => a.login) ?? [],
      context: {
        component: this.inferComponent(labels, data.title),
        priority: this.inferPriority(labels),
        relatedFiles: this.extractRelatedFiles(data.body ?? ''),
        relatedSymbols: [],
        source: 'github' as IssueSource,
        sourceId: String(data.id),
        sourceUrl: data.html_url,
      },
      acceptanceCriteria: [],
      relatedIssues: this.extractRelatedIssues(data.body ?? ''),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      url: data.html_url,
    };
  }

  /**
   * Map GitHub state to IssueStatus
   */
  private mapState(state: string): IssueStatus {
    switch (state) {
      case 'open':
        return 'open';
      case 'closed':
        return 'closed';
      default:
        return 'open';
    }
  }

  /**
   * Infer issue type from labels
   */
  private inferType(labels: string[]): IssueType {
    const lowerLabels = labels.map(l => l.toLowerCase());

    if (lowerLabels.some(l => l.includes('bug'))) return 'bug';
    if (lowerLabels.some(l => l.includes('feature'))) return 'feature';
    if (lowerLabels.some(l => l.includes('refactor'))) return 'refactor';
    if (lowerLabels.some(l => l.includes('doc'))) return 'docs';
    if (lowerLabels.some(l => l.includes('test'))) return 'test';
    if (lowerLabels.some(l => l.includes('chore'))) return 'chore';

    return 'bug'; // Default
  }

  /**
   * Infer component from labels or title
   */
  private inferComponent(labels: string[], title: string): string {
    // Check for component labels (e.g., "component:auth", "area/api")
    for (const label of labels) {
      if (label.startsWith('component:')) {
        return label.replace('component:', '');
      }
      if (label.startsWith('area/')) {
        return label.replace('area/', '');
      }
    }

    // Try to extract from title (e.g., "[Auth] Fix login")
    const bracketMatch = title.match(/^\[([^\]]+)\]/);
    if (bracketMatch?.[1]) {
      return bracketMatch[1].toLowerCase();
    }

    return 'general';
  }

  /**
   * Infer priority from labels
   */
  private inferPriority(labels: string[]): IssuePriority {
    const lowerLabels = labels.map(l => l.toLowerCase());

    if (lowerLabels.some(l => l.includes('critical') || l.includes('p0'))) return 'critical';
    if (lowerLabels.some(l => l.includes('high') || l.includes('p1'))) return 'high';
    if (lowerLabels.some(l => l.includes('medium') || l.includes('p2'))) return 'medium';
    if (lowerLabels.some(l => l.includes('low') || l.includes('p3'))) return 'low';

    return 'medium'; // Default
  }

  /**
   * Extract file paths from issue body
   */
  private extractRelatedFiles(body: string): string[] {
    const files: string[] = [];

    // Match file paths in code blocks or backticks
    const pathRegex = /(?:^|\s|`)((?:src|lib|app|packages?)\/[\w\-./]+\.\w+)/gm;
    let match;
    while ((match = pathRegex.exec(body)) !== null) {
      if (match[1]) {
        files.push(match[1]);
      }
    }

    return [...new Set(files)];
  }

  /**
   * Extract related issue numbers from body
   */
  private extractRelatedIssues(body: string): number[] {
    const issues: number[] = [];

    // Match #123 patterns
    const issueRegex = /#(\d+)/g;
    let match;
    while ((match = issueRegex.exec(body)) !== null) {
      const num = parseInt(match[1] ?? '', 10);
      if (!isNaN(num)) {
        issues.push(num);
      }
    }

    return [...new Set(issues)];
  }

  /**
   * Map caught error to GitHubIssuesError
   */
  private mapError(error: unknown): GitHubIssuesError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('401') || message.includes('unauthorized')) {
        return { code: 'AUTH_FAILED', message: 'GitHub authentication failed', cause: error };
      }
      if (message.includes('403') || message.includes('rate limit')) {
        return { code: 'RATE_LIMITED', message: 'GitHub API rate limit exceeded', cause: error };
      }
      if (message.includes('404')) {
        return { code: 'NOT_FOUND', message: 'Repository or issue not found', cause: error };
      }
      if (message.includes('network') || message.includes('fetch')) {
        return { code: 'NETWORK_ERROR', message: 'Network error connecting to GitHub', cause: error };
      }

      return { code: 'UNKNOWN', message: error.message, cause: error };
    }

    return { code: 'UNKNOWN', message: String(error) };
  }
}

/**
 * GitHub API issue response type
 */
interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<string | { name: string }>;
  assignees?: Array<{ login: string }>;
  pull_request?: unknown;
}

/**
 * Create tool definition for MCP server
 */
export function createGitHubIssuesTool(config: GitHubIssuesConfig) {
  const tool = new GitHubIssuesTool(config);

  return {
    name: GitHubIssuesTool.toolName,
    description: GitHubIssuesTool.toolDescription,
    inputSchema: {
      type: 'object' as const,
      properties: {
        issueNumbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Specific issue numbers to fetch',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to filter issues',
        },
        excludeLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to exclude',
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          description: 'Issue state filter',
        },
        limit: {
          type: 'number',
          description: 'Maximum issues to fetch',
        },
      },
    },
    handler: async (params: FetchIssuesParams) => {
      return tool.fetchIssues(params);
    },
  };
}
