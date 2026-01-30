/**
 * @module commands/autofix/mcp-tools/group-issues
 * @description Issue grouping MCP tool
 */

import { z } from 'zod';
import type {
  Issue,
  IssueGroup,
  GroupBy,
  GroupIssuesParams,
  GroupIssuesResult,
  IssuePriority,
} from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err } from '../../../common/types/result.js';

/**
 * Schema for group issues parameters
 */
export const GroupIssuesInputSchema = z.object({
  /** Issues to group */
  issues: z.array(z.object({
    number: z.number(),
    title: z.string(),
    labels: z.array(z.string()),
    context: z.object({
      component: z.string(),
      priority: z.enum(['critical', 'high', 'medium', 'low']),
      relatedFiles: z.array(z.string()),
    }),
  })),
  /** Grouping strategy */
  groupBy: z.enum(['component', 'file', 'label', 'type', 'priority']),
  /** Maximum group size */
  maxGroupSize: z.number().min(1).max(10).optional().default(5),
  /** Minimum group size */
  minGroupSize: z.number().min(1).optional().default(1),
});

export type GroupIssuesInput = z.infer<typeof GroupIssuesInputSchema>;

/**
 * Group issues error
 */
export interface GroupIssuesError {
  readonly code: GroupIssuesErrorCode;
  readonly message: string;
}

export type GroupIssuesErrorCode =
  | 'INVALID_INPUT'
  | 'NO_ISSUES'
  | 'GROUPING_FAILED';

/**
 * Issue Grouping MCP Tool
 *
 * Groups issues based on various strategies
 */
export class GroupIssuesTool {
  /**
   * Tool name for MCP registration
   */
  static readonly toolName = 'group_issues';

  /**
   * Tool description
   */
  static readonly toolDescription = 'Group issues by component, file, label, type, or priority';

  /**
   * Input schema for MCP
   */
  static readonly inputSchema = GroupIssuesInputSchema;

  /**
   * Group issues based on the specified strategy
   */
  groupIssues(
    issues: readonly Issue[],
    params: GroupIssuesParams
  ): Result<GroupIssuesResult, GroupIssuesError> {
    if (issues.length === 0) {
      return err({
        code: 'NO_ISSUES',
        message: 'No issues provided for grouping',
      });
    }

    try {
      const groups = this.createGroups(issues, params);
      const groupedIssueNumbers = new Set(
        groups.flatMap(g => g.issues.map(i => i.number))
      );
      const ungroupedIssues = issues
        .filter(i => !groupedIssueNumbers.has(i.number))
        .map(i => i.number);

      return ok({
        groups,
        ungroupedIssues,
        totalIssues: issues.length,
        totalGroups: groups.length,
      });
    } catch (error) {
      return err({
        code: 'GROUPING_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create groups based on strategy
   */
  private createGroups(
    issues: readonly Issue[],
    params: GroupIssuesParams
  ): IssueGroup[] {
    const maxGroupSize = params.maxGroupSize ?? 5;
    const minGroupSize = params.minGroupSize ?? 1;

    // Group by the specified key
    const grouped = this.groupByKey(issues, params.groupBy);

    // Convert to IssueGroup objects
    const groups: IssueGroup[] = [];

    for (const [key, groupIssues] of Object.entries(grouped)) {
      // Skip groups smaller than minimum
      if (groupIssues.length < minGroupSize) {
        continue;
      }

      // Split large groups
      const chunks = this.chunkArray(groupIssues, maxGroupSize);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk || chunk.length === 0) continue;

        const groupId = chunks.length > 1
          ? `${params.groupBy}-${key}-${i + 1}`
          : `${params.groupBy}-${key}`;

        const groupName = chunks.length > 1
          ? `${key} (Part ${i + 1})`
          : key;

        groups.push(this.createGroup(
          groupId,
          groupName,
          params.groupBy,
          key,
          chunk
        ));
      }
    }

    // Sort groups by priority
    return groups.sort((a, b) => {
      const priorityOrder: Record<IssuePriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Group issues by the specified key
   */
  private groupByKey(
    issues: readonly Issue[],
    groupBy: GroupBy
  ): Record<string, Issue[]> {
    const grouped: Record<string, Issue[]> = {};

    for (const issue of issues) {
      const keys = this.getGroupKeys(issue, groupBy);

      for (const key of keys) {
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(issue);
      }
    }

    return grouped;
  }

  /**
   * Get grouping keys for an issue
   */
  private getGroupKeys(issue: Issue, groupBy: GroupBy): string[] {
    switch (groupBy) {
      case 'component':
        return [issue.context.component];

      case 'file':
        // Group by first related file's directory
        if (issue.context.relatedFiles.length > 0) {
          const dirs = issue.context.relatedFiles
            .map(f => this.getDirectory(f))
            .filter((d): d is string => d !== null);
          return dirs.length > 0 ? [...new Set(dirs)] : ['general'];
        }
        return ['general'];

      case 'label':
        // Group by first significant label
        const significantLabels = issue.labels.filter(l =>
          !l.startsWith('priority:') &&
          !l.startsWith('p') &&
          l !== 'auto-fix'
        );
        return significantLabels.length > 0 ? [significantLabels[0]!] : ['unlabeled'];

      case 'type':
        return [issue.type];

      case 'priority':
        return [issue.context.priority];

      default:
        return ['general'];
    }
  }

  /**
   * Get directory from file path
   */
  private getDirectory(filePath: string): string | null {
    const parts = filePath.split('/');
    if (parts.length > 1) {
      // Return first two levels of directory
      return parts.slice(0, Math.min(2, parts.length - 1)).join('/');
    }
    return null;
  }

  /**
   * Create an IssueGroup from issues
   */
  private createGroup(
    id: string,
    name: string,
    groupBy: GroupBy,
    key: string,
    issues: Issue[]
  ): IssueGroup {
    // Collect all related files
    const relatedFiles = [...new Set(
      issues.flatMap(i => i.context.relatedFiles)
    )];

    // Collect all components
    const components = [...new Set(
      issues.map(i => i.context.component)
    )];

    // Determine highest priority
    const priorityOrder: IssuePriority[] = ['critical', 'high', 'medium', 'low'];
    const highestPriority = priorityOrder.find(p =>
      issues.some(i => i.context.priority === p)
    ) ?? 'medium';

    // Generate branch name
    const branchName = this.generateBranchName(groupBy, key, issues);

    return {
      id,
      name,
      groupBy,
      key,
      issues,
      branchName,
      relatedFiles,
      components,
      priority: highestPriority,
    };
  }

  /**
   * Generate a branch name for the group
   */
  private generateBranchName(
    groupBy: GroupBy,
    key: string,
    issues: Issue[]
  ): string {
    const prefix = 'fix';
    const sanitizedKey = key
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);

    const issueNumbers = issues
      .map(i => i.number)
      .slice(0, 3)
      .join('-');

    const suffix = issues.length > 3 ? '-and-more' : '';

    return `${prefix}/${sanitizedKey}-${issueNumbers}${suffix}`;
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Create tool definition for MCP server
 */
export function createGroupIssuesTool() {
  const tool = new GroupIssuesTool();

  return {
    name: GroupIssuesTool.toolName,
    description: GroupIssuesTool.toolDescription,
    inputSchema: {
      type: 'object' as const,
      properties: {
        issues: {
          type: 'array',
          description: 'Issues to group',
        },
        groupBy: {
          type: 'string',
          enum: ['component', 'file', 'label', 'type', 'priority'],
          description: 'Grouping strategy',
        },
        maxGroupSize: {
          type: 'number',
          description: 'Maximum issues per group',
        },
        minGroupSize: {
          type: 'number',
          description: 'Minimum issues per group',
        },
      },
      required: ['issues', 'groupBy'],
    },
    handler: (params: { issues: Issue[]; groupBy: GroupBy; maxGroupSize?: number; minGroupSize?: number }) => {
      const groupParams: GroupIssuesParams = {
        issueNumbers: params.issues.map(i => i.number),
        groupBy: params.groupBy,
      };
      if (params.maxGroupSize !== undefined) {
        (groupParams as { maxGroupSize?: number }).maxGroupSize = params.maxGroupSize;
      }
      if (params.minGroupSize !== undefined) {
        (groupParams as { minGroupSize?: number }).minGroupSize = params.minGroupSize;
      }
      return tool.groupIssues(params.issues, groupParams);
    },
  };
}
