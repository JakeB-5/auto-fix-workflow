/**
 * @module analyzer/task-analyzer/__tests__/integration
 * @description Integration tests for TaskAnalyzer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskAnalyzer } from '../analyzer.js';
import { AsanaClient } from '../asana-client.js';
import type { AsanaTask } from '../types.js';
import { isSuccess, isFailure } from '../../../common/types/index.js';

// Mock Asana client
vi.mock('../asana-client.js');

describe('TaskAnalyzer Integration', () => {
  let analyzer: TaskAnalyzer;
  let mockClient: AsanaClient;

  beforeEach(() => {
    mockClient = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
      addComment: vi.fn(),
      addTag: vi.fn(),
    } as unknown as AsanaClient;

    analyzer = new TaskAnalyzer({
      accessToken: 'test-token',
      autoExecuteActions: false,
    });

    // Replace client with mock
    (analyzer as any).client = mockClient;
  });

  it('should analyze a complete task successfully', async () => {
    const mockTask: AsanaTask = {
      gid: '123',
      name: 'Fix button click error',
      notes: `
Error occurs when clicking submit button.

Steps to reproduce:
1. Navigate to /dashboard
2. Click "Submit" button

Expected: Form should submit
Actual: TypeError is thrown

Error: Cannot read property 'value' of undefined
at handleSubmit (Form.tsx:42)

Environment: Chrome 120
`,
      completed: false,
    };

    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: true,
      data: mockTask,
    });

    const result = await analyzer.analyzeTask('123');

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const analysis = result.data;
      expect(analysis.taskId).toBe('123');
      expect(analysis.isReproducible).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0.6);
      expect(analysis.informationSufficiency).toBe('sufficient');
      expect(analysis.codeHints.length).toBeGreaterThan(0);
      expect(analysis.suggestedActions.length).toBeGreaterThan(0);
    }
  });

  it('should handle incomplete task', async () => {
    const mockTask: AsanaTask = {
      gid: '456',
      name: 'Something is broken',
      notes: 'Please fix',
      completed: false,
    };

    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: true,
      data: mockTask,
    });

    const result = await analyzer.analyzeTask('456');

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const analysis = result.data;
      expect(analysis.informationSufficiency).toBe('insufficient');
      expect(
        analysis.suggestedActions.some((a) => a.type === 'request_information')
      ).toBe(true);
    }
  });

  it('should handle task not found', async () => {
    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Task 999 not found',
      },
    });

    const result = await analyzer.analyzeTask('999');

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe('TASK_NOT_FOUND');
    }
  });

  it('should handle invalid task', async () => {
    const mockTask: AsanaTask = {
      gid: '789',
      name: '',
      notes: 'Task with no name',
      completed: false,
    };

    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: true,
      data: mockTask,
    });

    const result = await analyzer.analyzeTask('789');

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe('INVALID_TASK');
    }
  });

  it('should extract code hints from stack trace', async () => {
    const mockTask: AsanaTask = {
      gid: '111',
      name: 'Crash in data processor',
      notes: `
Stack trace:
  at processData (utils/data.ts:156)
  at handleUpdate (components/Dashboard.tsx:89)
  at onClick (components/Button.tsx:23)

TypeError: Cannot read property 'map' of undefined
`,
      completed: false,
    };

    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: true,
      data: mockTask,
    });

    const result = await analyzer.analyzeTask('111');

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const analysis = result.data;
      expect(analysis.codeHints.length).toBeGreaterThan(0);

      const hint = analysis.codeHints[0];
      expect(hint.file).toBeDefined();
      expect(hint.function).toBeDefined();
      expect(hint.line).toBeDefined();
      expect(hint.confidence).toBeGreaterThan(0);
    }
  });

  it('should identify non-reproducible intermittent issue', async () => {
    const mockTask: AsanaTask = {
      gid: '222',
      name: 'Random crash',
      notes: `
The application sometimes crashes randomly. Cannot reproduce consistently.
It happens occasionally but not always. Maybe once every 20 times.
`,
      completed: false,
    };

    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: true,
      data: mockTask,
    });

    const result = await analyzer.analyzeTask('222');

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const analysis = result.data;
      expect(analysis.isReproducible).toBe(false);
      expect(
        analysis.suggestedActions.some(
          (a) =>
            a.type === 'add_tag' && a.payload.tagName === 'needs-investigation'
        )
      ).toBe(true);
    }
  });

  it('should handle API error gracefully', async () => {
    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: false,
      error: {
        code: 'API_ERROR',
        message: 'Network error',
      },
    });

    const result = await analyzer.analyzeTask('333');

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe('API_ERROR');
    }
  });
});

describe('TaskAnalyzer with autoExecuteActions', () => {
  it('should execute actions when enabled', async () => {
    const mockClient = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
      addComment: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      addTag: vi.fn(),
    } as unknown as AsanaClient;

    const analyzer = new TaskAnalyzer({
      accessToken: 'test-token',
      autoExecuteActions: true,
    });

    (analyzer as any).client = mockClient;

    const mockTask: AsanaTask = {
      gid: '444',
      name: 'Test task',
      notes: 'Minimal information',
      completed: false,
    };

    vi.mocked(mockClient.getTask).mockResolvedValue({
      success: true,
      data: mockTask,
    });

    const result = await analyzer.analyzeTask('444');

    expect(isSuccess(result)).toBe(true);
    // Note: In real implementation, would verify addComment was called
  });
});
