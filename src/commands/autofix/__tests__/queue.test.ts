/**
 * @module commands/autofix/__tests__/queue.test
 * @description Tests for ProcessingQueue
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessingQueue, createQueue, type QueueEvent } from '../queue.js';
import type { IssueGroup, Issue, GroupBy } from '../../../common/types/index.js';
import type { GroupResult } from '../types.js';

// Mock issue factory
function createMockIssue(number: number): Issue {
  return {
    number,
    title: `Test Issue ${number}`,
    body: 'Test body',
    state: 'open',
    type: 'bug',
    labels: ['auto-fix'],
    assignees: [],
    context: {
      component: 'test',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: `https://github.com/test/repo/issues/${number}`,
  };
}

// Mock issue group factory
function createMockGroup(id: string, issueNumbers: number[]): IssueGroup {
  return {
    id,
    name: `Group ${id}`,
    groupBy: 'component' as GroupBy,
    key: 'test',
    issues: issueNumbers.map(n => createMockIssue(n)),
    branchName: `fix/${id}`,
    relatedFiles: [],
    components: ['test'],
    priority: 'medium',
  };
}

// Mock result factory
function createMockResult(group: IssueGroup, status: 'completed' | 'failed'): GroupResult {
  return {
    group,
    status,
    attempts: 1,
    durationMs: 100,
    startedAt: new Date(),
    completedAt: new Date(),
  };
}

describe('ProcessingQueue', () => {
  let queue: ProcessingQueue;

  beforeEach(() => {
    queue = new ProcessingQueue(3, 3);
  });

  afterEach(() => {
    queue.forceStop();
  });

  describe('constructor', () => {
    it('should create queue with default concurrency', () => {
      const q = createQueue();
      expect(q.getStats().total).toBe(0);
    });

    it('should create queue with custom concurrency', () => {
      const q = new ProcessingQueue(5, 2);
      expect(q.getStats().total).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('should add groups to queue', () => {
      const groups = [
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
      ];

      queue.enqueue(groups);

      const stats = queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
    });

    it('should emit item_queued events', () => {
      const events: QueueEvent[] = [];
      queue.on(event => events.push(event));

      queue.enqueue([createMockGroup('g1', [1])]);

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('item_queued');
    });
  });

  describe('start', () => {
    it('should process all items', async () => {
      const groups = [
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
      ];

      queue.enqueue(groups);
      queue.setProcessor(async (group) => createMockResult(group, 'completed'));

      const results = await queue.start();

      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 'completed')).toBe(true);
    });

    it('should throw if no processor set', async () => {
      queue.enqueue([createMockGroup('g1', [1])]);

      await expect(queue.start()).rejects.toThrow('No processor function set');
    });

    it('should respect concurrency limit', async () => {
      const queue = new ProcessingQueue(2, 3);
      let concurrent = 0;
      let maxConcurrent = 0;

      const groups = [
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
        createMockGroup('g3', [3]),
        createMockGroup('g4', [4]),
      ];

      queue.enqueue(groups);
      queue.setProcessor(async (group) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrent--;
        return createMockResult(group, 'completed');
      });

      await queue.start();

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should handle failures with retry', async () => {
      const group = createMockGroup('g1', [1]);
      let attempts = 0;

      queue.enqueue([group]);
      queue.setProcessor(async (g, attempt) => {
        attempts++;
        if (attempt < 3) {
          return {
            ...createMockResult(g, 'failed'),
            error: 'Simulated failure',
          };
        }
        return createMockResult(g, 'completed');
      });

      const results = await queue.start();

      expect(attempts).toBe(3);
      expect(results[0]?.status).toBe('completed');
    });

    it('should fail after max retries', async () => {
      const queue = new ProcessingQueue(3, 2);
      const group = createMockGroup('g1', [1]);

      queue.enqueue([group]);
      queue.setProcessor(async (g) => ({
        ...createMockResult(g, 'failed'),
        error: 'Persistent failure',
      }));

      const results = await queue.start();

      expect(results[0]?.status).toBe('failed');
      expect(results[0]?.error).toBe('Persistent failure');
    });
  });

  describe('events', () => {
    it('should emit item_started when processing begins', async () => {
      const events: QueueEvent[] = [];
      queue.on(event => events.push(event));

      queue.enqueue([createMockGroup('g1', [1])]);
      queue.setProcessor(async (group) => createMockResult(group, 'completed'));

      await queue.start();

      const startEvents = events.filter(e => e.type === 'item_started');
      expect(startEvents).toHaveLength(1);
    });

    it('should emit item_completed on success', async () => {
      const events: QueueEvent[] = [];
      queue.on(event => events.push(event));

      queue.enqueue([createMockGroup('g1', [1])]);
      queue.setProcessor(async (group) => createMockResult(group, 'completed'));

      await queue.start();

      const completeEvents = events.filter(e => e.type === 'item_completed');
      expect(completeEvents).toHaveLength(1);
    });

    it('should emit item_retrying on recoverable failure', async () => {
      const events: QueueEvent[] = [];
      let attempt = 0;

      queue.on(event => events.push(event));
      queue.enqueue([createMockGroup('g1', [1])]);
      queue.setProcessor(async (group) => {
        attempt++;
        if (attempt === 1) {
          return { ...createMockResult(group, 'failed'), error: 'First try' };
        }
        return createMockResult(group, 'completed');
      });

      await queue.start();

      const retryEvents = events.filter(e => e.type === 'item_retrying');
      expect(retryEvents).toHaveLength(1);
    });

    it('should allow removing listeners', async () => {
      const events: QueueEvent[] = [];
      const unsubscribe = queue.on(event => events.push(event));

      queue.enqueue([createMockGroup('g1', [1])]);
      unsubscribe();

      queue.enqueue([createMockGroup('g2', [2])]);

      expect(events).toHaveLength(1);
    });
  });

  describe('pause/resume', () => {
    it('should pause processing', async () => {
      const processedIds: string[] = [];

      queue.enqueue([
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
        createMockGroup('g3', [3]),
      ]);

      queue.setProcessor(async (group) => {
        processedIds.push(group.id);
        if (group.id === 'g1') {
          queue.pause();
        }
        return createMockResult(group, 'completed');
      });

      // Start in background
      const promise = queue.start();

      // Wait a bit and resume
      await new Promise(resolve => setTimeout(resolve, 200));
      queue.resume();

      await promise;

      expect(processedIds.length).toBe(3);
    });
  });

  describe('stop', () => {
    it('should stop queue gracefully', async () => {
      const queue = new ProcessingQueue(1, 3);

      queue.enqueue([
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
      ]);

      queue.setProcessor(async (group) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return createMockResult(group, 'completed');
      });

      // Start and stop
      const promise = queue.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      await queue.stop();

      const results = await promise;
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should force stop immediately', () => {
      queue.enqueue([createMockGroup('g1', [1])]);
      queue.setProcessor(async (group) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return createMockResult(group, 'completed');
      });

      queue.start();
      queue.forceStop();

      expect(queue.isActive()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const groups = [
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
        createMockGroup('g3', [3]),
      ];

      queue.enqueue(groups);

      let stats = queue.getStats();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(3);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);

      queue.setProcessor(async (group) => createMockResult(group, 'completed'));
      await queue.start();

      stats = queue.getStats();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(0);
      expect(stats.completed).toBe(3);
    });
  });

  describe('getResults', () => {
    it('should return all completed results', async () => {
      queue.enqueue([
        createMockGroup('g1', [1]),
        createMockGroup('g2', [2]),
      ]);

      queue.setProcessor(async (group) => createMockResult(group, 'completed'));
      await queue.start();

      const results = queue.getResults();
      expect(results).toHaveLength(2);
    });
  });

  describe('isEmpty', () => {
    it('should return true when queue is empty', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false when items are pending', () => {
      queue.enqueue([createMockGroup('g1', [1])]);
      expect(queue.isEmpty()).toBe(false);
    });
  });
});
