/**
 * @module github/get-issue/__tests__/get-issue
 * @description Unit tests for GitHub issue retrieval
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Octokit } from '@octokit/rest';
import { getIssue } from '../get-issue.js';
import type { GetIssueParams } from '../types.js';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return {
      rest: {
        issues: {
          get: vi.fn(),
          listComments: vi.fn(),
        },
      },
    };
  }),
}));

describe('getIssue', () => {
  let octokit: Octokit;
  let mockIssuesGet: Mock;
  let mockIssuesListComments: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    octokit = new Octokit({ auth: 'test-token' });
    mockIssuesGet = octokit.rest.issues.get as unknown as Mock;
    mockIssuesListComments = octokit.rest.issues
      .listComments as unknown as Mock;
  });

  describe('successful issue retrieval', () => {
    it('should retrieve a valid issue with all fields', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'This is a test issue\n\n- [x] Task 1\n- [ ] Task 2',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'priority:high' }],
        assignees: [{ login: 'user1' }, { login: 'user2' }],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.number).toBe(123);
        expect(result.data.issue.title).toBe('Test Issue');
        expect(result.data.issue.state).toBe('open');
        expect(result.data.issue.type).toBe('bug');
        expect(result.data.issue.labels).toContain('bug');
        expect(result.data.issue.assignees).toEqual(['user1', 'user2']);
        expect(result.data.issue.context.priority).toBe('high');
        expect(result.data.issue.acceptanceCriteria).toHaveLength(2);
        expect(result.data.issue.acceptanceCriteria[0].description).toBe(
          'Task 1'
        );
        expect(result.data.issue.acceptanceCriteria[0].completed).toBe(true);
        expect(result.data.issue.acceptanceCriteria[1].completed).toBe(false);
        expect(result.data.comments).toEqual([]);
        expect(result.data.relatedIssues).toEqual([]);
      }
    });

    it('should handle issue with related issues in body', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'This fixes #456 and relates to #789\nSee also #101',
        state: 'open',
        labels: [{ name: 'feature' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedIssues).toEqual([101, 456, 789]);
      }
    });

    it('should extract component from labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'component:auth' }, { name: 'bug' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.context.component).toBe('auth');
      }
    });

    it('should handle area: prefix for component', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'area:database' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.context.component).toBe('database');
      }
    });
  });

  describe('comments handling', () => {
    it('should include comments with all fields', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      const mockComments = [
        {
          id: 1,
          user: { login: 'commenter1' },
          body: 'First comment',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#comment-1',
        },
        {
          id: 2,
          user: { login: 'commenter2' },
          body: 'Second comment with #456 reference',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:30:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#comment-2',
        },
      ];

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: mockComments });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comments).toHaveLength(2);
        expect(result.data.comments[0].id).toBe(1);
        expect(result.data.comments[0].author).toBe('commenter1');
        expect(result.data.comments[0].body).toBe('First comment');
        expect(result.data.comments[1].author).toBe('commenter2');
        expect(result.data.relatedIssues).toContain(456);
      }
    });

    it('should handle comments with null user', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      const mockComments = [
        {
          id: 1,
          user: null,
          body: 'Comment from deleted user',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#comment-1',
        },
      ];

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: mockComments });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comments[0].author).toBe('unknown');
      }
    });

    it('should handle comments with null body', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      const mockComments = [
        {
          id: 1,
          user: { login: 'user1' },
          body: null,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#comment-1',
        },
      ];

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: mockComments });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comments[0].body).toBe('');
      }
    });
  });

  describe('related issues extraction', () => {
    it('should extract related issues from body and comments', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'This closes #100 and fixes #200',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      const mockComments = [
        {
          id: 1,
          user: { login: 'user1' },
          body: 'Related to #300 and #400',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#comment-1',
        },
        {
          id: 2,
          user: { login: 'user2' },
          body: 'See also #100 (duplicate)',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123#comment-2',
        },
      ];

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: mockComments });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should deduplicate and sort
        expect(result.data.relatedIssues).toEqual([100, 200, 300, 400]);
      }
    });

    it('should handle closing keywords', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Resolves #100, fixes #200, closes #300',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedIssues).toEqual([100, 200, 300]);
      }
    });
  });

  describe('issue type determination', () => {
    it('should detect bug type from labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'bug' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.type).toBe('bug');
      }
    });

    it('should detect feature type from labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'enhancement' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.type).toBe('feature');
      }
    });

    it('should detect refactor type from labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'refactor' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.type).toBe('refactor');
      }
    });

    it('should default to chore type when no matching labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'dependencies' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.type).toBe('chore');
      }
    });
  });

  describe('priority determination', () => {
    it('should detect critical priority', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'priority:critical' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.context.priority).toBe('critical');
      }
    });

    it('should detect high priority', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'high priority' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.context.priority).toBe('high');
      }
    });

    it('should default to medium priority', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.context.priority).toBe('medium');
      }
    });
  });

  describe('state mapping', () => {
    it('should map closed state', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'closed',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.state).toBe('closed');
      }
    });

    it('should detect in_progress from labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'in-progress' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.state).toBe('in_progress');
      }
    });

    it('should default to open state', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.state).toBe('open');
      }
    });
  });

  describe('error handling', () => {
    it('should handle 404 error for non-existent issue', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 999,
      };

      const error = new Error('Not Found');
      (error as any).status = 404;

      mockIssuesGet.mockRejectedValue(error);

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.status).toBe(404);
        expect(result.error.message).toBe('Not Found');
      }
    });

    it('should handle rate limit error', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const error = new Error('Rate limit exceeded');
      (error as any).status = 403;

      mockIssuesGet.mockRejectedValue(error);

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.status).toBe(403);
        expect(result.error.message).toContain('Rate limit exceeded');
      }
    });

    it('should handle network error', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const error = new Error('Network error');
      (error as any).code = 'ECONNREFUSED';

      mockIssuesGet.mockRejectedValue(error);

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.code).toBe('ECONNREFUSED');
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should handle unknown error', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      mockIssuesGet.mockRejectedValue('Unknown error');

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain('Unknown error');
      }
    });

    it('should handle error in listComments', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockRejectedValue(new Error('Failed to fetch comments'));

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain('Failed to fetch comments');
      }
    });
  });

  describe('markdown parsing', () => {
    it('should extract task list from issue body', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: `
## Tasks

- [x] Complete first task
- [ ] Do second task
- [x] Finish third task
        `,
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.acceptanceCriteria).toHaveLength(3);
        expect(result.data.issue.acceptanceCriteria[0].description).toBe(
          'Complete first task'
        );
        expect(result.data.issue.acceptanceCriteria[0].completed).toBe(true);
        expect(result.data.issue.acceptanceCriteria[1].completed).toBe(false);
        expect(result.data.issue.acceptanceCriteria[2].completed).toBe(true);
      }
    });

    it('should handle empty task list', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'This issue has no task list',
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.acceptanceCriteria).toHaveLength(0);
      }
    });

    it('should handle null issue body', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: null,
        state: 'open',
        labels: [],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.body).toBe('');
        expect(result.data.issue.acceptanceCriteria).toHaveLength(0);
        expect(result.data.relatedIssues).toHaveLength(0);
      }
    });
  });

  describe('label handling', () => {
    it('should handle string labels', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: ['bug', 'priority:high'],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.labels).toEqual(['bug', 'priority:high']);
        expect(result.data.issue.type).toBe('bug');
        expect(result.data.issue.context.priority).toBe('high');
      }
    });

    it('should handle label objects without name', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'bug' }, {}, { name: 'feature' }],
        assignees: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.labels).toEqual(['bug', '', 'feature']);
      }
    });

    it('should handle null assignees', async () => {
      const params: GetIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      };

      const mockIssueData = {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [],
        assignees: [{ login: 'user1' }, null, { login: 'user2' }],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        html_url: 'https://github.com/test-owner/test-repo/issues/123',
      };

      mockIssuesGet.mockResolvedValue({ data: mockIssueData });
      mockIssuesListComments.mockResolvedValue({ data: [] });

      const result = await getIssue(octokit, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issue.assignees).toEqual(['user1', 'user2']);
      }
    });
  });
});
