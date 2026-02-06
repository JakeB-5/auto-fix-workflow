/**
 * @module commands/autofix/__tests__/progress.test
 * @description Tests for the progress reporter module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProgressReporter,
  createProgressReporter,
  type ProgressConfig,
  type ProgressListener,
} from '../progress.js';
import type { IssueGroup } from '../../../common/types/index.js';
import type { GroupResult, ProgressEvent, PipelineStage } from '../types.js';

// Helper to create a mock IssueGroup
function makeGroup(id: string, name: string, issueCount: number = 1): IssueGroup {
  const issues = Array.from({ length: issueCount }, (_, i) => ({
    number: i + 1,
    title: `Issue ${i + 1}`,
    body: 'desc',
    state: 'open' as const,
    type: 'bug' as const,
    labels: [],
    assignees: [],
    context: {
      component: 'test',
      priority: 'medium' as const,
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github' as const,
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: `https://github.com/test/repo/issues/${i + 1}`,
  }));

  return {
    id,
    name,
    groupBy: 'component',
    key: 'test',
    issues,
    branchName: `fix/${id}`,
    relatedFiles: [],
    components: ['test'],
    priority: 'medium',
  };
}

function makeGroupResult(group: IssueGroup, status: 'completed' | 'failed' = 'completed'): GroupResult {
  return {
    group,
    status,
    attempts: 1,
    durationMs: 1000,
    startedAt: new Date(),
    completedAt: new Date(),
    ...(status === 'completed' ? { pr: { number: 42, url: 'http://pr/42', title: 'Fix', state: 'open' as const, baseBranch: 'main', headBranch: 'fix', createdAt: new Date(), updatedAt: new Date() } } : { error: 'something failed' }),
  };
}

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter();
  });

  afterEach(() => {
    // Ensure any intervals are stopped
    (reporter as any).stopRefreshInterval();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const r = new ProgressReporter();
      expect(r).toBeDefined();
    });

    it('should accept partial config', () => {
      const r = new ProgressReporter({ verbose: true, showTimestamps: false });
      expect(r).toBeDefined();
    });
  });

  describe('on', () => {
    it('should register and invoke a listener', () => {
      const events: ProgressEvent[] = [];
      reporter.on((event) => events.push(event));

      const group = makeGroup('g1', 'Group 1');
      reporter.start([group]);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('start');
    });

    it('should return an unsubscribe function', () => {
      const events: ProgressEvent[] = [];
      const unsub = reporter.on((event) => events.push(event));

      reporter.start([makeGroup('g1', 'G1')]);
      expect(events).toHaveLength(1);

      unsub();
      reporter.groupStart('g1');
      // After unsubscribing, no new events
      expect(events).toHaveLength(1);
    });

    it('should handle listener errors gracefully', () => {
      reporter.on(() => { throw new Error('listener error'); });
      // Should not throw
      expect(() => reporter.start([makeGroup('g1', 'G1')])).not.toThrow();
    });
  });

  describe('start', () => {
    it('should initialize group statuses', () => {
      const g1 = makeGroup('g1', 'Group 1', 2);
      const g2 = makeGroup('g2', 'Group 2', 1);

      reporter.start([g1, g2]);

      const statuses = reporter.getGroupStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses[0]!.groupId).toBe('g1');
      expect(statuses[0]!.issueCount).toBe(2);
      expect(statuses[0]!.status).toBe('pending');
      expect(statuses[1]!.groupId).toBe('g2');
    });

    it('should emit a start event', () => {
      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      reporter.start([makeGroup('g1', 'G1')]);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('start');
      expect(events[0]!.progress).toBe(0);
      expect(events[0]!.data).toEqual({ totalGroups: 1 });
    });

    it('should start refresh interval in verbose mode', () => {
      vi.useFakeTimers();
      const verboseReporter = new ProgressReporter({ verbose: true });
      verboseReporter.start([makeGroup('g1', 'G1')]);
      (verboseReporter as any).stopRefreshInterval();
      vi.useRealTimers();
    });
  });

  describe('groupStart', () => {
    it('should update group status to processing', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      reporter.groupStart('g1');

      const statuses = reporter.getGroupStatuses();
      expect(statuses[0]!.status).toBe('processing');
      expect(statuses[0]!.startedAt).toBeDefined();
    });

    it('should emit group_start event', () => {
      reporter.start([makeGroup('g1', 'G1')]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));
      reporter.groupStart('g1');

      expect(events.some(e => e.type === 'group_start')).toBe(true);
    });

    it('should handle unknown group ID gracefully', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      expect(() => reporter.groupStart('unknown')).not.toThrow();
    });
  });

  describe('groupStage', () => {
    it('should update group stage and progress', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      reporter.groupStart('g1');
      reporter.groupStage('g1', 'ai_analysis');

      const statuses = reporter.getGroupStatuses();
      expect(statuses[0]!.stage).toBe('ai_analysis');
      expect(statuses[0]!.progress).toBeGreaterThan(0);
    });

    it('should emit group_stage event', () => {
      reporter.start([makeGroup('g1', 'G1')]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));
      reporter.groupStage('g1', 'checks');

      expect(events.some(e => e.type === 'group_stage' && e.stage === 'checks')).toBe(true);
    });

    it('should handle unknown group ID', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      expect(() => reporter.groupStage('unknown', 'init')).not.toThrow();
    });
  });

  describe('groupComplete', () => {
    it('should mark group as completed with 100% progress', () => {
      const group = makeGroup('g1', 'G1');
      reporter.start([group]);
      reporter.groupStart('g1');

      const result = makeGroupResult(group);
      reporter.groupComplete('g1', result);

      const statuses = reporter.getGroupStatuses();
      expect(statuses[0]!.status).toBe('completed');
      expect(statuses[0]!.stage).toBe('done');
      expect(statuses[0]!.progress).toBe(100);
      expect(statuses[0]!.completedAt).toBeDefined();
      expect(statuses[0]!.result).toBe(result);
    });

    it('should emit group_complete event', () => {
      const group = makeGroup('g1', 'G1');
      reporter.start([group]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      const result = makeGroupResult(group);
      reporter.groupComplete('g1', result);

      expect(events.some(e => e.type === 'group_complete')).toBe(true);
    });

    it('should include PR number in message when available', () => {
      const group = makeGroup('g1', 'G1');
      reporter.start([group]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      const result = makeGroupResult(group, 'completed');
      reporter.groupComplete('g1', result);

      const completeEvent = events.find(e => e.type === 'group_complete');
      expect(completeEvent!.message).toContain('PR #42');
    });
  });

  describe('groupFailed', () => {
    it('should mark group as failed', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      reporter.groupStart('g1');
      reporter.groupFailed('g1', 'something went wrong');

      const statuses = reporter.getGroupStatuses();
      expect(statuses[0]!.status).toBe('failed');
      expect(statuses[0]!.error).toBe('something went wrong');
      expect(statuses[0]!.completedAt).toBeDefined();
    });

    it('should emit group_failed event', () => {
      reporter.start([makeGroup('g1', 'G1')]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));
      reporter.groupFailed('g1', 'error');

      expect(events.some(e => e.type === 'group_failed')).toBe(true);
    });
  });

  describe('groupRetry', () => {
    it('should reset group status to processing with init stage', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      reporter.groupStart('g1');
      reporter.groupStage('g1', 'checks');
      reporter.groupRetry('g1', 2);

      const statuses = reporter.getGroupStatuses();
      expect(statuses[0]!.status).toBe('processing');
      expect(statuses[0]!.stage).toBe('init');
      expect(statuses[0]!.progress).toBe(0);
    });

    it('should emit group_retry event with attempt', () => {
      reporter.start([makeGroup('g1', 'G1')]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));
      reporter.groupRetry('g1', 3);

      const retryEvent = events.find(e => e.type === 'group_retry');
      expect(retryEvent).toBeDefined();
      expect(retryEvent!.data?.attempt).toBe(3);
    });
  });

  describe('complete', () => {
    it('should stop refresh interval and emit complete event', () => {
      const group = makeGroup('g1', 'G1');
      reporter.start([group]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      const stats = { total: 1, pending: 0, processing: 0, completed: 1, failed: 0, byStatus: {} };
      const results = [makeGroupResult(group, 'completed')];
      reporter.complete(stats, results);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.progress).toBe(100);
      expect(completeEvent!.data).toHaveProperty('successCount', 1);
      expect(completeEvent!.data).toHaveProperty('failedCount', 0);
    });

    it('should count successes and failures correctly', () => {
      const g1 = makeGroup('g1', 'G1');
      const g2 = makeGroup('g2', 'G2');
      reporter.start([g1, g2]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      const results = [
        makeGroupResult(g1, 'completed'),
        makeGroupResult(g2, 'failed'),
      ];
      const stats = { total: 2, pending: 0, processing: 0, completed: 1, failed: 1, byStatus: {} };
      reporter.complete(stats, results);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent!.data!.successCount).toBe(1);
      expect(completeEvent!.data!.failedCount).toBe(1);
    });
  });

  describe('error', () => {
    it('should emit error event', () => {
      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      reporter.error('something bad happened');

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.message).toBe('something bad happened');
    });

    it('should include data when provided', () => {
      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      reporter.error('err', { detail: 'info' });

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent!.data).toEqual({ detail: 'info' });
    });

    it('should not include data property when not provided', () => {
      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      reporter.error('err');

      const errorEvent = events.find(e => e.type === 'error');
      // data should not be set when undefined is passed
      expect(errorEvent!.data).toBeUndefined();
    });
  });

  describe('interrupted', () => {
    it('should emit interrupted event and stop refresh', () => {
      reporter.start([makeGroup('g1', 'G1')]);

      const events: ProgressEvent[] = [];
      reporter.on((e) => events.push(e));

      reporter.interrupted();

      const intEvent = events.find(e => e.type === 'interrupted');
      expect(intEvent).toBeDefined();
      expect(intEvent!.message).toContain('interrupted');
    });
  });

  describe('getStatusSummary', () => {
    it('should return correct summary for mixed statuses', () => {
      const g1 = makeGroup('g1', 'G1');
      const g2 = makeGroup('g2', 'G2');
      const g3 = makeGroup('g3', 'G3');

      reporter.start([g1, g2, g3]);
      reporter.groupStart('g1');
      reporter.groupComplete('g1', makeGroupResult(g1));
      reporter.groupStart('g2');
      reporter.groupFailed('g2', 'err');

      const summary = reporter.getStatusSummary();
      expect(summary.totalGroups).toBe(3);
      expect(summary.completed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.pending).toBe(1);
      expect(summary.processing).toBe(0);
      expect(summary.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 progress when no groups', () => {
      const summary = reporter.getStatusSummary();
      expect(summary.progress).toBe(0);
      expect(summary.totalGroups).toBe(0);
    });
  });

  describe('formatConsoleOutput', () => {
    it('should return formatted string', () => {
      reporter.start([makeGroup('g1', 'G1')]);
      reporter.groupStart('g1');

      const output = reporter.formatConsoleOutput();
      expect(output).toContain('Autofix Progress');
      expect(output).toContain('Completed:');
      expect(output).toContain('Processing:');
      expect(output).toContain('Failed:');
      expect(output).toContain('Pending:');
      expect(output).toContain('Elapsed:');
    });

    it('should include verbose group details when verbose', () => {
      const verboseReporter = new ProgressReporter({ verbose: true });
      const group = makeGroup('g1', 'Test Group');
      verboseReporter.start([group]);
      // Mute console.log for verbose mode
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      verboseReporter.groupStart('g1');

      const output = verboseReporter.formatConsoleOutput();
      expect(output).toContain('Groups:');
      expect(output).toContain('Test Group');

      logSpy.mockRestore();
      (verboseReporter as any).stopRefreshInterval();
    });
  });

  describe('verbose logging', () => {
    it('should log to console in verbose mode', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseReporter = new ProgressReporter({ verbose: true });
      verboseReporter.start([makeGroup('g1', 'G1')]);

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
      (verboseReporter as any).stopRefreshInterval();
    });

    it('should include timestamps when showTimestamps is true', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseReporter = new ProgressReporter({ verbose: true, showTimestamps: true });
      verboseReporter.start([makeGroup('g1', 'G1')]);

      const calls = logSpy.mock.calls.map(c => c[0] as string);
      // Should have ISO timestamp in brackets
      expect(calls.some(c => /\[\d{4}-\d{2}-\d{2}/.test(c))).toBe(true);

      logSpy.mockRestore();
      (verboseReporter as any).stopRefreshInterval();
    });

    it('should not include timestamps when showTimestamps is false', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseReporter = new ProgressReporter({ verbose: true, showTimestamps: false });
      verboseReporter.start([makeGroup('g1', 'G1')]);

      const calls = logSpy.mock.calls.map(c => c[0] as string);
      // Should have the [START] prefix but no ISO date
      expect(calls.some(c => c.startsWith('[START]'))).toBe(true);

      logSpy.mockRestore();
      (verboseReporter as any).stopRefreshInterval();
    });
  });
});

describe('createProgressReporter', () => {
  it('should create a ProgressReporter', () => {
    const reporter = createProgressReporter();
    expect(reporter).toBeInstanceOf(ProgressReporter);
  });

  it('should pass config to constructor', () => {
    const reporter = createProgressReporter({ verbose: true });
    expect(reporter).toBeInstanceOf(ProgressReporter);
  });
});
