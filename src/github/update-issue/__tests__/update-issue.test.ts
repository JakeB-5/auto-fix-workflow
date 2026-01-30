/**
 * @module github/update-issue/__tests__/update-issue
 * @description Tests for GitHub issue update operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateIssue, addProgressComment } from '../update-issue.js';
import type { UpdateIssueParams } from '../types.js';

// Create mock functions that will be shared across all instances
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockCreateComment = vi.fn();
const mockAddLabels = vi.fn();
const mockRemoveLabel = vi.fn();
const mockSetLabels = vi.fn();

// Mock Octokit
vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      rest: {
        issues: {
          update: mockUpdate,
          get: mockGet,
          createComment: mockCreateComment,
          addLabels: mockAddLabels,
          removeLabel: mockRemoveLabel,
          setLabels: mockSetLabels,
        },
      },
    })),
  };
});

describe('updateIssue', () => {
  const mockIssueData = {
    number: 42,
    title: 'Test Issue',
    body: 'Test body',
    state: 'open',
    labels: [{ name: 'bug' }, { name: 'priority:high' }],
    assignees: [{ login: 'octocat' }],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    html_url: 'https://github.com/owner/repo/issues/42',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  describe('successful operations', () => {
    it('should add comment successfully', async () => {
      // Arrange
      mockCreateComment.mockResolvedValue({
        data: { id: 1, body: 'Test comment' },
      });
      mockGet.mockResolvedValue({
        data: mockIssueData,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        addComment: 'Test comment',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.number).toBe(42);
        expect(result.data.title).toBe('Test Issue');
      } else {
        throw new Error(`Expected success but got error: ${result.error.message}`);
      }
      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
        body: 'Test comment',
      });
      expect(mockGet).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
      });
    });

    it('should add labels successfully', async () => {
      // Arrange
      mockSetLabels.mockResolvedValue({
        data: [{ name: 'bug' }, { name: 'enhancement' }],
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, labels: [{ name: 'bug' }, { name: 'enhancement' }] },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        labels: ['bug', 'enhancement'],
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.labels).toEqual(['bug', 'enhancement']);
      }
      expect(mockSetLabels).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
        labels: ['bug', 'enhancement'],
      });
    });

    it('should remove labels successfully', async () => {
      // Arrange
      mockSetLabels.mockResolvedValue({
        data: [],
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, labels: [] },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        labels: [], // Empty array removes all labels
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.labels).toEqual([]);
      }
      expect(mockSetLabels).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
        labels: [],
      });
    });

    it('should update title and body successfully', async () => {
      // Arrange
      mockUpdate.mockResolvedValue({
        data: { ...mockIssueData, title: 'Updated Title', body: 'Updated body' },
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, title: 'Updated Title', body: 'Updated body' },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        title: 'Updated Title',
        body: 'Updated body',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Updated Title');
        expect(result.data.body).toBe('Updated body');
      }
      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
        title: 'Updated Title',
        body: 'Updated body',
      });
    });

    it('should close issue successfully', async () => {
      // Arrange
      mockUpdate.mockResolvedValue({
        data: { ...mockIssueData, state: 'closed' },
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, state: 'closed' },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        state: 'closed',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('closed');
      }
      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
        state: 'closed',
      });
    });

    it('should update assignees successfully', async () => {
      // Arrange
      mockUpdate.mockResolvedValue({
        data: { ...mockIssueData, assignees: [{ login: 'user1' }, { login: 'user2' }] },
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, assignees: [{ login: 'user1' }, { login: 'user2' }] },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        assignees: ['user1', 'user2'],
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignees).toEqual(['user1', 'user2']);
      }
      expect(mockUpdate).toHaveBeenCalledWith({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
        assignees: ['user1', 'user2'],
      });
    });

    it('should perform multiple updates in single call', async () => {
      // Arrange
      mockUpdate.mockResolvedValue({
        data: mockIssueData,
      });
      mockSetLabels.mockResolvedValue({
        data: [{ name: 'in-progress' }],
      });
      (mockCreateComment as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: 1, body: 'Starting work' },
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, title: 'Updated', labels: [{ name: 'in-progress' }] },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        title: 'Updated',
        labels: ['in-progress'],
        addComment: 'Starting work',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockSetLabels).toHaveBeenCalledTimes(1);
      expect(mockCreateComment).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent issue error', async () => {
      // Arrange
      const notFoundError = Object.assign(new Error('Not Found'), {
        status: 404,
        code: 'not_found',
      });
      mockGet.mockRejectedValue(notFoundError);

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 999,
        addComment: 'Test',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
        expect(result.error.message).toContain('Not Found');
      }
    });

    it('should handle permission error', async () => {
      // Arrange
      const forbiddenError = Object.assign(new Error('Forbidden'), {
        status: 403,
        code: 'forbidden',
      });
      mockCreateComment.mockRejectedValue(
        forbiddenError
      );

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        addComment: 'Test',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(403);
        expect(result.error.message).toContain('Forbidden');
      }
    });

    it('should handle authentication error', async () => {
      // Arrange
      const authError = Object.assign(new Error('Bad credentials'), {
        status: 401,
        code: 'unauthorized',
      });
      mockGet.mockRejectedValue(authError);

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(401);
        expect(result.error.message).toContain('Bad credentials');
      }
    });

    it('should handle validation error', async () => {
      // Arrange
      const validationError = Object.assign(new Error('Validation Failed'), {
        status: 422,
        code: 'validation_failed',
      });
      mockUpdate.mockRejectedValue(
        validationError
      );

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        state: 'invalid' as 'open', // Invalid state
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(422);
        expect(result.error.message).toContain('Validation Failed');
      }
    });

    it('should handle network error', async () => {
      // Arrange
      const networkError = new Error('Network request failed');
      mockGet.mockRejectedValue(networkError);

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Network request failed');
      }
    });

    it('should handle label sync error', async () => {
      // Arrange
      const labelError = Object.assign(new Error('Label does not exist'), {
        status: 404,
      });
      mockSetLabels.mockRejectedValue(
        labelError
      );

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        labels: ['non-existent-label'],
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });
  });

  describe('validation and edge cases', () => {
    it('should skip comment if empty string', async () => {
      // Arrange
      mockGet.mockResolvedValue({
        data: mockIssueData,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        addComment: '',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCreateComment).not.toHaveBeenCalled();
    });

    it('should skip comment if only whitespace', async () => {
      // Arrange
      mockGet.mockResolvedValue({
        data: mockIssueData,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        addComment: '   \n\t  ',
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCreateComment).not.toHaveBeenCalled();
    });

    it('should handle issue with no labels', async () => {
      // Arrange
      const issueWithNoLabels = { ...mockIssueData, labels: [] };
      mockGet.mockResolvedValue({
        data: issueWithNoLabels,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.labels).toEqual([]);
      }
    });

    it('should handle issue with no assignees', async () => {
      // Arrange
      const issueWithNoAssignees = { ...mockIssueData, assignees: null };
      mockGet.mockResolvedValue({
        data: issueWithNoAssignees,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignees).toEqual([]);
      }
    });

    it('should handle issue with null body', async () => {
      // Arrange
      const issueWithNullBody = { ...mockIssueData, body: null };
      mockGet.mockResolvedValue({
        data: issueWithNullBody,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body).toBe('');
      }
    });

    it('should not call update if no fields provided', async () => {
      // Arrange
      mockGet.mockResolvedValue({
        data: mockIssueData,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
      };

      // Act
      const result = await updateIssue(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotency', () => {
    it('should be idempotent when setting same labels twice', async () => {
      // Arrange
      mockSetLabels.mockResolvedValue({
        data: [{ name: 'bug' }],
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, labels: [{ name: 'bug' }] },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        labels: ['bug'],
      };

      // Act
      const result1 = await updateIssue(params);
      const result2 = await updateIssue(params);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.labels).toEqual(result2.data.labels);
      }
    });

    it('should be idempotent when setting same state twice', async () => {
      // Arrange
      mockUpdate.mockResolvedValue({
        data: { ...mockIssueData, state: 'closed' },
      });
      mockGet.mockResolvedValue({
        data: { ...mockIssueData, state: 'closed' },
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        state: 'closed',
      };

      // Act
      const result1 = await updateIssue(params);
      const result2 = await updateIssue(params);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.state).toBe('closed');
        expect(result2.data.state).toBe('closed');
      }
    });

    it('should not be idempotent when adding comments', async () => {
      // Arrange
      let commentCount = 0;
      mockCreateComment.mockImplementation(
        async () => {
          commentCount++;
          return { data: { id: commentCount, body: 'Comment' } };
        }
      );
      mockGet.mockResolvedValue({
        data: mockIssueData,
      });

      const params: UpdateIssueParams = {
        owner: 'octocat',
        repo: 'hello-world',
        issueNumber: 42,
        addComment: 'Same comment',
      };

      // Act
      await updateIssue(params);
      await updateIssue(params);

      // Assert
      expect(mockCreateComment).toHaveBeenCalledTimes(2);
      expect(commentCount).toBe(2);
    });
  });
});

describe('addProgressComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it('should add progress comment successfully', async () => {
    // Arrange
    mockCreateComment.mockResolvedValue({
      data: { id: 1, body: 'Progress: In progress' },
    });

    // Act
    const result = await addProgressComment('octocat', 'hello-world', 42, 'In progress');

    // Assert
    expect(result.success).toBe(true);
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 42,
      })
    );
  });

  it('should add progress comment with details', async () => {
    // Arrange
    mockCreateComment.mockResolvedValue({
      data: { id: 1, body: 'Progress comment' },
    });

    const details = {
      step: '2/5',
      completedTests: 10,
      failedTests: 2,
    };

    // Act
    const result = await addProgressComment(
      'octocat',
      'hello-world',
      42,
      'Running tests',
      details
    );

    // Assert
    expect(result.success).toBe(true);
    expect(mockCreateComment).toHaveBeenCalledTimes(1);
  });

  it('should handle error when adding progress comment', async () => {
    // Arrange
    const error = Object.assign(new Error('API Error'), {
      status: 500,
    });
    mockCreateComment.mockRejectedValue(error);

    // Act
    const result = await addProgressComment('octocat', 'hello-world', 42, 'Failed');

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('API Error');
      expect(result.error.status).toBe(500);
    }
  });
});
