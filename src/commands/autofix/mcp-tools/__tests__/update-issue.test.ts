/**
 * @module commands/autofix/mcp-tools/__tests__/update-issue
 * @description Tests for UpdateIssueTool MCP tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  UpdateIssueTool,
  createUpdateIssueTool,
  UpdateIssueInputSchema,
} from '../update-issue.js';
import type { UpdateIssueConfig, UpdateIssueInput } from '../update-issue.js';

// Store original fetch
const originalFetch = globalThis.fetch;

describe('UpdateIssueInputSchema', () => {
  it('should accept valid input with all fields', () => {
    const input = {
      issueNumber: 42,
      state: 'closed',
      labels: ['bug'],
      addLabels: ['in-progress'],
      removeLabels: ['auto-fix'],
      comment: 'Done',
      assignees: ['user1'],
    };
    const result = UpdateIssueInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input with only issueNumber', () => {
    const result = UpdateIssueInputSchema.safeParse({ issueNumber: 1 });
    expect(result.success).toBe(true);
  });

  it('should reject missing issueNumber', () => {
    const result = UpdateIssueInputSchema.safeParse({ state: 'open' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid state', () => {
    const result = UpdateIssueInputSchema.safeParse({
      issueNumber: 1,
      state: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateIssueTool', () => {
  const config: UpdateIssueConfig = {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    apiBaseUrl: 'https://api.test.com',
  };

  let tool: UpdateIssueTool;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tool = new UpdateIssueTool(config);
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('static properties', () => {
    it('should have correct tool name', () => {
      expect(UpdateIssueTool.toolName).toBe('update_issue');
    });

    it('should have correct tool description', () => {
      expect(UpdateIssueTool.toolDescription).toBe(
        'Update GitHub issue state, labels, and add comments'
      );
    });
  });

  describe('updateIssue', () => {
    it('should update issue state successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await tool.updateIssue({
        issueNumber: 42,
        state: 'closed',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issueNumber).toBe(42);
        expect(result.data.updated).toBe(true);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/repos/test-owner/test-repo/issues/42',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should update labels successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await tool.updateIssue({
        issueNumber: 42,
        labels: ['bug', 'fix'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
      }
    });

    it('should update assignees successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await tool.updateIssue({
        issueNumber: 42,
        assignees: ['user1'],
      });

      expect(result.success).toBe(true);
    });

    it('should add labels successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await tool.updateIssue({
        issueNumber: 42,
        addLabels: ['in-progress'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/repos/test-owner/test-repo/issues/42/labels',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should remove labels successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await tool.updateIssue({
        issueNumber: 42,
        removeLabels: ['auto-fix'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/repos/test-owner/test-repo/issues/42/labels/auto-fix',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should remove multiple labels', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });

      const result = await tool.updateIssue({
        issueNumber: 42,
        removeLabels: ['label1', 'label2'],
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle 404 on remove label (label does not exist)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

      const result = await tool.updateIssue({
        issueNumber: 42,
        removeLabels: ['nonexistent'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
      }
    });

    it('should fail on non-404 error during remove label', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' });

      const result = await tool.updateIssue({
        issueNumber: 42,
        removeLabels: ['label1'],
      });

      expect(result.success).toBe(false);
    });

    it('should add comment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123 }),
      });

      const result = await tool.updateIssue({
        issueNumber: 42,
        comment: 'Test comment',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
        expect(result.data.commentId).toBe(123);
      }
    });

    it('should handle all operations together', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // patch state/labels
        .mockResolvedValueOnce({ ok: true }) // add labels
        .mockResolvedValueOnce({ ok: true }) // remove label
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99 }) }); // add comment

      const result = await tool.updateIssue({
        issueNumber: 42,
        state: 'closed',
        addLabels: ['fixed'],
        removeLabels: ['in-progress'],
        comment: 'Done!',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
        expect(result.data.commentId).toBe(99);
      }
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should return updated=false when no operations performed', async () => {
      const result = await tool.updateIssue({
        issueNumber: 42,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(false);
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip empty addLabels array', async () => {
      const result = await tool.updateIssue({
        issueNumber: 42,
        addLabels: [],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(false);
      }
    });

    it('should skip empty removeLabels array', async () => {
      const result = await tool.updateIssue({
        issueNumber: 42,
        removeLabels: [],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(false);
      }
    });

    it('should use default api base URL when not configured', async () => {
      const toolDefault = new UpdateIssueTool({
        token: 'tok',
        owner: 'o',
        repo: 'r',
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await toolDefault.updateIssue({
        issueNumber: 1,
        state: 'closed',
      });

      expect(mockFetch.mock.calls[0][0]).toContain('https://api.github.com/');
    });

    it('should encode label name in remove URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await tool.updateIssue({
        issueNumber: 42,
        removeLabels: ['priority:high'],
      });

      expect(mockFetch.mock.calls[0][0]).toContain('priority%3Ahigh');
    });

    // Error mapping
    it('should map 401 error to AUTH_FAILED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await tool.updateIssue({
        issueNumber: 42,
        state: 'closed',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_FAILED');
      }
    });

    it('should map 404 error to NOT_FOUND', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await tool.updateIssue({
        issueNumber: 999,
        state: 'closed',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should map 422 error to VALIDATION_FAILED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
      });

      const result = await tool.updateIssue({
        issueNumber: 42,
        state: 'closed',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('should map other API errors to API_ERROR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await tool.updateIssue({
        issueNumber: 42,
        state: 'closed',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });

    it('should map non-Error to UNKNOWN', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await tool.updateIssue({
        issueNumber: 42,
        state: 'closed',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toBe('string error');
      }
    });

    it('should map addComment failure to error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await tool.updateIssue({
        issueNumber: 42,
        comment: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('addPRLinkComment', () => {
    it('should add PR link comment with correct format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 200 }),
      });

      const result = await tool.addPRLinkComment(
        42,
        10,
        'https://github.com/owner/repo/pull/10'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.issueNumber).toBe(42);
        expect(result.data.commentId).toBe(200);
      }

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toContain('Auto-Fix PR Created');
      expect(callBody.body).toContain('#10');
      expect(callBody.body).toContain('https://github.com/owner/repo/pull/10');
    });
  });

  describe('markInProgress', () => {
    it('should add in-progress label and remove auto-fix label', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // add labels
        .mockResolvedValueOnce({ ok: true }) // remove label
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) }); // comment

      const result = await tool.markInProgress(42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
      }
    });
  });

  describe('markFixed', () => {
    it('should add auto-fixed label and remove in-progress/auto-fix', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // add labels
        .mockResolvedValueOnce({ ok: true }) // remove in-progress
        .mockResolvedValueOnce({ ok: true }) // remove auto-fix
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) }); // comment

      const result = await tool.markFixed(
        42,
        10,
        'https://github.com/owner/repo/pull/10'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updated).toBe(true);
      }
    });
  });

  describe('markFailed', () => {
    it('should add auto-fix-failed label and remove in-progress', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true }) // add labels
        .mockResolvedValueOnce({ ok: true }) // remove label
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) }); // comment

      const result = await tool.markFailed(42, 'Type error in src/main.ts');

      expect(result.success).toBe(true);

      // Check the comment contains the reason
      const lastCallBody = JSON.parse(
        mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1].body
      );
      expect(lastCallBody.body).toContain('Auto-Fix Failed');
      expect(lastCallBody.body).toContain('Type error in src/main.ts');
    });
  });
});

describe('createUpdateIssueTool', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should return tool definition with correct properties', () => {
    const toolDef = createUpdateIssueTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    expect(toolDef.name).toBe('update_issue');
    expect(toolDef.description).toBe('Update GitHub issue state, labels, and add comments');
    expect(toolDef.inputSchema.required).toEqual(['issueNumber']);
  });

  it('should have handler that updates issue', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const toolDef = createUpdateIssueTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    const result = await toolDef.handler({
      issueNumber: 1,
      state: 'closed',
    });

    expect(result.success).toBe(true);
  });
});
