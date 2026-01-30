/**
 * @module commands/triage/report
 * @description Result output and summary reporting
 */

import type { TriageResult, CreatedIssueInfo, TriageFailure } from './types.js';

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
  readonly includeLinks: boolean;
}

/**
 * Default report options
 */
const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  format: 'text',
  verbose: false,
  includeLinks: true,
};

/**
 * Generate a report from triage result
 */
export function generateReport(
  result: TriageResult,
  options: Partial<ReportOptions> = {}
): string {
  const opts = { ...DEFAULT_REPORT_OPTIONS, ...options };

  switch (opts.format) {
    case 'json':
      return generateJsonReport(result, opts);
    case 'markdown':
      return generateMarkdownReport(result, opts);
    default:
      return generateTextReport(result, opts);
  }
}

/**
 * Generate text report
 */
function generateTextReport(result: TriageResult, options: ReportOptions): string {
  const lines: string[] = [
    '',
    '=== Triage Report ===',
    '',
  ];

  // Summary
  lines.push('Summary:');
  lines.push(`  Processed: ${result.processed}`);
  lines.push(`  Created:   ${result.created}`);
  lines.push(`  Skipped:   ${result.skipped}`);
  lines.push(`  Failed:    ${result.failed}`);

  if (result.durationMs !== undefined) {
    const seconds = (result.durationMs / 1000).toFixed(2);
    lines.push(`  Duration:  ${seconds}s`);
  }

  lines.push('');

  // Created issues
  if (result.createdIssues && result.createdIssues.length > 0 && options.verbose) {
    lines.push('Created Issues:');

    for (const issue of result.createdIssues) {
      lines.push(`  - #${issue.githubIssueNumber}: ${issue.title}`);
      if (options.includeLinks) {
        lines.push(`    URL: ${issue.githubIssueUrl}`);
        lines.push(`    Asana: ${issue.asanaTaskGid}`);
      }
    }

    lines.push('');
  }

  // Failures
  if (result.failures && result.failures.length > 0) {
    lines.push('Failures:');

    for (const failure of result.failures) {
      lines.push(`  - ${failure.title} (${failure.asanaTaskGid})`);
      lines.push(`    Error: ${failure.error}`);
      if (failure.retryable) {
        lines.push(`    [Retryable]`);
      }
    }

    lines.push('');
  }

  // Status
  const status = result.failed === 0 ? 'SUCCESS' : result.created > 0 ? 'PARTIAL' : 'FAILED';
  lines.push(`Status: ${status}`);

  return lines.join('\n');
}

/**
 * Generate JSON report
 */
function generateJsonReport(result: TriageResult, _options: ReportOptions): string {
  const report = {
    summary: {
      processed: result.processed,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
      durationMs: result.durationMs,
    },
    createdIssues: result.createdIssues ?? [],
    failures: result.failures ?? [],
    status: result.failed === 0 ? 'success' : result.created > 0 ? 'partial' : 'failed',
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(result: TriageResult, options: ReportOptions): string {
  const lines: string[] = [
    '# Triage Report',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Processed | ${result.processed} |`,
    `| Created | ${result.created} |`,
    `| Skipped | ${result.skipped} |`,
    `| Failed | ${result.failed} |`,
  ];

  if (result.durationMs !== undefined) {
    const seconds = (result.durationMs / 1000).toFixed(2);
    lines.push(`| Duration | ${seconds}s |`);
  }

  lines.push('');

  // Created issues
  if (result.createdIssues && result.createdIssues.length > 0) {
    lines.push('## Created Issues');
    lines.push('');
    lines.push('| Issue | Title | Asana Task |');
    lines.push('|-------|-------|------------|');

    for (const issue of result.createdIssues) {
      const issueLink = options.includeLinks
        ? `[#${issue.githubIssueNumber}](${issue.githubIssueUrl})`
        : `#${issue.githubIssueNumber}`;
      lines.push(`| ${issueLink} | ${escapeMarkdown(issue.title)} | ${issue.asanaTaskGid} |`);
    }

    lines.push('');
  }

  // Failures
  if (result.failures && result.failures.length > 0) {
    lines.push('## Failures');
    lines.push('');

    for (const failure of result.failures) {
      const retryBadge = failure.retryable ? ' `retryable`' : '';
      lines.push(`### ${escapeMarkdown(failure.title)}${retryBadge}`);
      lines.push('');
      lines.push(`- **Asana Task**: ${failure.asanaTaskGid}`);
      lines.push(`- **Error**: ${escapeMarkdown(failure.error)}`);
      lines.push('');
    }
  }

  // Status
  const status = result.failed === 0 ? 'SUCCESS' : result.created > 0 ? 'PARTIAL SUCCESS' : 'FAILED';
  const statusEmoji = result.failed === 0 ? '' : result.created > 0 ? '' : '';
  lines.push(`## Status: ${statusEmoji} ${status}`);

  return lines.join('\n');
}

/**
 * Escape special Markdown characters
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\n/g, ' ');
}

/**
 * Print report to console
 */
export function printReport(
  result: TriageResult,
  options: Partial<ReportOptions> = {}
): void {
  const report = generateReport(result, options);
  console.log(report);
}

/**
 * Create a real-time progress reporter
 */
export class ProgressReporter {
  private readonly startTime: number;
  private processed = 0;
  private created = 0;
  private skipped = 0;
  private failed = 0;
  private readonly total: number;
  private readonly verbose: boolean;

  constructor(total: number, verbose = false) {
    this.startTime = Date.now();
    this.total = total;
    this.verbose = verbose;
  }

  /**
   * Report task processing started
   */
  onTaskStart(taskName: string): void {
    if (this.verbose) {
      console.log(`[${this.processed + 1}/${this.total}] Processing: ${taskName}`);
    }
  }

  /**
   * Report task created successfully
   */
  onTaskCreated(info: CreatedIssueInfo): void {
    this.processed++;
    this.created++;

    if (this.verbose) {
      console.log(`  -> Created: #${info.githubIssueNumber} (${info.githubIssueUrl})`);
    } else {
      this.updateProgressLine();
    }
  }

  /**
   * Report task skipped
   */
  onTaskSkipped(taskName: string, reason: string): void {
    this.processed++;
    this.skipped++;

    if (this.verbose) {
      console.log(`  -> Skipped: ${taskName} (${reason})`);
    } else {
      this.updateProgressLine();
    }
  }

  /**
   * Report task failed
   */
  onTaskFailed(taskName: string, error: string): void {
    this.processed++;
    this.failed++;

    if (this.verbose) {
      console.log(`  -> Failed: ${taskName} - ${error}`);
    } else {
      this.updateProgressLine();
    }
  }

  /**
   * Update progress line (non-verbose mode)
   */
  private updateProgressLine(): void {
    const percent = Math.round((this.processed / this.total) * 100);
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);

    process.stdout.write(
      `\rProgress: ${this.processed}/${this.total} (${percent}%) | ` +
      `Created: ${this.created} | Skipped: ${this.skipped} | Failed: ${this.failed} | ` +
      `Time: ${elapsed}s`
    );

    if (this.processed === this.total) {
      console.log(''); // New line at completion
    }
  }

  /**
   * Get final result
   */
  getResult(): TriageResult {
    return {
      processed: this.processed,
      created: this.created,
      skipped: this.skipped,
      failed: this.failed,
      durationMs: Date.now() - this.startTime,
    };
  }
}

/**
 * Write report to file
 */
export async function writeReportToFile(
  result: TriageResult,
  filePath: string,
  options: Partial<ReportOptions> = {}
): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  const report = generateReport(result, options);
  await writeFile(filePath, report, 'utf-8');
}

/**
 * Aggregate multiple results
 */
export function aggregateResults(results: readonly TriageResult[]): TriageResult {
  return results.reduce(
    (acc, result) => ({
      processed: acc.processed + result.processed,
      created: acc.created + result.created,
      skipped: acc.skipped + result.skipped,
      failed: acc.failed + result.failed,
      durationMs: (acc.durationMs ?? 0) + (result.durationMs ?? 0),
      createdIssues: [
        ...(acc.createdIssues ?? []),
        ...(result.createdIssues ?? []),
      ],
      failures: [
        ...(acc.failures ?? []),
        ...(result.failures ?? []),
      ],
    }),
    {
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      durationMs: 0,
      createdIssues: [] as CreatedIssueInfo[],
      failures: [] as TriageFailure[],
    }
  );
}
