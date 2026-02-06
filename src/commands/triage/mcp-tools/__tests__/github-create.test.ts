/**
 * @module commands/triage/mcp-tools/__tests__/github-create.test
 * @description Tests for GitHubCreateTool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubCreateTool } from '../github-create.js';
import type { AsanaTask, TaskAnalysis } from '../../types.js';

// Mock MCP client
function createMockClient() {
  return {
    callTool: vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            number: 42,
            html_url: 'https://github.com/test/repo/issues/42',
            id: 12345,
          }),
        },
      ],
    }),
  } as any;
}

function createMockTask(overrides: Partial<AsanaTask> = {}): AsanaTask {
  return {
    gid: '123456789',
    name: 'Test Task',
    notes: 'Test task description with some detail',
    permalinkUrl: 'https://app.asana.com/0/123/456',
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    completed: false,
    ...overrides,
  };
}

function createMockAnalysis(overrides: Partial<TaskAnalysis> = {}): TaskAnalysis {
  return {
    issueType: 'bug',
    priority: 'medium',
    labels: ['auto-fix'],
    component: 'auth',
    relatedFiles: ['src/auth/login.ts'],
    summary: 'Login fails when password contains special characters',
    acceptanceCriteria: ['Login works with special chars', 'Error message is clear'],
    confidence: 0.8,
    ...overrides,
  };
}

describe('GitHubCreateTool', () => {
  let client: ReturnType<typeof createMockClient>;
  let tool: GitHubCreateTool;

  beforeEach(() => {
    client = createMockClient();
    tool = new GitHubCreateTool(client, 'test-owner', 'test-repo');
  });

  describe('createIssueFromTask', () => {
    it('should create issue with correct params', async () => {
      const task = createMockTask();
      const analysis = createMockAnalysis();

      const result = await tool.createIssueFromTask(task, analysis);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.number).toBe(42);
      }

      expect(client.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'github_create_issue',
        })
      );
    });

    it('should include type and priority labels', async () => {
      const task = createMockTask();
      const analysis = createMockAnalysis({ issueType: 'bug', priority: 'high' });

      await tool.createIssueFromTask(task, analysis);

      const callArgs = client.callTool.mock.calls[0][0];
      expect(callArgs.arguments.labels).toContain('type:bug');
      expect(callArgs.arguments.labels).toContain('priority:high');
    });
  });

  describe('createIssueForNeedsInfo', () => {
    it('should create issue with needs-info labels', async () => {
      const task = createMockTask();
      const analysis = createMockAnalysis({ confidence: 0.3 });

      const result = await tool.createIssueForNeedsInfo(task, analysis);

      expect(result.success).toBe(true);

      const callArgs = client.callTool.mock.calls[0][0];
      expect(callArgs.arguments.labels).toContain('needs-info');
    });

    it('should include custom needsInfo labels', async () => {
      const task = createMockTask();
      const analysis = createMockAnalysis({ confidence: 0.2 });

      await tool.createIssueForNeedsInfo(task, analysis, ['needs-info', 'triage']);

      const callArgs = client.callTool.mock.calls[0][0];
      expect(callArgs.arguments.labels).toContain('needs-info');
      expect(callArgs.arguments.labels).toContain('triage');
    });

    it('should include needs-info banner in body', async () => {
      const task = createMockTask();
      const analysis = createMockAnalysis({ confidence: 0.3 });

      await tool.createIssueForNeedsInfo(task, analysis);

      const callArgs = client.callTool.mock.calls[0][0];
      expect(callArgs.arguments.body).toContain('additional information');
      expect(callArgs.arguments.body).toContain('Needs additional information');
    });

    it('should include preliminary acceptance criteria label', async () => {
      const task = createMockTask();
      const analysis = createMockAnalysis({
        confidence: 0.3,
        acceptanceCriteria: ['AC1'],
      });

      await tool.createIssueForNeedsInfo(task, analysis);

      const callArgs = client.callTool.mock.calls[0][0];
      expect(callArgs.arguments.body).toContain('Preliminary');
    });

    it('should include Asana link', async () => {
      const task = createMockTask({ permalinkUrl: 'https://app.asana.com/0/123/456' });
      const analysis = createMockAnalysis({ confidence: 0.3 });

      await tool.createIssueForNeedsInfo(task, analysis);

      const callArgs = client.callTool.mock.calls[0][0];
      expect(callArgs.arguments.body).toContain('https://app.asana.com/0/123/456');
    });
  });

  describe('addComment', () => {
    it('should add comment to issue', async () => {
      client.callTool.mockResolvedValueOnce({ content: [] });

      const result = await tool.addComment(42, 'Test comment');

      expect(result.success).toBe(true);
      expect(client.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'github_add_issue_comment',
          arguments: expect.objectContaining({
            issue_number: 42,
            body: 'Test comment',
          }),
        })
      );
    });
  });

  describe('findExistingIssue', () => {
    it('should return null when no existing issue', async () => {
      client.callTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ total_count: 0, items: [] }),
          },
        ],
      });

      const result = await tool.findExistingIssue('task-gid');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should return issue when found', async () => {
      client.callTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              total_count: 1,
              items: [{ number: 10, html_url: 'https://github.com/test/repo/issues/10', id: 999 }],
            }),
          },
        ],
      });

      const result = await tool.findExistingIssue('task-gid');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.number).toBe(10);
      }
    });
  });
});
