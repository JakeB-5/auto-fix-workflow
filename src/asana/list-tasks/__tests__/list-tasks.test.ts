/**
 * @module asana/list-tasks/__tests__/list-tasks.test
 * @description Unit tests for Asana task listing functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Asana from 'asana';
import {
  listTasks,
  listAllTasks,
  type ListTasksOptions,
  type TaskListItem,
} from '../list.js';
import { filterTasks, type TaskFilterCriteria } from '../filter.js';
import { getAsanaClient, resetClient } from '../client.js';
import {
  getSectionGidByName,
  clearSectionCache,
  getSectionsWithCache,
} from '../cache.js';
import type { AsanaConfig } from '../../../common/types/index.js';

// Mock Asana client
vi.mock('../client.js', () => ({
  getAsanaClient: vi.fn(),
  resetClient: vi.fn(),
  createClient: vi.fn(),
}));

// Mock cache module
vi.mock('../cache.js', async () => {
  const actual = await vi.importActual('../cache.js');
  return {
    ...actual,
    getSectionGidByName: vi.fn(),
    getSectionsWithCache: vi.fn(),
  };
});

describe('listTasks', () => {
  let mockClient: {
    tasks: {
      getTasksForProject: ReturnType<typeof vi.fn>;
      getTasksForSection: ReturnType<typeof vi.fn>;
    };
  };

  const mockConfig: AsanaConfig = {
    token: 'test-token',
    workspaceGid: 'workspace-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearSectionCache();

    // Create mock Asana client
    mockClient = {
      tasks: {
        getTasksForProject: vi.fn(),
        getTasksForSection: vi.fn(),
      },
    };

    vi.mocked(getAsanaClient).mockReturnValue(
      mockClient as unknown as Asana.Client
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic task list retrieval', () => {
    it('should fetch tasks from a project', async () => {
      const mockResponse = {
        data: [
          {
            gid: 'task-1',
            name: 'Test Task 1',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-02T00:00:00.000Z',
            due_on: '2024-01-15',
            due_at: null,
            assignee: {
              gid: 'user-1',
              name: 'John Doe',
            },
            tags: [
              { gid: 'tag-1', name: 'urgent' },
              { gid: 'tag-2', name: 'bug' },
            ],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-1',
          },
          {
            gid: 'task-2',
            name: 'Test Task 2',
            completed: true,
            completed_at: '2024-01-10T00:00:00.000Z',
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-10T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [
              {
                gid: 'cf-1',
                name: 'Priority',
                display_value: 'High',
              },
            ],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-2',
          },
        ],
        _response: {
          next_page: null,
        },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(mockResponse);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
      };

      const result = await listTasks(mockConfig, options);

      expect(result.tasks).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextOffset).toBeNull();

      // Verify first task mapping
      expect(result.tasks[0]).toEqual({
        gid: 'task-1',
        name: 'Test Task 1',
        completed: false,
        completedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-02T00:00:00.000Z',
        dueOn: '2024-01-15',
        dueAt: null,
        assignee: {
          gid: 'user-1',
          name: 'John Doe',
        },
        tags: [
          { gid: 'tag-1', name: 'urgent' },
          { gid: 'tag-2', name: 'bug' },
        ],
        customFields: [],
        resourceSubtype: 'default_task',
        permalink: 'https://app.asana.com/0/task-1',
      });

      // Verify API was called correctly
      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledWith(
        'project-123',
        expect.objectContaining({
          opt_fields: expect.any(String),
          completed_since: 'now',
        })
      );
    });

    it('should include completed tasks when requested', async () => {
      const mockResponse = {
        data: [],
        _response: { next_page: null },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(mockResponse);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
        includeCompleted: true,
      };

      await listTasks(mockConfig, options);

      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledWith(
        'project-123',
        expect.not.objectContaining({
          completed_since: expect.anything(),
        })
      );
    });

    it('should handle pagination with limit and offset', async () => {
      const mockResponse = {
        data: [
          {
            gid: 'task-1',
            name: 'Task 1',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-01T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-1',
          },
        ],
        _response: {
          next_page: {
            offset: 'next-offset-token',
          },
        },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(mockResponse);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
        limit: 50,
        offset: 'prev-offset',
      };

      const result = await listTasks(mockConfig, options);

      expect(result.hasMore).toBe(true);
      expect(result.nextOffset).toBe('next-offset-token');

      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledWith(
        'project-123',
        expect.objectContaining({
          limit: 50,
          offset: 'prev-offset',
        })
      );
    });

    it('should handle empty result set', async () => {
      const mockResponse = {
        data: [],
        _response: { next_page: null },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(mockResponse);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
      };

      const result = await listTasks(mockConfig, options);

      expect(result.tasks).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextOffset).toBeNull();
    });
  });

  describe('section filtering', () => {
    it('should fetch tasks from a specific section', async () => {
      const mockResponse = {
        data: [
          {
            gid: 'task-1',
            name: 'Section Task',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-01T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-1',
          },
        ],
        _response: { next_page: null },
      };

      vi.mocked(getSectionGidByName).mockResolvedValue('section-123');
      mockClient.tasks.getTasksForSection.mockResolvedValue(mockResponse);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
        sectionName: 'In Progress',
      };

      const result = await listTasks(mockConfig, options);

      expect(result.tasks).toHaveLength(1);
      expect(getSectionGidByName).toHaveBeenCalledWith(
        mockClient,
        'project-123',
        'In Progress'
      );
      expect(mockClient.tasks.getTasksForSection).toHaveBeenCalledWith(
        'section-123',
        expect.any(Object)
      );
    });

    it('should fall back to project query when section not found', async () => {
      const mockResponse = {
        data: [],
        _response: { next_page: null },
      };

      vi.mocked(getSectionGidByName).mockResolvedValue(null);
      mockClient.tasks.getTasksForProject.mockResolvedValue(mockResponse);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
        sectionName: 'NonExistent Section',
      };

      await listTasks(mockConfig, options);

      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledWith(
        'project-123',
        expect.any(Object)
      );
      expect(mockClient.tasks.getTasksForSection).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      const apiError = new Error('API Error: Unauthorized');
      mockClient.tasks.getTasksForProject.mockRejectedValue(apiError);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
      };

      await expect(listTasks(mockConfig, options)).rejects.toThrow(
        'API Error: Unauthorized'
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      mockClient.tasks.getTasksForProject.mockRejectedValue(networkError);

      const options: ListTasksOptions = {
        projectGid: 'project-123',
      };

      await expect(listTasks(mockConfig, options)).rejects.toThrow(
        'Network timeout'
      );
    });

    it('should handle malformed API responses', async () => {
      // Response with missing required fields
      const malformedResponse = {
        data: [
          {
            gid: 'task-1',
            // missing name
          },
        ],
        _response: { next_page: null },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(
        malformedResponse as never
      );

      const options: ListTasksOptions = {
        projectGid: 'project-123',
      };

      const result = await listTasks(mockConfig, options);

      // Should not throw, but map as best as possible
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]?.gid).toBe('task-1');
    });
  });

  describe('listAllTasks (pagination)', () => {
    it('should auto-paginate through all results', async () => {
      const page1 = {
        data: [
          {
            gid: 'task-1',
            name: 'Task 1',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-01T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-1',
          },
        ],
        _response: {
          next_page: { offset: 'offset-2' },
        },
      };

      const page2 = {
        data: [
          {
            gid: 'task-2',
            name: 'Task 2',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-01T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-2',
          },
        ],
        _response: {
          next_page: { offset: 'offset-3' },
        },
      };

      const page3 = {
        data: [
          {
            gid: 'task-3',
            name: 'Task 3',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-01T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-3',
          },
        ],
        _response: {
          next_page: null,
        },
      };

      mockClient.tasks.getTasksForProject
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2)
        .mockResolvedValueOnce(page3);

      const tasks = await listAllTasks(mockConfig, {
        projectGid: 'project-123',
      });

      expect(tasks).toHaveLength(3);
      expect(tasks.map((t) => t.gid)).toEqual(['task-1', 'task-2', 'task-3']);
      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledTimes(3);
    });

    it('should handle single page results', async () => {
      const singlePage = {
        data: [
          {
            gid: 'task-1',
            name: 'Only Task',
            completed: false,
            completed_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-01T00:00:00.000Z',
            due_on: null,
            due_at: null,
            assignee: null,
            tags: [],
            custom_fields: [],
            resource_subtype: 'default_task',
            permalink_url: 'https://app.asana.com/0/task-1',
          },
        ],
        _response: {
          next_page: null,
        },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(singlePage);

      const tasks = await listAllTasks(mockConfig, {
        projectGid: 'project-123',
      });

      expect(tasks).toHaveLength(1);
      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      const emptyPage = {
        data: [],
        _response: {
          next_page: null,
        },
      };

      mockClient.tasks.getTasksForProject.mockResolvedValue(emptyPage);

      const tasks = await listAllTasks(mockConfig, {
        projectGid: 'project-123',
      });

      expect(tasks).toHaveLength(0);
      expect(mockClient.tasks.getTasksForProject).toHaveBeenCalledTimes(1);
    });
  });
});

describe('filterTasks', () => {
  const createMockTask = (overrides: Partial<TaskListItem> = {}): TaskListItem => ({
    gid: 'task-1',
    name: 'Test Task',
    completed: false,
    completedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    modifiedAt: '2024-01-01T00:00:00.000Z',
    dueOn: null,
    dueAt: null,
    assignee: null,
    tags: [],
    customFields: [],
    resourceSubtype: 'default_task',
    permalink: 'https://app.asana.com/0/task-1',
    ...overrides,
  });

  describe('tag filtering', () => {
    it('should filter tasks by included tags (any match)', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          tags: [{ gid: 'tag-1', name: 'urgent' }],
        }),
        createMockTask({
          gid: 'task-2',
          tags: [{ gid: 'tag-2', name: 'bug' }],
        }),
        createMockTask({
          gid: 'task-3',
          tags: [{ gid: 'tag-3', name: 'feature' }],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        tags: ['urgent', 'bug'],
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.gid)).toEqual(['task-1', 'task-2']);
    });

    it('should exclude tasks by tags', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          tags: [{ gid: 'tag-1', name: 'urgent' }],
        }),
        createMockTask({
          gid: 'task-2',
          tags: [{ gid: 'tag-2', name: 'bug' }],
        }),
        createMockTask({
          gid: 'task-3',
          tags: [],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        excludeTags: ['urgent'],
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.gid)).toEqual(['task-2', 'task-3']);
    });

    it('should handle tag filtering with case insensitivity', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          tags: [{ gid: 'tag-1', name: 'URGENT' }],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        tags: ['urgent'],
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
    });

    it('should combine include and exclude tags', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          tags: [
            { gid: 'tag-1', name: 'bug' },
            { gid: 'tag-2', name: 'critical' },
          ],
        }),
        createMockTask({
          gid: 'task-2',
          tags: [{ gid: 'tag-1', name: 'bug' }],
        }),
        createMockTask({
          gid: 'task-3',
          tags: [{ gid: 'tag-3', name: 'feature' }],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        tags: ['bug'],
        excludeTags: ['critical'],
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-2');
    });
  });

  describe('assignee filtering', () => {
    it('should filter by assignee GID', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          assignee: { gid: 'user-1', name: 'Alice' },
        }),
        createMockTask({
          gid: 'task-2',
          assignee: { gid: 'user-2', name: 'Bob' },
        }),
        createMockTask({
          gid: 'task-3',
          assignee: null,
        }),
      ];

      const criteria: TaskFilterCriteria = {
        assigneeGid: 'user-1',
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-1');
    });

    it('should filter unassigned tasks only', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          assignee: { gid: 'user-1', name: 'Alice' },
        }),
        createMockTask({
          gid: 'task-2',
          assignee: null,
        }),
        createMockTask({
          gid: 'task-3',
          assignee: null,
        }),
      ];

      const criteria: TaskFilterCriteria = {
        unassignedOnly: true,
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.gid)).toEqual(['task-2', 'task-3']);
    });
  });

  describe('due date filtering', () => {
    it('should filter tasks due before a date', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          dueOn: '2024-01-10',
        }),
        createMockTask({
          gid: 'task-2',
          dueOn: '2024-01-20',
        }),
        createMockTask({
          gid: 'task-3',
          dueOn: '2024-01-30',
        }),
      ];

      const criteria: TaskFilterCriteria = {
        dueBefore: new Date('2024-01-21'),
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.gid)).toEqual(['task-1', 'task-2']);
    });

    it('should filter tasks due after a date', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          dueOn: '2024-01-10',
        }),
        createMockTask({
          gid: 'task-2',
          dueOn: '2024-01-20',
        }),
        createMockTask({
          gid: 'task-3',
          dueOn: '2024-01-30',
        }),
      ];

      const criteria: TaskFilterCriteria = {
        dueAfter: new Date('2024-01-15'),
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.gid)).toEqual(['task-2', 'task-3']);
    });

    it('should filter overdue tasks', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          dueOn: yesterday.toISOString().split('T')[0],
        }),
        createMockTask({
          gid: 'task-2',
          dueOn: tomorrow.toISOString().split('T')[0],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        overdueOnly: true,
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-1');
    });

    it('should exclude tasks without due dates from date filters', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          dueOn: '2024-01-15',
        }),
        createMockTask({
          gid: 'task-2',
          dueOn: null,
        }),
      ];

      const criteria: TaskFilterCriteria = {
        dueBefore: new Date('2024-01-20'),
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-1');
    });
  });

  describe('custom field filtering', () => {
    it('should filter by custom field values', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          customFields: [
            { gid: 'cf-1', name: 'Priority', displayValue: 'High' },
          ],
        }),
        createMockTask({
          gid: 'task-2',
          customFields: [
            { gid: 'cf-1', name: 'Priority', displayValue: 'Low' },
          ],
        }),
        createMockTask({
          gid: 'task-3',
          customFields: [],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        customFields: {
          Priority: 'High',
        },
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-1');
    });

    it('should handle multiple custom field filters', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          customFields: [
            { gid: 'cf-1', name: 'Priority', displayValue: 'High' },
            { gid: 'cf-2', name: 'Status', displayValue: 'Active' },
          ],
        }),
        createMockTask({
          gid: 'task-2',
          customFields: [
            { gid: 'cf-1', name: 'Priority', displayValue: 'High' },
            { gid: 'cf-2', name: 'Status', displayValue: 'Inactive' },
          ],
        }),
      ];

      const criteria: TaskFilterCriteria = {
        customFields: {
          Priority: 'High',
          Status: 'Active',
        },
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-1');
    });
  });

  describe('name search filtering', () => {
    it('should filter by name substring (case insensitive)', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          name: 'Fix login bug',
        }),
        createMockTask({
          gid: 'task-2',
          name: 'Add new feature',
        }),
        createMockTask({
          gid: 'task-3',
          name: 'Fix payment bug',
        }),
      ];

      const criteria: TaskFilterCriteria = {
        nameContains: 'bug',
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.gid)).toEqual(['task-1', 'task-3']);
    });
  });

  describe('resource subtype filtering', () => {
    it('should filter by resource subtype', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          resourceSubtype: 'default_task',
        }),
        createMockTask({
          gid: 'task-2',
          resourceSubtype: 'milestone',
        }),
        createMockTask({
          gid: 'task-3',
          resourceSubtype: 'default_task',
        }),
      ];

      const criteria: TaskFilterCriteria = {
        resourceSubtype: 'milestone',
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-2');
    });
  });

  describe('complex multi-criteria filtering', () => {
    it('should apply multiple filters simultaneously', () => {
      const tasks: TaskListItem[] = [
        createMockTask({
          gid: 'task-1',
          name: 'Fix urgent bug',
          tags: [{ gid: 'tag-1', name: 'bug' }],
          assignee: { gid: 'user-1', name: 'Alice' },
          dueOn: '2024-01-15',
        }),
        createMockTask({
          gid: 'task-2',
          name: 'Fix minor bug',
          tags: [{ gid: 'tag-1', name: 'bug' }],
          assignee: { gid: 'user-2', name: 'Bob' },
          dueOn: '2024-01-20',
        }),
        createMockTask({
          gid: 'task-3',
          name: 'Add feature',
          tags: [{ gid: 'tag-2', name: 'feature' }],
          assignee: { gid: 'user-1', name: 'Alice' },
          dueOn: '2024-01-10',
        }),
      ];

      const criteria: TaskFilterCriteria = {
        tags: ['bug'],
        assigneeGid: 'user-1',
        nameContains: 'urgent',
        dueBefore: new Date('2024-01-16'),
      };

      const result = filterTasks(tasks, criteria);

      expect(result).toHaveLength(1);
      expect(result[0]?.gid).toBe('task-1');
    });
  });
});
