/**
 * @module asana/list-tasks/__tests__/filter
 * @description Tests for task filtering and sorting utilities
 */

import { describe, it, expect } from 'vitest';
import {
  filterTasks,
  sortTasks,
  countByTag,
  countByAssignee,
  type TaskFilterCriteria,
} from '../filter.js';
import type { TaskListItem } from '../list.js';

const createMockTask = (overrides: Partial<TaskListItem> = {}): TaskListItem => ({
  gid: '123',
  name: 'Test Task',
  completed: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  modifiedAt: '2024-01-02T00:00:00.000Z',
  dueOn: null,
  dueAt: null,
  assignee: null,
  assigneeStatus: 'inbox',
  tags: [],
  projects: [],
  customFields: [],
  numSubtasks: 0,
  permalink: 'https://app.asana.com/0/0/123',
  resourceSubtype: 'default_task',
  ...overrides,
});

describe('asana/list-tasks/filter', () => {
  describe('filterTasks', () => {
    it('should return all tasks with empty criteria', () => {
      const tasks = [createMockTask(), createMockTask({ gid: '456' })];
      const result = filterTasks(tasks, {});
      expect(result).toHaveLength(2);
    });

    describe('tag filtering', () => {
      it('should filter by single tag', () => {
        const tasks = [
          createMockTask({ tags: [{ gid: 't1', name: 'bug' }] }),
          createMockTask({ tags: [{ gid: 't2', name: 'feature' }] }),
        ];
        const criteria: TaskFilterCriteria = { tags: ['bug'] };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].tags[0].name).toBe('bug');
      });

      it('should filter by multiple tags (OR logic)', () => {
        const tasks = [
          createMockTask({ tags: [{ gid: 't1', name: 'bug' }] }),
          createMockTask({ tags: [{ gid: 't2', name: 'feature' }] }),
          createMockTask({ tags: [{ gid: 't3', name: 'docs' }] }),
        ];
        const criteria: TaskFilterCriteria = { tags: ['bug', 'feature'] };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(2);
      });

      it('should be case-insensitive', () => {
        const tasks = [
          createMockTask({ tags: [{ gid: 't1', name: 'Bug' }] }),
        ];
        const criteria: TaskFilterCriteria = { tags: ['bug'] };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });

      it('should exclude tasks without matching tags', () => {
        const tasks = [
          createMockTask({ tags: [] }),
          createMockTask({ tags: [{ gid: 't1', name: 'other' }] }),
        ];
        const criteria: TaskFilterCriteria = { tags: ['bug'] };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(0);
      });
    });

    describe('tag exclusion', () => {
      it('should exclude tasks with specific tags', () => {
        const tasks = [
          createMockTask({ tags: [{ gid: 't1', name: 'bug' }] }),
          createMockTask({ tags: [{ gid: 't2', name: 'wontfix' }] }),
        ];
        const criteria: TaskFilterCriteria = { excludeTags: ['wontfix'] };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].tags[0].name).toBe('bug');
      });

      it('should be case-insensitive', () => {
        const tasks = [
          createMockTask({ tags: [{ gid: 't1', name: 'WontFix' }] }),
        ];
        const criteria: TaskFilterCriteria = { excludeTags: ['wontfix'] };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(0);
      });
    });

    describe('assignee filtering', () => {
      it('should filter by assignee GID', () => {
        const tasks = [
          createMockTask({ assignee: { gid: 'u1', name: 'John' } }),
          createMockTask({ assignee: { gid: 'u2', name: 'Jane' } }),
        ];
        const criteria: TaskFilterCriteria = { assigneeGid: 'u1' };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].assignee?.gid).toBe('u1');
      });

      it('should exclude tasks without assignee', () => {
        const tasks = [
          createMockTask({ assignee: null }),
          createMockTask({ assignee: { gid: 'u1', name: 'John' } }),
        ];
        const criteria: TaskFilterCriteria = { assigneeGid: 'u1' };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });

      it('should filter unassigned tasks', () => {
        const tasks = [
          createMockTask({ assignee: null }),
          createMockTask({ assignee: { gid: 'u1', name: 'John' } }),
        ];
        const criteria: TaskFilterCriteria = { unassignedOnly: true };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].assignee).toBeNull();
      });
    });

    describe('due date filtering', () => {
      it('should filter by due before date', () => {
        const tasks = [
          createMockTask({ dueOn: '2024-01-10' }),
          createMockTask({ dueOn: '2024-01-20' }),
        ];
        const criteria: TaskFilterCriteria = {
          dueBefore: new Date('2024-01-15'),
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].dueOn).toBe('2024-01-10');
      });

      it('should filter by due after date', () => {
        const tasks = [
          createMockTask({ dueOn: '2024-01-10' }),
          createMockTask({ dueOn: '2024-01-20' }),
        ];
        const criteria: TaskFilterCriteria = {
          dueAfter: new Date('2024-01-15'),
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].dueOn).toBe('2024-01-20');
      });

      it('should filter overdue tasks', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const tasks = [
          createMockTask({ dueOn: yesterday.toISOString().split('T')[0] }),
          createMockTask({ dueOn: tomorrow.toISOString().split('T')[0] }),
        ];
        const criteria: TaskFilterCriteria = { overdueOnly: true };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });

      it('should exclude tasks without due date when filtering by date', () => {
        const tasks = [
          createMockTask({ dueOn: null }),
          createMockTask({ dueOn: '2024-01-10' }),
        ];
        const criteria: TaskFilterCriteria = {
          dueBefore: new Date('2024-01-15'),
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });

      it('should use dueAt if dueOn is null', () => {
        const tasks = [
          createMockTask({ dueOn: null, dueAt: '2024-01-10T10:00:00.000Z' }),
        ];
        const criteria: TaskFilterCriteria = {
          dueBefore: new Date('2024-01-15'),
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });
    });

    describe('custom field filtering', () => {
      it('should filter by custom field value', () => {
        const tasks = [
          createMockTask({
            customFields: [
              { gid: 'cf1', name: 'Priority', displayValue: 'High', type: 'enum' },
            ],
          }),
          createMockTask({
            customFields: [
              { gid: 'cf1', name: 'Priority', displayValue: 'Low', type: 'enum' },
            ],
          }),
        ];
        const criteria: TaskFilterCriteria = {
          customFields: { Priority: 'High' },
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].customFields[0].displayValue).toBe('High');
      });

      it('should be case-insensitive for field name', () => {
        const tasks = [
          createMockTask({
            customFields: [
              { gid: 'cf1', name: 'Priority', displayValue: 'High', type: 'enum' },
            ],
          }),
        ];
        const criteria: TaskFilterCriteria = {
          customFields: { priority: 'High' },
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });

      it('should exclude tasks without the custom field', () => {
        const tasks = [
          createMockTask({ customFields: [] }),
          createMockTask({
            customFields: [
              { gid: 'cf1', name: 'Priority', displayValue: 'High', type: 'enum' },
            ],
          }),
        ];
        const criteria: TaskFilterCriteria = {
          customFields: { Priority: 'High' },
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });

      it('should match multiple custom fields', () => {
        const tasks = [
          createMockTask({
            customFields: [
              { gid: 'cf1', name: 'Priority', displayValue: 'High', type: 'enum' },
              { gid: 'cf2', name: 'Status', displayValue: 'Active', type: 'enum' },
            ],
          }),
        ];
        const criteria: TaskFilterCriteria = {
          customFields: { Priority: 'High', Status: 'Active' },
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });
    });

    describe('name search', () => {
      it('should filter by name substring', () => {
        const tasks = [
          createMockTask({ name: 'Fix login bug' }),
          createMockTask({ name: 'Add new feature' }),
        ];
        const criteria: TaskFilterCriteria = { nameContains: 'bug' };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].name).toContain('bug');
      });

      it('should be case-insensitive', () => {
        const tasks = [
          createMockTask({ name: 'Fix Login Bug' }),
        ];
        const criteria: TaskFilterCriteria = { nameContains: 'bug' };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
      });
    });

    describe('resource subtype filtering', () => {
      it('should filter by resource subtype', () => {
        const tasks = [
          createMockTask({ resourceSubtype: 'default_task' }),
          createMockTask({ resourceSubtype: 'milestone' }),
        ];
        const criteria: TaskFilterCriteria = { resourceSubtype: 'milestone' };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].resourceSubtype).toBe('milestone');
      });
    });

    describe('combined filters', () => {
      it('should apply multiple filters (AND logic)', () => {
        const tasks = [
          createMockTask({
            tags: [{ gid: 't1', name: 'bug' }],
            assignee: { gid: 'u1', name: 'John' },
          }),
          createMockTask({
            tags: [{ gid: 't1', name: 'bug' }],
            assignee: { gid: 'u2', name: 'Jane' },
          }),
        ];
        const criteria: TaskFilterCriteria = {
          tags: ['bug'],
          assigneeGid: 'u1',
        };
        const result = filterTasks(tasks, criteria);
        expect(result).toHaveLength(1);
        expect(result[0].assignee?.gid).toBe('u1');
      });
    });
  });

  describe('sortTasks', () => {
    it('should sort by name ascending', () => {
      const tasks = [
        createMockTask({ name: 'Zebra' }),
        createMockTask({ name: 'Apple' }),
        createMockTask({ name: 'Banana' }),
      ];
      const result = sortTasks(tasks, 'name', 'asc');
      expect(result[0].name).toBe('Apple');
      expect(result[2].name).toBe('Zebra');
    });

    it('should sort by name descending', () => {
      const tasks = [
        createMockTask({ name: 'Apple' }),
        createMockTask({ name: 'Zebra' }),
      ];
      const result = sortTasks(tasks, 'name', 'desc');
      expect(result[0].name).toBe('Zebra');
      expect(result[1].name).toBe('Apple');
    });

    it('should sort by createdAt ascending', () => {
      const tasks = [
        createMockTask({ createdAt: '2024-01-03T00:00:00.000Z' }),
        createMockTask({ createdAt: '2024-01-01T00:00:00.000Z' }),
        createMockTask({ createdAt: '2024-01-02T00:00:00.000Z' }),
      ];
      const result = sortTasks(tasks, 'createdAt', 'asc');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result[2].createdAt).toBe('2024-01-03T00:00:00.000Z');
    });

    it('should sort by modifiedAt descending', () => {
      const tasks = [
        createMockTask({ modifiedAt: '2024-01-01T00:00:00.000Z' }),
        createMockTask({ modifiedAt: '2024-01-03T00:00:00.000Z' }),
      ];
      const result = sortTasks(tasks, 'modifiedAt', 'desc');
      expect(result[0].modifiedAt).toBe('2024-01-03T00:00:00.000Z');
    });

    it('should sort by dueOn with null values last', () => {
      const tasks = [
        createMockTask({ dueOn: '2024-01-15' }),
        createMockTask({ dueOn: null }),
        createMockTask({ dueOn: '2024-01-10' }),
      ];
      const result = sortTasks(tasks, 'dueOn', 'asc');
      expect(result[0].dueOn).toBe('2024-01-10');
      expect(result[1].dueOn).toBe('2024-01-15');
      expect(result[2].dueOn).toBeNull();
    });

    it('should sort by dueAt when dueOn is null', () => {
      const tasks = [
        createMockTask({ dueOn: null, dueAt: '2024-01-15T10:00:00.000Z' }),
        createMockTask({ dueOn: null, dueAt: '2024-01-10T10:00:00.000Z' }),
      ];
      const result = sortTasks(tasks, 'dueOn', 'asc');
      expect(result[0].dueAt).toBe('2024-01-10T10:00:00.000Z');
    });

    it('should default to ascending order', () => {
      const tasks = [
        createMockTask({ name: 'Zebra' }),
        createMockTask({ name: 'Apple' }),
      ];
      const result = sortTasks(tasks, 'name');
      expect(result[0].name).toBe('Apple');
    });

    it('should not mutate original array', () => {
      const tasks = [
        createMockTask({ name: 'Zebra' }),
        createMockTask({ name: 'Apple' }),
      ];
      const original = [...tasks];
      sortTasks(tasks, 'name', 'asc');
      expect(tasks).toEqual(original);
    });
  });

  describe('countByTag', () => {
    it('should count tasks by tag', () => {
      const tasks = [
        createMockTask({ tags: [{ gid: 't1', name: 'bug' }] }),
        createMockTask({ tags: [{ gid: 't1', name: 'bug' }] }),
        createMockTask({ tags: [{ gid: 't2', name: 'feature' }] }),
      ];
      const result = countByTag(tasks);
      expect(result.get('bug')).toBe(2);
      expect(result.get('feature')).toBe(1);
    });

    it('should handle tasks with multiple tags', () => {
      const tasks = [
        createMockTask({
          tags: [
            { gid: 't1', name: 'bug' },
            { gid: 't2', name: 'urgent' },
          ],
        }),
      ];
      const result = countByTag(tasks);
      expect(result.get('bug')).toBe(1);
      expect(result.get('urgent')).toBe(1);
    });

    it('should handle empty tasks', () => {
      const result = countByTag([]);
      expect(result.size).toBe(0);
    });

    it('should handle tasks without tags', () => {
      const tasks = [createMockTask({ tags: [] })];
      const result = countByTag(tasks);
      expect(result.size).toBe(0);
    });
  });

  describe('countByAssignee', () => {
    it('should count tasks by assignee', () => {
      const tasks = [
        createMockTask({ assignee: { gid: 'u1', name: 'John' } }),
        createMockTask({ assignee: { gid: 'u1', name: 'John' } }),
        createMockTask({ assignee: { gid: 'u2', name: 'Jane' } }),
      ];
      const result = countByAssignee(tasks);
      expect(result.get('John')).toBe(2);
      expect(result.get('Jane')).toBe(1);
    });

    it('should count unassigned tasks', () => {
      const tasks = [
        createMockTask({ assignee: null }),
        createMockTask({ assignee: null }),
        createMockTask({ assignee: { gid: 'u1', name: 'John' } }),
      ];
      const result = countByAssignee(tasks);
      expect(result.get('Unassigned')).toBe(2);
      expect(result.get('John')).toBe(1);
    });

    it('should handle empty tasks', () => {
      const result = countByAssignee([]);
      expect(result.size).toBe(0);
    });
  });
});
