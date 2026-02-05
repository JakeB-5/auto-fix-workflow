/**
 * @module commands/autofix/report
 * @description Result summary report and output
 */

import type { GroupResult, AutofixResult, AutofixStats } from './types.js';
import type { GroupProcessingStatus } from '../../common/types/index.js';

/**
 * Report format options
 */
export type ReportFormat = 'text' | 'json' | 'markdown';

/**
 * Report options
 */
export interface ReportOptions {
  readonly format: ReportFormat;
  readonly verbose: boolean;
  readonly includeTimestamps: boolean;
  readonly includeErrorDetails: boolean;
}

/**
 * Report Generator
 *
 * Generates formatted reports from autofix results
 */
export class ReportGenerator {
  private readonly options: ReportOptions;

  constructor(options: Partial<ReportOptions> = {}) {
    this.options = {
      format: options.format ?? 'text',
      verbose: options.verbose ?? false,
      includeTimestamps: options.includeTimestamps ?? true,
      includeErrorDetails: options.includeErrorDetails ?? true,
    };
  }

  /**
   * Generate report from results
   */
  generate(result: AutofixResult): string {
    switch (this.options.format) {
      case 'json':
        return this.generateJSON(result);
      case 'markdown':
        return this.generateMarkdown(result);
      default:
        return this.generateText(result);
    }
  }

  /**
   * Generate text report
   */
  private generateText(result: AutofixResult): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('AUTOFIX REPORT');
    lines.push('='.repeat(60));
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(`Total Groups:    ${result.groups.length}`);
    lines.push(`Total Issues:    ${result.totalIssues}`);
    lines.push(`PRs Created:     ${result.totalPRs}`);
    lines.push(`Failed:          ${result.totalFailed}`);
    lines.push(`Duration:        ${this.formatDuration(result.totalDurationMs)}`);
    lines.push(`Mode:            ${result.dryRun ? 'DRY-RUN' : 'LIVE'}`);
    lines.push('');

    // Success rate
    const successRate = result.groups.length > 0
      ? ((result.groups.length - result.totalFailed) / result.groups.length * 100).toFixed(1)
      : '0';
    lines.push(`Success Rate:    ${successRate}%`);
    lines.push('');

    // Group results
    lines.push('GROUP RESULTS');
    lines.push('-'.repeat(40));

    for (const group of result.groups) {
      const statusIcon = this.getStatusIcon(group.status);
      const prInfo = group.pr ? ` -> PR #${group.pr.number}` : '';
      lines.push(`${statusIcon} ${group.group.name}${prInfo}`);

      if (this.options.verbose) {
        lines.push(`   Issues: ${group.group.issues.map(i => `#${i.number}`).join(', ')}`);
        lines.push(`   Branch: ${group.group.branchName}`);
        lines.push(`   Duration: ${this.formatDuration(group.durationMs)}`);
        lines.push(`   Attempts: ${group.attempts}`);
      }

      if (group.error && this.options.includeErrorDetails) {
        lines.push(`   Error: ${group.error}`);
      }
    }

    lines.push('');

    // Statistics
    if (this.options.verbose) {
      lines.push('STATISTICS');
      lines.push('-'.repeat(40));
      lines.push(`Avg Processing Time: ${this.formatDuration(result.stats.avgProcessingTimeMs)}`);
      lines.push(`Total Checks Run:    ${result.stats.totalChecksRun}`);
      lines.push(`Checks Passed:       ${result.stats.totalChecksPassed}`);
      lines.push('');

      lines.push('Groups by Status:');
      for (const [status, count] of Object.entries(result.stats.groupsByStatus)) {
        lines.push(`  ${status}: ${count}`);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate JSON report
   */
  private generateJSON(result: AutofixResult): string {
    const report = {
      summary: {
        totalGroups: result.groups.length,
        totalIssues: result.totalIssues,
        totalPRs: result.totalPRs,
        totalFailed: result.totalFailed,
        durationMs: result.totalDurationMs,
        dryRun: result.dryRun,
        successRate: result.groups.length > 0
          ? (result.groups.length - result.totalFailed) / result.groups.length
          : 0,
      },
      groups: result.groups.map(g => ({
        id: g.group.id,
        name: g.group.name,
        status: g.status,
        issues: g.group.issues.map(i => i.number),
        branch: g.group.branchName,
        pr: g.pr ? {
          number: g.pr.number,
          url: g.pr.url,
        } : null,
        error: g.error ?? null,
        durationMs: g.durationMs,
        attempts: g.attempts,
        startedAt: g.startedAt.toISOString(),
        completedAt: g.completedAt.toISOString(),
      })),
      statistics: result.stats,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(result: AutofixResult): string {
    const lines: string[] = [];

    // Header
    lines.push('# Autofix Report');
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Groups | ${result.groups.length} |`);
    lines.push(`| Total Issues | ${result.totalIssues} |`);
    lines.push(`| PRs Created | ${result.totalPRs} |`);
    lines.push(`| Failed | ${result.totalFailed} |`);
    lines.push(`| Duration | ${this.formatDuration(result.totalDurationMs)} |`);
    lines.push(`| Mode | ${result.dryRun ? 'Dry-Run' : 'Live'} |`);
    lines.push('');

    // Group results
    lines.push('## Results');
    lines.push('');

    const successGroups = result.groups.filter(g => g.status === 'completed');
    const failedGroups = result.groups.filter(g => g.status === 'failed');

    if (successGroups.length > 0) {
      lines.push('### Successful');
      lines.push('');
      lines.push('| Group | Issues | PR |');
      lines.push('|-------|--------|-----|');
      for (const group of successGroups) {
        const issues = group.group.issues.map(i => `#${i.number}`).join(', ');
        const pr = group.pr ? `[#${group.pr.number}](${group.pr.url})` : '-';
        lines.push(`| ${group.group.name} | ${issues} | ${pr} |`);
      }
      lines.push('');
    }

    if (failedGroups.length > 0) {
      lines.push('### Failed');
      lines.push('');
      for (const group of failedGroups) {
        lines.push(`#### ${group.group.name}`);
        lines.push('');
        lines.push(`- **Issues:** ${group.group.issues.map(i => `#${i.number}`).join(', ')}`);
        lines.push(`- **Branch:** \`${group.group.branchName}\``);
        lines.push(`- **Attempts:** ${group.attempts}`);
        if (group.error) {
          lines.push(`- **Error:** ${group.error}`);
        }
        lines.push('');
      }
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated by auto-fix-workflow at ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: GroupProcessingStatus): string {
    switch (status) {
      case 'completed':
        return '[OK]';
      case 'failed':
        return '[X]';
      case 'processing':
        return '[...]';
      default:
        return '[ ]';
    }
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Calculate statistics from results
 */
export function calculateStats(groups: readonly GroupResult[]): AutofixStats {
  const groupsByStatus: Record<GroupProcessingStatus, number> = {
    pending: 0,
    processing: 0,
    checks_running: 0,
    pr_creating: 0,
    completed: 0,
    failed: 0,
  };

  let totalProcessingTime = 0;
  let totalChecksRun = 0;
  let totalChecksPassed = 0;

  for (const group of groups) {
    groupsByStatus[group.status]++;
    totalProcessingTime += group.durationMs;

    if (group.checkResult) {
      totalChecksRun += group.checkResult.results.length;
      totalChecksPassed += group.checkResult.results.filter(r => r.passed).length;
    }
  }

  const avgProcessingTimeMs = groups.length > 0
    ? totalProcessingTime / groups.length
    : 0;

  return {
    issuesByStatus: {},
    groupsByStatus,
    avgProcessingTimeMs,
    totalChecksRun,
    totalChecksPassed,
  };
}

/**
 * Create autofix result from group results
 */
export function createAutofixResult(
  groups: readonly GroupResult[],
  dryRun: boolean,
  startTime: Date
): AutofixResult {
  const stats = calculateStats(groups);
  const totalPRs = groups.filter(g => g.pr).length;
  const totalFailed = groups.filter(g => g.status === 'failed').length;
  const totalIssues = groups.reduce(
    (sum, g) => sum + g.group.issues.length,
    0
  );

  return {
    groups,
    totalPRs,
    totalFailed,
    totalIssues,
    totalDurationMs: Date.now() - startTime.getTime(),
    dryRun,
    stats,
  };
}

/**
 * Create report generator
 */
export function createReportGenerator(
  options?: Partial<ReportOptions>
): ReportGenerator {
  return new ReportGenerator(options);
}

/**
 * Print report to console
 */
export function printReport(
  result: AutofixResult,
  options?: Partial<ReportOptions>
): void {
  const generator = new ReportGenerator(options);
  const report = generator.generate(result);
  console.log(report);
}

/**
 * Generate quick summary line
 */
export function generateSummaryLine(result: AutofixResult): string {
  const successCount = result.groups.length - result.totalFailed;
  const status = result.totalFailed === 0 ? 'SUCCESS' : 'PARTIAL';
  let summary = `[${status}] ${successCount}/${result.groups.length} groups processed, ${result.totalPRs} PRs created`;

  // Add first failure reason if any failed
  if (result.totalFailed > 0) {
    const failedGroup = result.groups.find(g => g.status === 'failed');
    if (failedGroup?.error) {
      const errorMsg = failedGroup.error.length > 100
        ? failedGroup.error.slice(0, 100) + '...'
        : failedGroup.error;
      summary += `\n  Error: ${errorMsg}`;
    }
  }

  return summary;
}
