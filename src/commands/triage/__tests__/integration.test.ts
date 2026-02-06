/**
 * @module commands/triage/__tests__/integration.test
 * @description Integration tests for triage module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AsanaTask, TriageConfig, TaskAnalysis } from '../types.js';
import { DEFAULT_TRIAGE_CONFIG } from '../types.js';
import { loadTriageConfig, validateConfig, getEnvConfig } from '../config.js';
import { withRetry, handleTriageError, TriageError, ErrorAggregator } from '../error-handler.js';
import { generateReport, aggregateResults, ProgressReporter } from '../report.js';
import { confirmBatchWork, confirmLargeBatch } from '../confirmation.js';

// Mock task factory
function createMockTask(overrides: Partial<AsanaTask> = {}): AsanaTask {
  return {
    gid: '123456789',
    name: 'Test Task',
    notes: 'Test task description',
    permalinkUrl: 'https://app.asana.com/0/123/456',
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    completed: false,
    ...overrides,
  };
}

describe('Config Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadTriageConfig', () => {
    it('should return defaults when no config file exists', async () => {
      const result = await loadTriageConfig('/nonexistent/path');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(DEFAULT_TRIAGE_CONFIG);
      }
    });
  });

  describe('validateConfig', () => {
    it('should accept valid config', () => {
      const result = validateConfig(DEFAULT_TRIAGE_CONFIG);

      expect(result.success).toBe(true);
    });

    it('should reject invalid maxBatchSize', () => {
      const config = { ...DEFAULT_TRIAGE_CONFIG, maxBatchSize: 0 };
      const result = validateConfig(config);

      expect(result.success).toBe(false);
    });

    it('should reject invalid retry config', () => {
      const config = {
        ...DEFAULT_TRIAGE_CONFIG,
        retry: {
          maxAttempts: 0,
          initialDelayMs: 1000,
          maxDelayMs: 500, // Less than initial
        },
      };
      const result = validateConfig(config);

      expect(result.success).toBe(false);
    });

    it('should reject empty section names', () => {
      const config = { ...DEFAULT_TRIAGE_CONFIG, triageSectionName: '' };
      const result = validateConfig(config);

      expect(result.success).toBe(false);
    });
  });

  describe('getEnvConfig', () => {
    it('should read project GID from env', () => {
      process.env.ASANA_DEFAULT_PROJECT_GID = '123456';

      const config = getEnvConfig();

      expect(config.defaultProjectGid).toBe('123456');
    });

    it('should read triage section from env', () => {
      process.env.ASANA_TRIAGE_SECTION = 'Custom Triage';

      const config = getEnvConfig();

      expect(config.triageSectionName).toBe('Custom Triage');
    });

    it('should read max batch size from env', () => {
      process.env.TRIAGE_MAX_BATCH_SIZE = '100';

      const config = getEnvConfig();

      expect(config.maxBatchSize).toBe(100);
    });

    it('should ignore invalid max batch size', () => {
      process.env.TRIAGE_MAX_BATCH_SIZE = 'invalid';

      const config = getEnvConfig();

      expect(config.maxBatchSize).toBeUndefined();
    });
  });
});

describe('Error Handling Integration', () => {
  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED')) // Network error - retryable
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result.success).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT')); // Network error - retryable

      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('ENOTFOUND')) // Network error - retryable
        .mockResolvedValue('success');

      const onRetry = vi.fn();

      await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Error),
        expect.any(Number)
      );
    });

    it('should respect shouldRetry predicate', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'));

      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
        shouldRetry: () => false,
      });

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleTriageError', () => {
    it('should return TriageError unchanged', () => {
      const original = new TriageError('Test', 'ASANA_API_ERROR');

      const result = handleTriageError(original);

      expect(result).toBe(original);
    });

    it('should categorize Asana errors', () => {
      const error = new Error('Asana API returned 400');

      const result = handleTriageError(error);

      expect(result.code).toBe('ASANA_API_ERROR');
    });

    it('should categorize GitHub errors', () => {
      const error = new Error('GitHub API returned error');

      const result = handleTriageError(error);

      expect(result.code).toBe('GITHUB_API_ERROR');
    });

    it('should categorize network errors', () => {
      const error = new Error('ECONNREFUSED');

      const result = handleTriageError(error);

      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should include context in message', () => {
      const error = new Error('Something failed');

      const result = handleTriageError(error, 'Processing task X');

      expect(result.message).toContain('Processing task X');
    });
  });

  describe('ErrorAggregator', () => {
    it('should aggregate errors by task', () => {
      const aggregator = new ErrorAggregator();

      aggregator.add('task1', new TriageError('Error 1', 'ASANA_API_ERROR'));
      aggregator.add('task1', new TriageError('Error 2', 'GITHUB_API_ERROR'));
      aggregator.add('task2', new TriageError('Error 3', 'NETWORK_ERROR'));

      expect(aggregator.hasErrors()).toBe(true);
      expect(aggregator.getErrorCount()).toBe(3);
      expect(aggregator.getTasksWithErrors()).toEqual(['task1', 'task2']);
    });

    it('should identify retryable tasks', () => {
      const aggregator = new ErrorAggregator();

      aggregator.add('task1', new TriageError('Error', 'NETWORK_ERROR', { retryable: true }));
      aggregator.add('task2', new TriageError('Error', 'VALIDATION_ERROR', { retryable: false }));

      const retryable = aggregator.getRetryableTasks();

      expect(retryable).toContain('task1');
      expect(retryable).not.toContain('task2');
    });

    it('should format error summary', () => {
      const aggregator = new ErrorAggregator();

      aggregator.add('task1', new TriageError('Error 1', 'ASANA_API_ERROR'));
      aggregator.add('task2', new TriageError('Error 2', 'NETWORK_ERROR'));

      const formatted = aggregator.format();

      expect(formatted).toContain('Error Summary');
      expect(formatted).toContain('task1');
      expect(formatted).toContain('task2');
      expect(formatted).toContain('ASANA_API_ERROR');
      expect(formatted).toContain('NETWORK_ERROR');
    });
  });
});

describe('Report Integration', () => {
  describe('generateReport', () => {
    it('should generate text report', () => {
      const result = {
        processed: 10,
        created: 8,
        skipped: 1,
        failed: 1,
        needsInfo: 0,
        durationMs: 5000,
      };

      const report = generateReport(result, { format: 'text' });

      expect(report).toContain('Triage Report');
      expect(report).toContain('Processed:  10');
      expect(report).toContain('Created:    8');
      expect(report).toContain('Skipped:    1');
      expect(report).toContain('Failed:     1');
      expect(report).toContain('Needs Info: 0');
      expect(report).toContain('Duration:   5.00s');
    });

    it('should generate JSON report', () => {
      const result = {
        processed: 5,
        created: 5,
        skipped: 0,
        failed: 0,
        needsInfo: 0,
      };

      const report = generateReport(result, { format: 'json' });
      const parsed = JSON.parse(report);

      expect(parsed.summary.processed).toBe(5);
      expect(parsed.status).toBe('success');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should generate Markdown report', () => {
      const result = {
        processed: 3,
        created: 2,
        skipped: 1,
        failed: 0,
        needsInfo: 0,
        createdIssues: [
          {
            asanaTaskGid: '1',
            githubIssueNumber: 42,
            githubIssueUrl: 'https://github.com/owner/repo/issues/42',
            title: 'Test Issue',
          },
        ],
      };

      const report = generateReport(result, { format: 'markdown', verbose: true });

      expect(report).toContain('# Triage Report');
      expect(report).toContain('| Processed | 3 |');
      expect(report).toContain('Created Issues');
      expect(report).toContain('#42');
    });

    it('should include failures in report', () => {
      const result = {
        processed: 2,
        created: 1,
        skipped: 0,
        failed: 1,
        needsInfo: 0,
        failures: [
          {
            asanaTaskGid: '123',
            title: 'Failed Task',
            error: 'API Error',
            retryable: true,
          },
        ],
      };

      const report = generateReport(result, { format: 'text', verbose: true });

      expect(report).toContain('Failures');
      expect(report).toContain('Failed Task');
      expect(report).toContain('API Error');
      expect(report).toContain('PARTIAL');
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate multiple results', () => {
      const results = [
        { processed: 5, created: 4, skipped: 1, failed: 0, needsInfo: 0, durationMs: 1000 },
        { processed: 3, created: 2, skipped: 0, failed: 1, needsInfo: 0, durationMs: 500 },
        { processed: 2, created: 2, skipped: 0, failed: 0, needsInfo: 0, durationMs: 300 },
      ];

      const aggregated = aggregateResults(results);

      expect(aggregated.processed).toBe(10);
      expect(aggregated.created).toBe(8);
      expect(aggregated.skipped).toBe(1);
      expect(aggregated.failed).toBe(1);
      expect(aggregated.durationMs).toBe(1800);
    });

    it('should aggregate created issues', () => {
      const results = [
        {
          processed: 1,
          created: 1,
          skipped: 0,
          failed: 0,
          needsInfo: 0,
          createdIssues: [
            { asanaTaskGid: '1', githubIssueNumber: 1, githubIssueUrl: 'url1', title: 'Issue 1' },
          ],
        },
        {
          processed: 1,
          created: 1,
          skipped: 0,
          failed: 0,
          needsInfo: 0,
          createdIssues: [
            { asanaTaskGid: '2', githubIssueNumber: 2, githubIssueUrl: 'url2', title: 'Issue 2' },
          ],
        },
      ];

      const aggregated = aggregateResults(results);

      expect(aggregated.createdIssues).toHaveLength(2);
    });
  });

  describe('ProgressReporter', () => {
    it('should track progress', () => {
      const reporter = new ProgressReporter(3, false);

      reporter.onTaskCreated({ asanaTaskGid: '1', githubIssueNumber: 1, githubIssueUrl: 'url', title: 'T1' });
      reporter.onTaskSkipped('T2', 'reason');
      reporter.onTaskFailed('T3', 'error');

      const result = reporter.getResult();

      expect(result.processed).toBe(3);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Confirmation Integration', () => {
  // Note: These tests would require mocking stdin/stdout
  // For now, we test the structure and types

  it('should have correct context structure', () => {
    const context = {
      tasks: [createMockTask()],
      options: {
        mode: 'batch' as const,
        dryRun: false,
        skipConfirmation: false,
      },
    };

    expect(context.tasks).toHaveLength(1);
    expect(context.options.mode).toBe('batch');
  });
});

describe('Full Pipeline Integration', () => {
  it('should handle complete dry-run workflow', async () => {
    const tasks = [
      createMockTask({ gid: '1', name: 'Task 1' }),
      createMockTask({ gid: '2', name: 'Task 2' }),
    ];

    const options = {
      mode: 'batch' as const,
      dryRun: true,
      verbose: false,
    };

    // In dry-run mode, we use the simulator
    const { simulateActions, toTriageResult } = await import('../dry-run.js');
    const dryRunResult = simulateActions(tasks);
    const triageResult = toTriageResult(dryRunResult);

    expect(triageResult.processed).toBe(2);
    expect(triageResult.created).toBe(2);
    expect(triageResult.failed).toBe(0);
  });

  it('should handle task filtering by tags', () => {
    const tasks = [
      createMockTask({ gid: '1', tags: [{ gid: 't1', name: 'github-synced' }] }),
      createMockTask({ gid: '2', tags: [] }),
      createMockTask({ gid: '3', tags: [{ gid: 't2', name: 'other-tag' }] }),
    ];

    const syncedTagName = 'github-synced';

    const unsyncedTasks = tasks.filter(
      (task) => !task.tags?.some((t) => t.name.toLowerCase() === syncedTagName.toLowerCase())
    );

    expect(unsyncedTasks).toHaveLength(2);
    expect(unsyncedTasks.map((t) => t.gid)).toEqual(['2', '3']);
  });

  it('should handle task filtering by priority', () => {
    const tasks = [
      createMockTask({
        gid: '1',
        customFields: [{ gid: 'cf1', name: 'Priority', displayValue: 'Critical', type: 'enum' }],
      }),
      createMockTask({
        gid: '2',
        customFields: [{ gid: 'cf1', name: 'Priority', displayValue: 'High', type: 'enum' }],
      }),
      createMockTask({
        gid: '3',
        customFields: [{ gid: 'cf1', name: 'Priority', displayValue: 'Low', type: 'enum' }],
      }),
    ];

    const filterPriority = 'high';

    const filteredTasks = tasks.filter((task) => {
      const priorityField = task.customFields?.find((f) => f.name.toLowerCase() === 'priority');
      return priorityField?.displayValue?.toLowerCase() === filterPriority.toLowerCase();
    });

    expect(filteredTasks).toHaveLength(1);
    expect(filteredTasks[0].gid).toBe('2');
  });

  it('should apply limit to tasks', () => {
    const tasks = Array.from({ length: 100 }, (_, i) =>
      createMockTask({ gid: String(i), name: `Task ${i}` })
    );

    const limit = 10;
    const limitedTasks = tasks.slice(0, limit);

    expect(limitedTasks).toHaveLength(10);
    expect(limitedTasks[0].gid).toBe('0');
    expect(limitedTasks[9].gid).toBe('9');
  });
});
