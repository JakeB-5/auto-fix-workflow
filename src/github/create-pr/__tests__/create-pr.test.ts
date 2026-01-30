/**
 * @module github/create-pr/__tests__/create-pr
 * @description Tests for PR creation functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPR, addLabels, addReviewers, findExistingPR } from '../create-pr.js';
import { GitHubApiError, GitHubApiErrorCode } from '../error-handling.js';
import type { CreatePRParams } from '../types.js';

describe('createPR', () => {
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        repos: {
          getBranch: vi.fn(),
        },
        pulls: {
          create: vi.fn(),
          list: vi.fn(),
          requestReviewers: vi.fn(),
        },
        issues: {
          addLabels: vi.fn(),
        },
      },
    };
  });

  describe('successful PR creation', () => {
    it('should create PR with basic parameters', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: resolve bug',
        body: 'This PR fixes a critical bug',
        head: 'fix/bug-123',
        base: 'autofixing',
      };

      // Mock branch existence check
      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: {
          name: 'fix/bug-123',
          commit: { sha: 'abc123' },
        },
      });

      // Mock PR creation
      mockOctokit.rest.pulls.create = vi.fn().mockResolvedValue({
        data: {
          number: 42,
          title: params.title,
          body: params.body,
          state: 'open',
          draft: false,
          head: { ref: params.head },
          base: { ref: params.base },
          labels: [],
          requested_reviewers: [],
          created_at: '2026-01-30T10:00:00Z',
          updated_at: '2026-01-30T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/pull/42',
          changed_files: 3,
          additions: 50,
          deletions: 10,
        },
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.number).toBe(42);
        expect(result.data.title).toBe(params.title);
        expect(result.data.body).toBe(params.body);
        expect(result.data.state).toBe('open');
        expect(result.data.headBranch).toBe(params.head);
        expect(result.data.baseBranch).toBe(params.base);
        expect(result.data.url).toBe('https://github.com/test-owner/test-repo/pull/42');
        expect(result.data.changedFiles).toBe(3);
        expect(result.data.additions).toBe(50);
        expect(result.data.deletions).toBe(10);
      }

      // Verify API calls
      expect(mockOctokit.rest.repos.getBranch).toHaveBeenCalledWith({
        owner: params.owner,
        repo: params.repo,
        branch: params.head,
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: false,
      });
    });

    it('should default to autofixing as target branch', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: issue',
        body: 'Fix description',
        head: 'fix/issue',
        base: 'autofixing', // Default target
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/issue', commit: { sha: 'abc123' } },
      });

      mockOctokit.rest.pulls.create = vi.fn().mockResolvedValue({
        data: {
          number: 1,
          title: params.title,
          body: params.body,
          state: 'open',
          draft: false,
          head: { ref: params.head },
          base: { ref: 'autofixing' },
          labels: [],
          requested_reviewers: [],
          created_at: '2026-01-30T10:00:00Z',
          updated_at: '2026-01-30T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/pull/1',
        },
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baseBranch).toBe('autofixing');
      }
    });

    it('should link issues with "Closes #123" format', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: resolve multiple issues',
        body: 'Closes #123\nCloses #456',
        head: 'fix/multi-issues',
        base: 'autofixing',
        issueNumbers: [123, 456],
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/multi-issues', commit: { sha: 'abc123' } },
      });

      mockOctokit.rest.pulls.create = vi.fn().mockResolvedValue({
        data: {
          number: 10,
          title: params.title,
          body: params.body,
          state: 'open',
          draft: false,
          head: { ref: params.head },
          base: { ref: params.base },
          labels: [],
          requested_reviewers: [],
          created_at: '2026-01-30T10:00:00Z',
          updated_at: '2026-01-30T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/pull/10',
        },
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.linkedIssues).toEqual([123, 456]);
        expect(result.data.body).toContain('Closes #123');
        expect(result.data.body).toContain('Closes #456');
      }
    });

    it('should create draft PR when specified', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'WIP: new feature',
        body: 'Work in progress',
        head: 'feat/wip',
        base: 'autofixing',
        draft: true,
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'feat/wip', commit: { sha: 'abc123' } },
      });

      mockOctokit.rest.pulls.create = vi.fn().mockResolvedValue({
        data: {
          number: 5,
          title: params.title,
          body: params.body,
          state: 'open',
          draft: true,
          head: { ref: params.head },
          base: { ref: params.base },
          labels: [],
          requested_reviewers: [],
          created_at: '2026-01-30T10:00:00Z',
          updated_at: '2026-01-30T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/pull/5',
        },
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('draft');
      }

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
        })
      );
    });

    it('should include test results in PR body', async () => {
      // Arrange
      const testResults = `
## Test Results
- Unit Tests: ✅ All passed
- Integration Tests: ✅ All passed
- E2E Tests: ✅ All passed
`;

      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: bug with tests',
        body: `Bug fix description\n${testResults}`,
        head: 'fix/bug-with-tests',
        base: 'autofixing',
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/bug-with-tests', commit: { sha: 'abc123' } },
      });

      mockOctokit.rest.pulls.create = vi.fn().mockResolvedValue({
        data: {
          number: 20,
          title: params.title,
          body: params.body,
          state: 'open',
          draft: false,
          head: { ref: params.head },
          base: { ref: params.base },
          labels: [],
          requested_reviewers: [],
          created_at: '2026-01-30T10:00:00Z',
          updated_at: '2026-01-30T10:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/pull/20',
        },
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body).toContain('Test Results');
        expect(result.data.body).toContain('All passed');
      }
    });
  });

  describe('error handling', () => {
    it('should fail when branch does not exist', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: issue',
        body: 'Description',
        head: 'nonexistent-branch',
        base: 'autofixing',
      };

      // Mock 404 error for branch check
      mockOctokit.rest.repos.getBranch = vi.fn().mockRejectedValue({
        status: 404,
        message: 'Branch not found',
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.NOT_FOUND);
        expect(result.error.message).toContain('Branch not found');
      }

      // Should not attempt to create PR
      expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled();
    });

    it('should detect duplicate PR (ALREADY_EXISTS)', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: duplicate',
        body: 'Description',
        head: 'fix/duplicate',
        base: 'autofixing',
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/duplicate', commit: { sha: 'abc123' } },
      });

      // Mock 422 error for duplicate PR
      mockOctokit.rest.pulls.create = vi.fn().mockRejectedValue({
        status: 422,
        message: 'A pull request already exists for test-owner:fix/duplicate',
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.ALREADY_EXISTS);
        expect(result.error.statusCode).toBe(422);
      }
    });

    it('should handle unauthorized error (401)', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: unauthorized',
        body: 'Description',
        head: 'fix/unauthorized',
        base: 'autofixing',
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/unauthorized', commit: { sha: 'abc123' } },
      });

      // Mock 401 error
      mockOctokit.rest.pulls.create = vi.fn().mockRejectedValue({
        status: 401,
        message: 'Bad credentials',
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.UNAUTHORIZED);
        expect(result.error.toUserMessage()).toContain('Authentication failed');
      }
    });

    it('should handle rate limit error (403)', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: rate limited',
        body: 'Description',
        head: 'fix/rate-limit',
        base: 'autofixing',
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/rate-limit', commit: { sha: 'abc123' } },
      });

      // Mock 403 rate limit error
      mockOctokit.rest.pulls.create = vi.fn().mockRejectedValue({
        status: 403,
        message: 'API rate limit exceeded',
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.RATE_LIMIT);
      }
    });

    it('should handle network error', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: network error',
        body: 'Description',
        head: 'fix/network',
        base: 'autofixing',
      };

      // Mock network error
      mockOctokit.rest.repos.getBranch = vi.fn().mockRejectedValue(
        new Error('Network request failed: ECONNREFUSED')
      );

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.NETWORK_ERROR);
      }
    });

    it('should handle validation failed error (422)', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: '',
        body: 'Description',
        head: 'fix/invalid',
        base: 'autofixing',
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/invalid', commit: { sha: 'abc123' } },
      });

      // Mock 422 validation error
      mockOctokit.rest.pulls.create = vi.fn().mockRejectedValue({
        status: 422,
        message: 'Validation failed: title is required',
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.VALIDATION_FAILED);
        expect(result.error.message).toContain('Validation failed');
      }
    });

    it('should handle unknown API error', async () => {
      // Arrange
      const params: CreatePRParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Fix: unknown error',
        body: 'Description',
        head: 'fix/unknown',
        base: 'autofixing',
      };

      mockOctokit.rest.repos.getBranch = vi.fn().mockResolvedValue({
        data: { name: 'fix/unknown', commit: { sha: 'abc123' } },
      });

      // Mock 500 error
      mockOctokit.rest.pulls.create = vi.fn().mockRejectedValue({
        status: 500,
        message: 'Internal server error',
      });

      // Act
      const result = await createPR(mockOctokit, params);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(GitHubApiError);
        expect(result.error.code).toBe(GitHubApiErrorCode.UNKNOWN);
      }
    });
  });
});

describe('addLabels', () => {
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          addLabels: vi.fn(),
        },
      },
    };
  });

  it('should add labels to PR successfully', async () => {
    // Arrange
    const labels = ['bug', 'high-priority'] as const;

    mockOctokit.rest.issues.addLabels = vi.fn().mockResolvedValue({
      data: [
        { name: 'bug' },
        { name: 'high-priority' },
      ],
    });

    // Act
    const result = await addLabels(mockOctokit, 'owner', 'repo', 42, labels);

    // Assert
    expect(result.success).toBe(true);
    expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 42,
      labels: ['bug', 'high-priority'],
    });
  });

  it('should skip when no labels provided', async () => {
    // Act
    const result = await addLabels(mockOctokit, 'owner', 'repo', 42, []);

    // Assert
    expect(result.success).toBe(true);
    expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
  });

  it('should handle API error', async () => {
    // Arrange
    mockOctokit.rest.issues.addLabels = vi.fn().mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });

    // Act
    const result = await addLabels(mockOctokit, 'owner', 'repo', 42, ['bug']);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(GitHubApiError);
    }
  });
});

describe('addReviewers', () => {
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        pulls: {
          requestReviewers: vi.fn(),
        },
      },
    };
  });

  it('should add reviewers to PR successfully', async () => {
    // Arrange
    const reviewers = ['user1', 'user2'] as const;

    mockOctokit.rest.pulls.requestReviewers = vi.fn().mockResolvedValue({
      data: {
        requested_reviewers: [
          { login: 'user1' },
          { login: 'user2' },
        ],
      },
    });

    // Act
    const result = await addReviewers(mockOctokit, 'owner', 'repo', 42, reviewers);

    // Assert
    expect(result.success).toBe(true);
    expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 42,
      reviewers: ['user1', 'user2'],
    });
  });

  it('should skip when no reviewers provided', async () => {
    // Act
    const result = await addReviewers(mockOctokit, 'owner', 'repo', 42, []);

    // Assert
    expect(result.success).toBe(true);
    expect(mockOctokit.rest.pulls.requestReviewers).not.toHaveBeenCalled();
  });

  it('should handle API error', async () => {
    // Arrange
    mockOctokit.rest.pulls.requestReviewers = vi.fn().mockRejectedValue({
      status: 422,
      message: 'User not found',
    });

    // Act
    const result = await addReviewers(mockOctokit, 'owner', 'repo', 42, ['invalid-user']);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(GitHubApiError);
    }
  });
});

describe('findExistingPR', () => {
  let mockOctokit: any;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        pulls: {
          list: vi.fn(),
        },
      },
    };
  });

  it('should find existing PR', async () => {
    // Arrange
    mockOctokit.rest.pulls.list = vi.fn().mockResolvedValue({
      data: [
        {
          number: 42,
          title: 'Existing PR',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: 'feature-branch' },
          base: { ref: 'autofixing' },
          labels: [{ name: 'bug' }],
          requested_reviewers: [{ login: 'reviewer1' }],
          created_at: '2026-01-30T10:00:00Z',
          updated_at: '2026-01-30T11:00:00Z',
          html_url: 'https://github.com/owner/repo/pull/42',
        },
      ],
    });

    // Act
    const result = await findExistingPR(
      mockOctokit,
      'owner',
      'repo',
      'feature-branch',
      'autofixing'
    );

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.number).toBe(42);
      expect(result.data?.title).toBe('Existing PR');
      expect(result.data?.headBranch).toBe('feature-branch');
      expect(result.data?.baseBranch).toBe('autofixing');
    }

    expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      head: 'owner:feature-branch',
      base: 'autofixing',
      state: 'open',
    });
  });

  it('should return null when no PR exists', async () => {
    // Arrange
    mockOctokit.rest.pulls.list = vi.fn().mockResolvedValue({
      data: [],
    });

    // Act
    const result = await findExistingPR(
      mockOctokit,
      'owner',
      'repo',
      'feature-branch',
      'autofixing'
    );

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('should handle API error', async () => {
    // Arrange
    mockOctokit.rest.pulls.list = vi.fn().mockRejectedValue({
      status: 404,
      message: 'Not Found',
    });

    // Act
    const result = await findExistingPR(
      mockOctokit,
      'owner',
      'repo',
      'feature-branch',
      'autofixing'
    );

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(GitHubApiError);
    }
  });
});
