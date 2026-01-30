/**
 * @module commands/triage/__tests__/processor.test
 * @description Processor tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AsanaTask, TriageOptions, TaskAnalysis } from '../types.js';
import { DEFAULT_TRIAGE_CONFIG } from '../types.js';
import { DryRunSimulator, simulateActions, formatDryRunResult, toTriageResult } from '../dry-run.js';

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

// Mock analysis factory
function createMockAnalysis(overrides: Partial<TaskAnalysis> = {}): TaskAnalysis {
  return {
    issueType: 'feature',
    priority: 'medium',
    labels: ['auto-fix'],
    component: 'general',
    relatedFiles: [],
    summary: 'Test summary',
    acceptanceCriteria: ['AC1', 'AC2'],
    confidence: 0.8,
    ...overrides,
  };
}

describe('DryRunSimulator', () => {
  let simulator: DryRunSimulator;

  beforeEach(() => {
    simulator = new DryRunSimulator();
  });

  describe('simulateAnalysis', () => {
    it('should record analysis action', () => {
      const task = createMockTask();

      const analysis = simulator.simulateAnalysis(task);

      const actions = simulator.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('ANALYZE_TASK');
      expect(actions[0].taskGid).toBe(task.gid);
      expect(actions[0].taskName).toBe(task.name);
    });

    it('should return mock analysis', () => {
      const task = createMockTask();

      const analysis = simulator.simulateAnalysis(task);

      expect(analysis.issueType).toBe('feature');
      expect(analysis.priority).toBe('medium');
      expect(analysis.confidence).toBeGreaterThan(0);
    });
  });

  describe('simulateCreateIssue', () => {
    it('should record issue creation action', () => {
      const task = createMockTask();
      const analysis = createMockAnalysis();

      const issueInfo = simulator.simulateCreateIssue(task, analysis);

      const actions = simulator.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('CREATE_GITHUB_ISSUE');
      expect(actions[0].taskGid).toBe(task.gid);
    });

    it('should return mock issue info', () => {
      const task = createMockTask();
      const analysis = createMockAnalysis();

      const issueInfo = simulator.simulateCreateIssue(task, analysis);

      expect(issueInfo.asanaTaskGid).toBe(task.gid);
      expect(issueInfo.githubIssueNumber).toBeGreaterThan(0);
      expect(issueInfo.githubIssueUrl).toContain('github.com');
      expect(issueInfo.title).toBe(task.name);
    });
  });

  describe('simulateUpdateTask', () => {
    it('should record section move action', () => {
      const task = createMockTask();

      simulator.simulateUpdateTask(task, { sectionGid: '111' });

      const actions = simulator.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('MOVE_SECTION');
    });

    it('should record tag actions', () => {
      const task = createMockTask();

      simulator.simulateUpdateTask(task, { tagGids: ['tag1', 'tag2'] });

      const actions = simulator.getActions();
      expect(actions).toHaveLength(2);
      expect(actions[0].type).toBe('ADD_TAG');
      expect(actions[1].type).toBe('ADD_TAG');
    });

    it('should record comment action', () => {
      const task = createMockTask();

      simulator.simulateUpdateTask(task, { comment: 'Test comment' });

      const actions = simulator.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('ADD_COMMENT');
    });

    it('should record custom fields update', () => {
      const task = createMockTask();

      simulator.simulateUpdateTask(task, { customFields: { field1: 'value1' } });

      const actions = simulator.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('UPDATE_ASANA_TASK');
    });

    it('should record multiple updates', () => {
      const task = createMockTask();

      simulator.simulateUpdateTask(task, {
        sectionGid: '111',
        tagGids: ['tag1'],
        comment: 'Comment',
        customFields: { field1: 'value1' },
      });

      const actions = simulator.getActions();
      expect(actions).toHaveLength(4);
    });
  });

  describe('getResult', () => {
    it('should return summary of all actions', () => {
      const task1 = createMockTask({ gid: '1', name: 'Task 1' });
      const task2 = createMockTask({ gid: '2', name: 'Task 2' });

      simulator.simulateAnalysis(task1);
      simulator.simulateCreateIssue(task1, createMockAnalysis());
      simulator.simulateUpdateTask(task1, { sectionGid: '111', tagGids: ['tag1'] });

      simulator.simulateAnalysis(task2);
      simulator.simulateCreateIssue(task2, createMockAnalysis());
      simulator.simulateUpdateTask(task2, { sectionGid: '111' });

      const result = simulator.getResult();

      expect(result.summary.totalTasks).toBe(2);
      expect(result.summary.issuesWouldCreate).toBe(2);
      expect(result.summary.sectionsWouldMove).toBe(2);
      expect(result.summary.tagsWouldAdd).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all actions', () => {
      const task = createMockTask();
      simulator.simulateAnalysis(task);

      simulator.clear();

      expect(simulator.getActions()).toHaveLength(0);
    });
  });
});

describe('simulateActions', () => {
  it('should simulate full workflow for multiple tasks', () => {
    const tasks = [
      createMockTask({ gid: '1', name: 'Task 1' }),
      createMockTask({ gid: '2', name: 'Task 2' }),
      createMockTask({ gid: '3', name: 'Task 3' }),
    ];

    const result = simulateActions(tasks);

    expect(result.summary.totalTasks).toBe(3);
    expect(result.summary.issuesWouldCreate).toBe(3);
    expect(result.actions.length).toBeGreaterThan(3); // Analysis + Create + Updates
  });

  it('should handle empty task list', () => {
    const result = simulateActions([]);

    expect(result.summary.totalTasks).toBe(0);
    expect(result.summary.issuesWouldCreate).toBe(0);
    expect(result.actions).toHaveLength(0);
  });
});

describe('formatDryRunResult', () => {
  it('should include header', () => {
    const result = simulateActions([createMockTask()]);
    const formatted = formatDryRunResult(result);

    expect(formatted).toContain('DRY RUN SIMULATION');
  });

  it('should include task actions', () => {
    const task = createMockTask({ name: 'My Test Task' });
    const result = simulateActions([task]);
    const formatted = formatDryRunResult(result);

    expect(formatted).toContain('My Test Task');
    expect(formatted).toContain('[ANALYZE]');
    expect(formatted).toContain('[CREATE]');
  });

  it('should include summary', () => {
    const result = simulateActions([createMockTask(), createMockTask()]);
    const formatted = formatDryRunResult(result);

    expect(formatted).toContain('Summary');
    expect(formatted).toContain('Tasks to process:');
    expect(formatted).toContain('GitHub issues to create:');
  });

  it('should include dry-run note', () => {
    const result = simulateActions([createMockTask()]);
    const formatted = formatDryRunResult(result);

    expect(formatted).toContain('No changes were made');
  });
});

describe('toTriageResult', () => {
  it('should convert dry run result to triage result', () => {
    const dryRunResult = simulateActions([
      createMockTask({ gid: '1' }),
      createMockTask({ gid: '2' }),
    ]);

    const triageResult = toTriageResult(dryRunResult);

    expect(triageResult.processed).toBe(2);
    expect(triageResult.created).toBe(2);
    expect(triageResult.skipped).toBe(0);
    expect(triageResult.failed).toBe(0);
  });
});

describe('Task filtering', () => {
  it('should filter tasks with synced tag', () => {
    const tasks = [
      createMockTask({
        gid: '1',
        tags: [{ gid: 't1', name: 'github-synced' }],
      }),
      createMockTask({
        gid: '2',
        tags: [],
      }),
    ];

    const unsynced = tasks.filter(
      (t) => !t.tags?.some((tag) => tag.name.toLowerCase() === 'github-synced')
    );

    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].gid).toBe('2');
  });

  it('should filter tasks by priority custom field', () => {
    const tasks = [
      createMockTask({
        gid: '1',
        customFields: [
          { gid: 'cf1', name: 'Priority', displayValue: 'High', type: 'enum' },
        ],
      }),
      createMockTask({
        gid: '2',
        customFields: [
          { gid: 'cf1', name: 'Priority', displayValue: 'Low', type: 'enum' },
        ],
      }),
    ];

    const highPriority = tasks.filter((t) => {
      const priorityField = t.customFields?.find(
        (f) => f.name.toLowerCase() === 'priority'
      );
      return priorityField?.displayValue?.toLowerCase() === 'high';
    });

    expect(highPriority).toHaveLength(1);
    expect(highPriority[0].gid).toBe('1');
  });
});

describe('Options validation', () => {
  it('should have valid default config', () => {
    expect(DEFAULT_TRIAGE_CONFIG.triageSectionName).toBeTruthy();
    expect(DEFAULT_TRIAGE_CONFIG.processedSectionName).toBeTruthy();
    expect(DEFAULT_TRIAGE_CONFIG.syncedTagName).toBeTruthy();
    expect(DEFAULT_TRIAGE_CONFIG.maxBatchSize).toBeGreaterThan(0);
    expect(DEFAULT_TRIAGE_CONFIG.retry.maxAttempts).toBeGreaterThan(0);
    expect(DEFAULT_TRIAGE_CONFIG.retry.initialDelayMs).toBeGreaterThan(0);
  });

  it('should have sensible retry config', () => {
    expect(DEFAULT_TRIAGE_CONFIG.retry.maxDelayMs).toBeGreaterThanOrEqual(
      DEFAULT_TRIAGE_CONFIG.retry.initialDelayMs
    );
  });
});
