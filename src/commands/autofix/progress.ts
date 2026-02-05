/**
 * @module commands/autofix/progress
 * @description Real-time progress UI
 */

import type { IssueGroup, GroupProcessingStatus } from '../../common/types/index.js';
import type {
  ProgressEvent,
  ProgressEventType,
  PipelineStage,
  GroupResult,
} from './types.js';
import type { QueueStats } from './queue.js';

/**
 * Progress reporter configuration
 */
export interface ProgressConfig {
  readonly verbose: boolean;
  readonly showTimestamps: boolean;
  readonly refreshIntervalMs: number;
}

/**
 * Progress listener callback
 */
export type ProgressListener = (event: ProgressEvent) => void;

/**
 * Progress Reporter
 *
 * Provides real-time progress updates for autofix processing
 */
export class ProgressReporter {
  private readonly config: ProgressConfig;
  private readonly listeners: ProgressListener[] = [];
  private readonly groupStatus: Map<string, GroupProgressInfo> = new Map();
  private startTime?: Date;
  private endTime?: Date;
  private refreshInterval?: ReturnType<typeof setInterval> | undefined;

  constructor(config: Partial<ProgressConfig> = {}) {
    this.config = {
      verbose: config.verbose ?? false,
      showTimestamps: config.showTimestamps ?? true,
      refreshIntervalMs: config.refreshIntervalMs ?? 1000,
    };
  }

  /**
   * Add progress listener
   */
  on(listener: ProgressListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start progress reporting
   */
  start(groups: readonly IssueGroup[]): void {
    this.startTime = new Date();

    // Initialize group status
    for (const group of groups) {
      this.groupStatus.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        issueCount: group.issues.length,
        status: 'pending',
        stage: 'init',
        progress: 0,
      });
    }

    this.emit({
      type: 'start',
      timestamp: new Date(),
      message: `Starting autofix for ${groups.length} group(s)`,
      progress: 0,
      data: { totalGroups: groups.length },
    });

    // Start refresh interval for console output
    if (this.config.verbose) {
      this.startRefreshInterval();
    }
  }

  /**
   * Report group start
   */
  groupStart(groupId: string): void {
    const info = this.groupStatus.get(groupId);
    if (info) {
      info.status = 'processing';
      info.startedAt = new Date();
    }

    this.emit({
      type: 'group_start',
      timestamp: new Date(),
      groupId,
      message: `Processing group: ${info?.groupName ?? groupId}`,
      progress: this.calculateProgress(),
    });
  }

  /**
   * Report group stage change
   */
  groupStage(groupId: string, stage: PipelineStage): void {
    const info = this.groupStatus.get(groupId);
    if (info) {
      info.stage = stage;
      info.progress = this.stageToProgress(stage);
    }

    this.emit({
      type: 'group_stage',
      timestamp: new Date(),
      groupId,
      stage,
      message: `[${info?.groupName ?? groupId}] Stage: ${this.formatStage(stage)}`,
      progress: this.calculateProgress(),
    });
  }

  /**
   * Report group completion
   */
  groupComplete(groupId: string, result: GroupResult): void {
    const info = this.groupStatus.get(groupId);
    if (info) {
      info.status = 'completed';
      info.stage = 'done';
      info.progress = 100;
      info.completedAt = new Date();
      info.result = result;
    }

    this.emit({
      type: 'group_complete',
      timestamp: new Date(),
      groupId,
      message: `Completed: ${info?.groupName ?? groupId}${result.pr ? ` (PR #${result.pr.number})` : ''}`,
      progress: this.calculateProgress(),
      data: { prNumber: result.pr?.number },
    });
  }

  /**
   * Report group failure
   */
  groupFailed(groupId: string, error: string): void {
    const info = this.groupStatus.get(groupId);
    if (info) {
      info.status = 'failed';
      info.completedAt = new Date();
      info.error = error;
    }

    this.emit({
      type: 'group_failed',
      timestamp: new Date(),
      groupId,
      message: `Failed: ${info?.groupName ?? groupId} - ${error}`,
      progress: this.calculateProgress(),
      data: { error },
    });
  }

  /**
   * Report group retry
   */
  groupRetry(groupId: string, attempt: number): void {
    const info = this.groupStatus.get(groupId);
    if (info) {
      info.status = 'processing';
      info.stage = 'init';
      info.progress = 0;
    }

    this.emit({
      type: 'group_retry',
      timestamp: new Date(),
      groupId,
      message: `Retrying: ${info?.groupName ?? groupId} (attempt ${attempt})`,
      progress: this.calculateProgress(),
      data: { attempt },
    });
  }

  /**
   * Report completion
   */
  complete(stats: QueueStats, results: readonly GroupResult[]): void {
    this.endTime = new Date();
    this.stopRefreshInterval();

    const duration = this.endTime.getTime() - (this.startTime?.getTime() ?? 0);
    const successCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    this.emit({
      type: 'complete',
      timestamp: new Date(),
      message: `Autofix complete: ${successCount} succeeded, ${failedCount} failed`,
      progress: 100,
      data: {
        duration,
        successCount,
        failedCount,
        totalPRs: results.filter(r => r.pr).length,
      },
    });
  }

  /**
   * Report error
   */
  error(message: string, data?: Record<string, unknown>): void {
    const event: ProgressEvent = {
      type: 'error',
      timestamp: new Date(),
      message,
    };
    if (data !== undefined) {
      (event as { data?: Record<string, unknown> }).data = data;
    }
    this.emit(event);
  }

  /**
   * Report interruption
   */
  interrupted(): void {
    this.stopRefreshInterval();

    this.emit({
      type: 'interrupted',
      timestamp: new Date(),
      message: 'Autofix interrupted by user',
      progress: this.calculateProgress(),
    });
  }

  /**
   * Get current status summary
   */
  getStatusSummary(): ProgressSummary {
    const groups = [...this.groupStatus.values()];

    return {
      totalGroups: groups.length,
      completed: groups.filter(g => g.status === 'completed').length,
      failed: groups.filter(g => g.status === 'failed').length,
      processing: groups.filter(g => g.status === 'processing').length,
      pending: groups.filter(g => g.status === 'pending').length,
      progress: this.calculateProgress(),
      elapsedMs: this.startTime
        ? Date.now() - this.startTime.getTime()
        : 0,
    };
  }

  /**
   * Get detailed group statuses
   */
  getGroupStatuses(): readonly GroupProgressInfo[] {
    return [...this.groupStatus.values()];
  }

  /**
   * Format for console output
   */
  formatConsoleOutput(): string {
    const summary = this.getStatusSummary();
    const lines: string[] = [];

    lines.push('');
    lines.push('='.repeat(60));
    lines.push(`Autofix Progress: ${summary.progress.toFixed(1)}%`);
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`  Completed: ${summary.completed}/${summary.totalGroups}`);
    lines.push(`  Processing: ${summary.processing}`);
    lines.push(`  Failed: ${summary.failed}`);
    lines.push(`  Pending: ${summary.pending}`);
    lines.push('');

    if (this.config.verbose) {
      lines.push('Groups:');
      for (const group of this.groupStatus.values()) {
        const statusIcon = this.getStatusIcon(group.status);
        const stageInfo = group.status === 'processing'
          ? ` [${this.formatStage(group.stage)}]`
          : '';
        lines.push(`  ${statusIcon} ${group.groupName}${stageInfo}`);
      }
      lines.push('');
    }

    lines.push(`Elapsed: ${this.formatDuration(summary.elapsedMs)}`);
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  /**
   * Emit progress event
   */
  private emit(event: ProgressEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }

    // Console output in verbose mode
    if (this.config.verbose) {
      this.logToConsole(event);
    }
  }

  /**
   * Log event to console
   */
  private logToConsole(event: ProgressEvent): void {
    const timestamp = this.config.showTimestamps
      ? `[${event.timestamp.toISOString()}] `
      : '';

    const prefix = this.getEventPrefix(event.type);

    console.log(`${timestamp}${prefix}${event.message}`);
  }

  /**
   * Get event prefix for console
   */
  private getEventPrefix(type: ProgressEventType): string {
    switch (type) {
      case 'start':
        return '[START] ';
      case 'complete':
        return '[DONE] ';
      case 'error':
        return '[ERROR] ';
      case 'interrupted':
        return '[INTERRUPTED] ';
      case 'group_complete':
        return '[OK] ';
      case 'group_failed':
        return '[FAIL] ';
      default:
        return '';
    }
  }

  /**
   * Get status icon for console
   */
  private getStatusIcon(status: GroupProcessingStatus | 'pending'): string {
    switch (status) {
      case 'completed':
        return '[OK]';
      case 'failed':
        return '[X]';
      case 'processing':
        return '[...]';
      case 'pending':
        return '[ ]';
      default:
        return '[?]';
    }
  }

  /**
   * Calculate overall progress
   */
  private calculateProgress(): number {
    const groups = [...this.groupStatus.values()];
    if (groups.length === 0) return 0;

    const totalProgress = groups.reduce((sum, g) => sum + g.progress, 0);
    return totalProgress / groups.length;
  }

  /**
   * Convert stage to progress percentage
   */
  private stageToProgress(stage: PipelineStage): number {
    const stages: PipelineStage[] = [
      'init',
      'worktree_create',
      'ai_analysis',
      'ai_fix',
      'install_deps',
      'checks',
      'commit',
      'pr_create',
      'issue_update',
      'cleanup',
      'done',
    ];

    const index = stages.indexOf(stage);
    if (index === -1) return 0;

    return (index / (stages.length - 1)) * 100;
  }

  /**
   * Format stage name for display
   */
  private formatStage(stage: PipelineStage): string {
    const names: Record<PipelineStage, string> = {
      init: 'Initializing',
      worktree_create: 'Creating worktree',
      ai_analysis: 'Analyzing issues',
      ai_fix: 'Applying fixes',
      install_deps: 'Installing dependencies',
      checks: 'Running checks',
      commit: 'Committing changes',
      pr_create: 'Creating PR',
      issue_update: 'Updating issues',
      cleanup: 'Cleaning up',
      done: 'Done',
    };

    return names[stage] ?? stage;
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Start refresh interval
   */
  private startRefreshInterval(): void {
    this.refreshInterval = setInterval(() => {
      // Clear console and redraw
      if (process.stdout.isTTY) {
        process.stdout.write('\x1B[2J\x1B[0f');
        process.stdout.write(this.formatConsoleOutput());
      }
    }, this.config.refreshIntervalMs);
  }

  /**
   * Stop refresh interval
   */
  private stopRefreshInterval(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }
}

/**
 * Group progress info
 */
export interface GroupProgressInfo {
  readonly groupId: string;
  readonly groupName: string;
  readonly issueCount: number;
  status: GroupProcessingStatus | 'pending';
  stage: PipelineStage;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  result?: GroupResult;
  error?: string;
}

/**
 * Progress summary
 */
export interface ProgressSummary {
  readonly totalGroups: number;
  readonly completed: number;
  readonly failed: number;
  readonly processing: number;
  readonly pending: number;
  readonly progress: number;
  readonly elapsedMs: number;
}

/**
 * Create progress reporter
 */
export function createProgressReporter(
  config?: Partial<ProgressConfig>
): ProgressReporter {
  return new ProgressReporter(config);
}
