/**
 * @module commands/autofix/dry-run
 * @description Dry-run mode implementation
 */

import type { IssueGroup, Issue, Config } from '../../common/types/index.js';
import type {
  DryRunOperation,
  DryRunGroupResult,
  AutofixResult,
  GroupResult,
  AutofixOptions,
} from './types.js';
import { createAutofixResult, calculateStats } from './report.js';

/**
 * Dry-run executor
 *
 * Simulates autofix operations without making actual changes
 */
export class DryRunExecutor {
  private readonly config: Config;
  private readonly options: AutofixOptions;

  constructor(config: Config, options: AutofixOptions) {
    this.config = config;
    this.options = options;
  }

  /**
   * Execute dry-run for all groups
   */
  execute(groups: readonly IssueGroup[]): AutofixResult {
    const startTime = new Date();
    const groupResults: GroupResult[] = [];

    for (const group of groups) {
      const dryRunResult = this.simulateGroup(group);
      groupResults.push(this.toDryRunGroupResult(dryRunResult, group));
    }

    return createAutofixResult(groupResults, true, startTime);
  }

  /**
   * Simulate processing a single group
   */
  simulateGroup(group: IssueGroup): DryRunGroupResult {
    const operations: DryRunOperation[] = [];

    // Simulate worktree creation
    operations.push({
      type: 'worktree',
      description: `Create worktree for branch ${group.branchName}`,
      affects: [
        `${this.config.worktree.baseDir}/${this.config.worktree.prefix ?? 'autofix-'}${group.branchName}`,
      ],
      simulatedResult: {
        path: `${this.config.worktree.baseDir}/${this.config.worktree.prefix ?? 'autofix-'}${group.branchName}`,
        branch: group.branchName,
        status: 'ready',
      },
    });

    // Simulate branch creation
    operations.push({
      type: 'branch',
      description: `Create branch ${group.branchName} from ${this.options.baseBranch ?? 'main'}`,
      affects: [group.branchName],
      simulatedResult: {
        name: group.branchName,
        base: this.options.baseBranch ?? 'main',
      },
    });

    // Simulate commits
    const commitMessage = this.generateCommitMessage(group);
    operations.push({
      type: 'commit',
      description: `Commit changes: ${commitMessage.split('\n')[0]}`,
      affects: group.relatedFiles.length > 0
        ? [...group.relatedFiles]
        : ['(files to be determined)'],
      simulatedResult: {
        message: commitMessage,
        files: group.relatedFiles.length,
      },
    });

    // Simulate PR creation
    const prTitle = this.generatePRTitle(group);
    operations.push({
      type: 'pr',
      description: `Create PR: ${prTitle}`,
      affects: group.issues.map(i => `Issue #${i.number}`),
      simulatedResult: {
        title: prTitle,
        base: this.options.baseBranch ?? 'main',
        head: group.branchName,
        linkedIssues: group.issues.map(i => i.number),
        draft: false,
      },
    });

    // Simulate issue updates
    for (const issue of group.issues) {
      operations.push({
        type: 'issue_update',
        description: `Update issue #${issue.number}: add labels and comment`,
        affects: [`Issue #${issue.number}`],
        simulatedResult: {
          issueNumber: issue.number,
          addLabels: ['auto-fixed'],
          removeLabels: ['auto-fix', 'in-progress'],
          comment: 'Auto-fix PR created',
        },
      });
    }

    // Predict outcome
    const prediction = this.predictOutcome(group);

    const result: DryRunGroupResult = {
      group,
      operations,
      predictedOutcome: prediction.outcome,
    };
    if (prediction.reason) {
      (result as { outcomeReason?: string }).outcomeReason = prediction.reason;
    }
    return result;
  }

  /**
   * Convert dry-run result to GroupResult
   */
  private toDryRunGroupResult(
    dryRun: DryRunGroupResult,
    group: IssueGroup
  ): GroupResult {
    const now = new Date();

    const result: GroupResult = {
      group,
      status: dryRun.predictedOutcome === 'failure' ? 'failed' : 'completed',
      attempts: 1,
      durationMs: 0,
      startedAt: now,
      completedAt: now,
    };

    if (dryRun.predictedOutcome === 'failure' && dryRun.outcomeReason) {
      (result as { error?: string }).error = dryRun.outcomeReason;
    }

    return result;
  }

  /**
   * Generate commit message for group
   */
  private generateCommitMessage(group: IssueGroup): string {
    const issueRefs = group.issues.map(i => `#${i.number}`).join(', ');

    if (group.issues.length === 1) {
      const issue = group.issues[0]!;
      return `fix(${issue.context.component}): ${issue.title}\n\nFixes ${issueRefs}`;
    }

    return `fix(${group.components[0] ?? 'general'}): address ${group.issues.length} issues\n\nFixes ${issueRefs}`;
  }

  /**
   * Generate PR title for group
   */
  private generatePRTitle(group: IssueGroup): string {
    if (group.issues.length === 1) {
      return `fix: ${group.issues[0]!.title}`;
    }

    const component = group.components[0];
    if (component) {
      return `fix(${component}): address ${group.issues.length} issues`;
    }

    return `fix: address ${group.issues.length} issues`;
  }

  /**
   * Predict outcome based on group characteristics
   */
  private predictOutcome(group: IssueGroup): { outcome: 'success' | 'failure' | 'unknown'; reason?: string } {
    // Check for potential issues

    // Too many issues in one group
    if (group.issues.length > 5) {
      return {
        outcome: 'unknown',
        reason: 'Large number of issues may be difficult to fix together',
      };
    }

    // Mixed priorities
    const priorities = new Set(group.issues.map(i => i.context.priority));
    if (priorities.size > 2) {
      return {
        outcome: 'unknown',
        reason: 'Mixed priority issues may have conflicting requirements',
      };
    }

    // No related files identified
    if (group.relatedFiles.length === 0) {
      return {
        outcome: 'unknown',
        reason: 'No related files identified - AI may have difficulty locating the issue',
      };
    }

    // Multiple components
    if (group.components.length > 2) {
      return {
        outcome: 'unknown',
        reason: 'Changes span multiple components - may require careful review',
      };
    }

    // Looks reasonable
    return {
      outcome: 'success',
    };
  }

  /**
   * Format dry-run output
   */
  formatOutput(results: readonly DryRunGroupResult[]): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('DRY-RUN PREVIEW');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push('The following operations would be performed:');
    lines.push('');

    for (const result of results) {
      lines.push(`GROUP: ${result.group.name}`);
      lines.push(`Issues: ${result.group.issues.map(i => `#${i.number}`).join(', ')}`);
      lines.push(`Predicted Outcome: ${result.predictedOutcome.toUpperCase()}`);
      if (result.outcomeReason) {
        lines.push(`Reason: ${result.outcomeReason}`);
      }
      lines.push('');
      lines.push('Operations:');

      for (const op of result.operations) {
        lines.push(`  [${op.type.toUpperCase()}] ${op.description}`);
        if (op.affects.length > 0) {
          lines.push(`    Affects: ${op.affects.join(', ')}`);
        }
      }

      lines.push('');
      lines.push('-'.repeat(40));
      lines.push('');
    }

    lines.push('');
    lines.push('NOTE: This is a dry-run. No changes have been made.');
    lines.push('Run without --dry-run to apply these changes.');
    lines.push('');

    return lines.join('\n');
  }
}

/**
 * Create dry-run executor
 */
export function createDryRunExecutor(
  config: Config,
  options: AutofixOptions
): DryRunExecutor {
  return new DryRunExecutor(config, options);
}

/**
 * Execute dry-run and return formatted output
 */
export function executeDryRun(
  groups: readonly IssueGroup[],
  config: Config,
  options: AutofixOptions
): { result: AutofixResult; preview: string } {
  const executor = new DryRunExecutor(config, options);
  const dryRunResults = groups.map(g => executor.simulateGroup(g));

  return {
    result: executor.execute(groups),
    preview: executor.formatOutput(dryRunResults),
  };
}

/**
 * Check if operation would conflict with existing state
 */
export async function checkConflicts(
  groups: readonly IssueGroup[],
  config: Config
): Promise<ConflictCheckResult> {
  const conflicts: Conflict[] = [];
  const warnings: string[] = [];

  // Check for branch name conflicts
  const branchNames = groups.map(g => g.branchName);
  const duplicates = branchNames.filter((name, index) =>
    branchNames.indexOf(name) !== index
  );

  if (duplicates.length > 0) {
    conflicts.push({
      type: 'branch',
      description: `Duplicate branch names: ${[...new Set(duplicates)].join(', ')}`,
      groups: groups.filter(g => duplicates.includes(g.branchName)).map(g => g.id),
    });
  }

  // Check for overlapping files
  const fileGroups = new Map<string, string[]>();
  for (const group of groups) {
    for (const file of group.relatedFiles) {
      const existing = fileGroups.get(file) ?? [];
      existing.push(group.id);
      fileGroups.set(file, existing);
    }
  }

  for (const [file, groupIds] of fileGroups) {
    if (groupIds.length > 1) {
      warnings.push(`File ${file} is modified by multiple groups: ${groupIds.join(', ')}`);
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    warnings,
  };
}

/**
 * Conflict check result
 */
export interface ConflictCheckResult {
  readonly hasConflicts: boolean;
  readonly conflicts: readonly Conflict[];
  readonly warnings: readonly string[];
}

/**
 * Conflict information
 */
export interface Conflict {
  readonly type: 'branch' | 'file' | 'issue';
  readonly description: string;
  readonly groups: readonly string[];
}
