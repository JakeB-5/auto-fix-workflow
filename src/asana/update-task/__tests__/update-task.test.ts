/**
 * @module asana/update-task/__tests__/update-task.test
 * @description Tests for Asana task update functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Asana from 'asana';
import {
  addTagToTask,
  removeTagFromTask,
  getWorkspaceTags,
  findTagByName,
  addTagsToTask,
  replaceTaskTags,
  type TagInfo,
} from '../tags.js';
import {
  addComment,
  addTextComment,
  addMarkdownComment,
  addPinnedComment,
  addPRLinkComment,
  addIssueLinkComment,
  addStatusComment,
  addWorkflowComment,
} from '../comments.js';
import {
  moveTaskToSection,
  moveTaskToSectionByName,
  moveToTriage,
  moveToDone,
  getCurrentSection,
} from '../sections.js';
import type { AsanaConfig } from '../../../common/types/index.js';

// Mock Asana client
const mockAsanaClient = {
  tasks: {
    addTagForTask: vi.fn(),
    removeTagForTask: vi.fn(),
    getTask: vi.fn(),
  },
  tags: {
    getTagsForWorkspace: vi.fn(),
  },
  stories: {
    createStoryForTask: vi.fn(),
  },
  sections: {
    addTaskForSection: vi.fn(),
    getSectionsForProject: vi.fn(),
  },
} as unknown as Asana.Client;

// Mock config (note: using 'token' not 'accessToken' as per AsanaConfig type)
const mockConfig: AsanaConfig = {
  token: 'test-token',
  workspaceGid: '123',
  projectGids: ['456'],
  triageSection: 'Triage',
  doneSection: 'Done',
};

// Mock Asana module to provide Client.create()
// The create function needs to return mockAsanaClient each time
vi.mock('asana', () => {
  const mockCreate = vi.fn(() => ({
    useAccessToken: vi.fn(() => mockAsanaClient),
  }));
  return {
    default: {
      Client: {
        create: mockCreate,
      },
    },
  };
});

// Mock cache functions
vi.mock('../../list-tasks/cache.js', () => ({
  getSectionGidByName: vi.fn().mockResolvedValue('section-gid-123'),
  getSectionsWithCache: vi.fn().mockResolvedValue([
    { gid: 'sec1', name: 'Triage' },
    { gid: 'sec2', name: 'In Progress' },
    { gid: 'sec3', name: 'Done' },
  ]),
}));

// Mock getAsanaClient to always return our mock client
vi.mock('../../list-tasks/client.js', () => ({
  getAsanaClient: () => mockAsanaClient,
  resetClient: vi.fn(),
  createClient: vi.fn(),
}));

describe('asana/update-task/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations to default success responses
    (mockAsanaClient.tasks.addTagForTask as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockAsanaClient.tasks.removeTagForTask as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (mockAsanaClient.tags.getTagsForWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  });

  describe('addTagToTask', () => {
    it('should add tag successfully', async () => {
      mockAsanaClient.tasks.addTagForTask = vi.fn().mockResolvedValue({});

      const result = await addTagToTask(mockConfig, 'task-123', 'tag-456');

      expect(result).toEqual({
        success: true,
        tagGid: 'tag-456',
        tagName: '',
        operation: 'add',
      });

      expect(mockAsanaClient.tasks.addTagForTask).toHaveBeenCalledWith('task-123', {
        tag: 'tag-456',
      });
    });

    it('should handle API error', async () => {
      mockAsanaClient.tasks.addTagForTask = vi.fn().mockRejectedValue(new Error('API error'));

      const result = await addTagToTask(mockConfig, 'task-123', 'tag-456');

      expect(result).toEqual({
        success: false,
        tagGid: 'tag-456',
        tagName: '',
        operation: 'add',
        error: 'API error',
      });
    });

    it('should handle duplicate tag gracefully', async () => {
      // Asana API typically returns success even if tag is already present
      mockAsanaClient.tasks.addTagForTask = vi.fn().mockResolvedValue({});

      const result = await addTagToTask(mockConfig, 'task-123', 'tag-456');

      expect(result.success).toBe(true);
    });
  });

  describe('removeTagFromTask', () => {
    it('should remove tag successfully', async () => {
      mockAsanaClient.tasks.removeTagForTask = vi.fn().mockResolvedValue({});

      const result = await removeTagFromTask(mockConfig, 'task-123', 'tag-456');

      expect(result).toEqual({
        success: true,
        tagGid: 'tag-456',
        tagName: '',
        operation: 'remove',
      });

      expect(mockAsanaClient.tasks.removeTagForTask).toHaveBeenCalledWith('task-123', {
        tag: 'tag-456',
      });
    });

    it('should handle API error', async () => {
      (mockAsanaClient.tasks.removeTagForTask as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Tag not found'));

      const result = await removeTagFromTask(mockConfig, 'task-123', 'tag-456');

      expect(result).toEqual({
        success: false,
        tagGid: 'tag-456',
        tagName: '',
        operation: 'remove',
        error: 'Tag not found',
      });
    });
  });

  describe('getWorkspaceTags', () => {
    it('should fetch all workspace tags', async () => {
      const mockTags = {
        data: [
          { gid: 'tag1', name: 'bug', color: 'red' },
          { gid: 'tag2', name: 'feature', color: 'blue' },
          { gid: 'tag3', name: 'urgent', color: null },
        ],
      };

      mockAsanaClient.tags.getTagsForWorkspace = vi.fn().mockResolvedValue(mockTags);

      const result = await getWorkspaceTags(mockConfig);

      expect(result).toEqual([
        { gid: 'tag1', name: 'bug', color: 'red' },
        { gid: 'tag2', name: 'feature', color: 'blue' },
        { gid: 'tag3', name: 'urgent', color: null },
      ]);

      expect(mockAsanaClient.tags.getTagsForWorkspace).toHaveBeenCalledWith(
        '123',
        { opt_fields: 'gid,name,color' }
      );
    });

    it('should handle empty tags list', async () => {
      mockAsanaClient.tags.getTagsForWorkspace = vi.fn().mockResolvedValue({ data: [] });

      const result = await getWorkspaceTags(mockConfig);

      expect(result).toEqual([]);
    });
  });

  describe('findTagByName', () => {
    it('should find tag by exact name', async () => {
      const mockTags = {
        data: [
          { gid: 'tag1', name: 'bug', color: 'red' },
          { gid: 'tag2', name: 'feature', color: 'blue' },
        ],
      };

      mockAsanaClient.tags.getTagsForWorkspace = vi.fn().mockResolvedValue(mockTags);

      const result = await findTagByName(mockConfig, 'bug');

      expect(result).toEqual({ gid: 'tag1', name: 'bug', color: 'red' });
    });

    it('should be case-insensitive', async () => {
      const mockTags = {
        data: [
          { gid: 'tag1', name: 'Bug', color: 'red' },
        ],
      };

      mockAsanaClient.tags.getTagsForWorkspace = vi.fn().mockResolvedValue(mockTags);

      const result = await findTagByName(mockConfig, 'bug');

      expect(result).toEqual({ gid: 'tag1', name: 'Bug', color: 'red' });
    });

    it('should return null when tag not found', async () => {
      const mockTags = {
        data: [
          { gid: 'tag1', name: 'bug', color: 'red' },
        ],
      };

      mockAsanaClient.tags.getTagsForWorkspace = vi.fn().mockResolvedValue(mockTags);

      const result = await findTagByName(mockConfig, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('addTagsToTask', () => {
    it('should add multiple tags', async () => {
      mockAsanaClient.tasks.addTagForTask = vi.fn().mockResolvedValue({});

      const result = await addTagsToTask(mockConfig, 'task-123', ['tag1', 'tag2', 'tag3']);

      expect(result).toHaveLength(3);
      expect(result.every(r => r.success)).toBe(true);
      expect(mockAsanaClient.tasks.addTagForTask).toHaveBeenCalledTimes(3);
    });

    it('should continue on partial failure', async () => {
      mockAsanaClient.tasks.addTagForTask = vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({});

      const result = await addTagsToTask(mockConfig, 'task-123', ['tag1', 'tag2', 'tag3']);

      expect(result).toHaveLength(3);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(false);
      expect(result[2].success).toBe(true);
    });
  });

  describe('replaceTaskTags', () => {
    it('should add new tags and remove old ones', async () => {
      mockAsanaClient.tasks.addTagForTask = vi.fn().mockResolvedValue({});
      mockAsanaClient.tasks.removeTagForTask = vi.fn().mockResolvedValue({});

      const currentTags = ['tag1', 'tag2'];
      const newTags = ['tag2', 'tag3'];

      const result = await replaceTaskTags(mockConfig, 'task-123', currentTags, newTags);

      // Should add tag3 (new)
      expect(result.added).toHaveLength(1);
      expect(result.added[0].tagGid).toBe('tag3');

      // Should remove tag1 (no longer present)
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].tagGid).toBe('tag1');
    });

    it('should handle no changes needed', async () => {
      const currentTags = ['tag1', 'tag2'];
      const newTags = ['tag1', 'tag2'];

      const result = await replaceTaskTags(mockConfig, 'task-123', currentTags, newTags);

      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });
  });
});

describe('asana/update-task/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addComment', () => {
    it('should add plain text comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: 'Test comment',
          html_text: '<body>Test comment</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      const result = await addComment(mockConfig, {
        taskGid: 'task-123',
        text: 'Test comment',
        isMarkdown: false,
      });

      expect(result).toEqual({
        gid: 'story-123',
        text: 'Test comment',
        htmlText: '<body>Test comment</body>',
        createdAt: '2024-01-01T10:00:00.000Z',
        isPinned: false,
      });

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            text: 'Test comment',
          }),
        })
      );
    });

    it('should add Markdown comment converted to HTML', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body><strong>Bold</strong> text</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      const result = await addComment(mockConfig, {
        taskGid: 'task-123',
        text: '**Bold** text',
        isMarkdown: true,
      });

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            html_text: expect.stringContaining('<strong>Bold</strong>'),
          }),
        })
      );
    });

    it('should add pinned comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: 'Pinned comment',
          html_text: '<body>Pinned comment</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: true,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      const result = await addComment(mockConfig, {
        taskGid: 'task-123',
        text: 'Pinned comment',
        isPinned: true,
      });

      expect(result.isPinned).toBe(true);
      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            is_pinned: true,
          }),
        })
      );
    });
  });

  describe('addTextComment', () => {
    it('should add plain text comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: 'Test',
          html_text: '<body>Test</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addTextComment(mockConfig, 'task-123', 'Test');

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalled();
    });
  });

  describe('addMarkdownComment', () => {
    it('should add Markdown comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body><em>Italic</em></body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addMarkdownComment(mockConfig, 'task-123', '_Italic_');

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalled();
    });
  });

  describe('addPinnedComment', () => {
    it('should add pinned comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: 'Pinned',
          html_text: '<body>Pinned</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: true,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      const result = await addPinnedComment(mockConfig, 'task-123', 'Pinned');

      expect(result.isPinned).toBe(true);
    });
  });

  describe('addPRLinkComment', () => {
    it('should format PR link comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body>PR link</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addPRLinkComment(
        mockConfig,
        'task-123',
        'https://github.com/owner/repo/pull/42',
        'Add feature X',
        42
      );

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            html_text: expect.stringContaining('PR #42'),
          }),
        })
      );
    });
  });

  describe('addIssueLinkComment', () => {
    it('should format issue link comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body>Issue link</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addIssueLinkComment(
        mockConfig,
        'task-123',
        'https://github.com/owner/repo/issues/123',
        'Bug report',
        123
      );

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            html_text: expect.stringContaining('Issue #123'),
          }),
        })
      );
    });
  });

  describe('addStatusComment', () => {
    it('should format status comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body>Status</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addStatusComment(mockConfig, 'task-123', 'In Progress', 'Working on it');

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalled();
    });
  });

  describe('addWorkflowComment', () => {
    it('should format success workflow comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body>Workflow</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addWorkflowComment(mockConfig, 'task-123', 'Auto-fix applied', 'success', 'Fixed 3 issues');

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            html_text: expect.stringContaining('[OK]'),
          }),
        })
      );
    });

    it('should format failure workflow comment', async () => {
      const mockResponse = {
        data: {
          gid: 'story-123',
          text: '',
          html_text: '<body>Workflow</body>',
          created_at: '2024-01-01T10:00:00.000Z',
          is_pinned: false,
        },
      };

      mockAsanaClient.stories.createStoryForTask = vi.fn().mockResolvedValue(mockResponse);

      await addWorkflowComment(mockConfig, 'task-123', 'Auto-fix failed', 'failure', 'Error occurred');

      expect(mockAsanaClient.stories.createStoryForTask).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          data: expect.objectContaining({
            html_text: expect.stringContaining('[FAILED]'),
          }),
        })
      );
    });
  });
});

describe('asana/update-task/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock for getSectionsForProject
    mockAsanaClient.sections.getSectionsForProject = vi.fn().mockResolvedValue({
      data: [
        { gid: 'sec1', name: 'Triage' },
        { gid: 'sec2', name: 'In Progress' },
        { gid: 'sec3', name: 'Done' },
      ],
    });
  });

  describe('moveTaskToSection', () => {
    it('should move task to section successfully', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockResolvedValue({});

      const result = await moveTaskToSection(
        mockConfig,
        'task-123',
        'project-456',
        'section-789'
      );

      expect(result).toEqual({
        success: true,
        taskGid: 'task-123',
        fromSection: null,
        toSection: 'section-789',
        projectGid: 'project-456',
      });

      expect(mockAsanaClient.sections.addTaskForSection).toHaveBeenCalledWith(
        'section-789',
        expect.objectContaining({
          data: expect.objectContaining({
            task: 'task-123',
          }),
        })
      );
    });

    it('should handle API error', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockRejectedValue(
        new Error('Section not found')
      );

      const result = await moveTaskToSection(
        mockConfig,
        'task-123',
        'project-456',
        'section-789'
      );

      expect(result).toEqual({
        success: false,
        taskGid: 'task-123',
        fromSection: null,
        toSection: 'section-789',
        projectGid: 'project-456',
        error: 'Section not found',
      });
    });

    it('should support insert_before option', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockResolvedValue({});

      await moveTaskToSection(
        mockConfig,
        'task-123',
        'project-456',
        'section-789',
        'task-before'
      );

      expect(mockAsanaClient.sections.addTaskForSection).toHaveBeenCalledWith(
        'section-789',
        expect.objectContaining({
          data: expect.objectContaining({
            insert_before: 'task-before',
          }),
        })
      );
    });

    it('should support insert_after option', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockResolvedValue({});

      await moveTaskToSection(
        mockConfig,
        'task-123',
        'project-456',
        'section-789',
        undefined,
        'task-after'
      );

      expect(mockAsanaClient.sections.addTaskForSection).toHaveBeenCalledWith(
        'section-789',
        expect.objectContaining({
          data: expect.objectContaining({
            insert_after: 'task-after',
          }),
        })
      );
    });
  });

  describe('moveTaskToSectionByName', () => {
    it('should find section by name and move task', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockResolvedValue({});

      const result = await moveTaskToSectionByName(
        mockConfig,
        'task-123',
        'project-456',
        'In Progress'
      );

      expect(result.success).toBe(true);
    });

    it('should handle section not found', async () => {
      const { getSectionGidByName } = await import('../../list-tasks/cache.js');
      vi.mocked(getSectionGidByName).mockResolvedValueOnce(null);

      const result = await moveTaskToSectionByName(
        mockConfig,
        'task-123',
        'project-456',
        'Nonexistent'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Section "Nonexistent" not found');
    });
  });

  describe('moveToTriage', () => {
    it('should move task to triage section', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockResolvedValue({});

      const result = await moveToTriage(mockConfig, 'task-123', 'project-456');

      expect(result.success).toBe(true);
    });
  });

  describe('moveToDone', () => {
    it('should move task to done section', async () => {
      mockAsanaClient.sections.addTaskForSection = vi.fn().mockResolvedValue({});

      const result = await moveToDone(mockConfig, 'task-123', 'project-456');

      expect(result.success).toBe(true);
    });
  });

  describe('getCurrentSection', () => {
    it('should get current section for task', async () => {
      const mockTask = {
        data: {
          memberships: [
            {
              project: { gid: 'project-456' },
              section: { gid: 'section-789', name: 'In Progress' },
            },
          ],
        },
      };

      mockAsanaClient.tasks.getTask = vi.fn().mockResolvedValue(mockTask);

      const result = await getCurrentSection(mockConfig, 'task-123', 'project-456');

      expect(result).toEqual({
        gid: 'section-789',
        name: 'In Progress',
      });
    });

    it('should return null when task not in project', async () => {
      const mockTask = {
        data: {
          memberships: [
            {
              project: { gid: 'other-project' },
              section: { gid: 'section-789', name: 'In Progress' },
            },
          ],
        },
      };

      mockAsanaClient.tasks.getTask = vi.fn().mockResolvedValue(mockTask);

      const result = await getCurrentSection(mockConfig, 'task-123', 'project-456');

      expect(result).toBeNull();
    });

    it('should return null when task has no section', async () => {
      const mockTask = {
        data: {
          memberships: [
            {
              project: { gid: 'project-456' },
              section: null,
            },
          ],
        },
      };

      mockAsanaClient.tasks.getTask = vi.fn().mockResolvedValue(mockTask);

      const result = await getCurrentSection(mockConfig, 'task-123', 'project-456');

      expect(result).toBeNull();
    });
  });
});
