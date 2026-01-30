/**
 * @module commands/autofix/fetcher
 * @description Issue fetching and grouping logic
 */

import type { Issue, IssueGroup, GroupBy, Config, GroupIssuesParams } from '../../common/types/index.js';
import type { Result } from '../../common/types/result.js';
import { ok, err, isSuccess } from '../../common/types/result.js';
import { GitHubIssuesTool, GroupIssuesTool, type GitHubIssuesConfig, type FetchIssuesParams } from './mcp-tools/index.js';
import type { AutofixOptions } from './types.js';

/**
 * Fetcher error
 */
export interface FetcherError {
  readonly code: FetcherErrorCode;
  readonly message: string;
  readonly cause?: Error;
}

export type FetcherErrorCode =
  | 'FETCH_FAILED'
  | 'NO_ISSUES'
  | 'GROUPING_FAILED'
  | 'CONFIG_INVALID';

/**
 * Fetch result
 */
export interface FetchResult {
  /** Fetched issues */
  readonly issues: readonly Issue[];
  /** Issue groups */
  readonly groups: readonly IssueGroup[];
  /** Issues that could not be grouped */
  readonly ungroupedIssues: readonly number[];
  /** Total count */
  readonly totalCount: number;
}

/**
 * Issue Fetcher
 *
 * Fetches issues from GitHub and groups them for processing
 */
export class IssueFetcher {
  private readonly githubTool: GitHubIssuesTool;
  private readonly groupTool: GroupIssuesTool;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
    const githubConfig: GitHubIssuesConfig = {
      token: config.github.token,
      owner: config.github.owner,
      repo: config.github.repo,
    };
    if (config.github.apiBaseUrl) {
      (githubConfig as { apiBaseUrl?: string }).apiBaseUrl = config.github.apiBaseUrl;
    }
    if (config.github.autoFixLabel) {
      (githubConfig as { autoFixLabel?: string }).autoFixLabel = config.github.autoFixLabel;
    }
    this.githubTool = new GitHubIssuesTool(githubConfig);
    this.groupTool = new GroupIssuesTool();
  }

  /**
   * Fetch and group issues based on options
   */
  async fetchAndGroup(
    options: AutofixOptions
  ): Promise<Result<FetchResult, FetcherError>> {
    // Fetch issues
    const fetchResult = await this.fetchIssues(options);
    if (!isSuccess(fetchResult)) {
      return err({
        code: 'FETCH_FAILED',
        message: fetchResult.error.message,
      });
    }

    const issues = fetchResult.data;

    if (issues.length === 0) {
      return err({
        code: 'NO_ISSUES',
        message: 'No issues found matching the criteria',
      });
    }

    // Group issues
    const groupParams: GroupIssuesParams = {
      issueNumbers: issues.map(i => i.number),
      groupBy: options.groupBy,
    };
    if (options.labels) {
      (groupParams as { labels?: readonly string[] }).labels = options.labels;
    }
    if (options.excludeLabels) {
      (groupParams as { excludeLabels?: readonly string[] }).excludeLabels = options.excludeLabels;
    }
    const groupResult = this.groupTool.groupIssues(issues, groupParams);

    if (!isSuccess(groupResult)) {
      return err({
        code: 'GROUPING_FAILED',
        message: groupResult.error.message,
      });
    }

    return ok({
      issues,
      groups: groupResult.data.groups,
      ungroupedIssues: groupResult.data.ungroupedIssues,
      totalCount: issues.length,
    });
  }

  /**
   * Fetch issues only
   */
  async fetchIssues(
    options: AutofixOptions
  ): Promise<Result<Issue[], FetcherError>> {
    const fetchParams: FetchIssuesParams = {
      state: 'open',
      limit: 50,
    };
    if (options.issueNumbers) {
      (fetchParams as { issueNumbers?: number[] }).issueNumbers = [...options.issueNumbers];
    }
    if (options.labels) {
      (fetchParams as { labels?: string[] }).labels = [...options.labels];
    }
    if (options.excludeLabels) {
      (fetchParams as { excludeLabels?: string[] }).excludeLabels = [...options.excludeLabels];
    }
    const result = await this.githubTool.fetchIssues(fetchParams);

    if (!isSuccess(result)) {
      return err({
        code: 'FETCH_FAILED',
        message: result.error.message,
      });
    }

    return ok([...result.data.issues]);
  }

  /**
   * Group issues with custom strategy
   */
  groupIssues(
    issues: readonly Issue[],
    groupBy: GroupBy,
    maxGroupSize: number = 5
  ): Result<IssueGroup[], FetcherError> {
    const result = this.groupTool.groupIssues(issues, {
      issueNumbers: issues.map(i => i.number),
      groupBy,
      maxGroupSize,
    });

    if (!isSuccess(result)) {
      return err({
        code: 'GROUPING_FAILED',
        message: result.error.message,
      });
    }

    return ok([...result.data.groups]);
  }

  /**
   * Re-group failed groups with smaller size
   */
  regroupFailed(
    groups: readonly IssueGroup[],
    maxGroupSize: number = 1
  ): IssueGroup[] {
    const allIssues = groups.flatMap(g => g.issues);

    // If already at minimum size, return as-is
    if (maxGroupSize <= 1) {
      return allIssues.map((issue, index) => ({
        id: `single-${issue.number}`,
        name: `Issue #${issue.number}`,
        groupBy: 'component' as GroupBy,
        key: String(issue.number),
        issues: [issue],
        branchName: `fix/issue-${issue.number}`,
        relatedFiles: [...issue.context.relatedFiles],
        components: [issue.context.component],
        priority: issue.context.priority,
      }));
    }

    // Re-group with smaller size
    const result = this.groupTool.groupIssues(allIssues, {
      issueNumbers: allIssues.map(i => i.number),
      groupBy: 'component',
      maxGroupSize,
    });

    if (!isSuccess(result)) {
      // Fallback to single-issue groups
      return this.regroupFailed(groups, 1);
    }

    return [...result.data.groups];
  }

  /**
   * Filter issues by criteria
   */
  filterIssues(
    issues: readonly Issue[],
    criteria: FilterCriteria
  ): Issue[] {
    return issues.filter(issue => {
      // Check labels
      if (criteria.mustHaveLabels?.length) {
        const hasAll = criteria.mustHaveLabels.every(l =>
          issue.labels.includes(l)
        );
        if (!hasAll) return false;
      }

      // Check excluded labels
      if (criteria.mustNotHaveLabels?.length) {
        const hasAny = criteria.mustNotHaveLabels.some(l =>
          issue.labels.includes(l)
        );
        if (hasAny) return false;
      }

      // Check components
      if (criteria.components?.length) {
        if (!criteria.components.includes(issue.context.component)) {
          return false;
        }
      }

      // Check priority
      if (criteria.minPriority) {
        const priorityOrder = ['low', 'medium', 'high', 'critical'];
        const issuePriorityIndex = priorityOrder.indexOf(issue.context.priority);
        const minPriorityIndex = priorityOrder.indexOf(criteria.minPriority);
        if (issuePriorityIndex < minPriorityIndex) {
          return false;
        }
      }

      // Check types
      if (criteria.types?.length) {
        if (!criteria.types.includes(issue.type)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort issues by priority and creation date
   */
  sortIssues(issues: readonly Issue[]): Issue[] {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...issues].sort((a, b) => {
      // First by priority
      const priorityDiff =
        priorityOrder[a.context.priority]! - priorityOrder[b.context.priority]!;
      if (priorityDiff !== 0) return priorityDiff;

      // Then by creation date (older first)
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
}

/**
 * Filter criteria for issues
 */
export interface FilterCriteria {
  readonly mustHaveLabels?: readonly string[];
  readonly mustNotHaveLabels?: readonly string[];
  readonly components?: readonly string[];
  readonly minPriority?: 'low' | 'medium' | 'high' | 'critical';
  readonly types?: readonly string[];
}

/**
 * Create a fetcher instance
 */
export function createFetcher(config: Config): IssueFetcher {
  return new IssueFetcher(config);
}
