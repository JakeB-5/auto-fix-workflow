/**
 * @module commands/autofix/claude-cli/__tests__/client
 * @description Unit tests for client module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invokeClaudeCLI, safeInvokeClaude } from '../client.js';
import type { ClaudeOptions } from '../types.js';
import { EventEmitter } from 'events';
import { Writable } from 'stream';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock parser functions
vi.mock('../parser.js', () => ({
  parseStreamJsonChunk: vi.fn((chunk: string) => chunk.replace(/\n/g, '')),
  parseUsageInfo: vi.fn((output: string) => {
    if (output.includes('usage')) {
      return {
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.025,
      };
    }
    return undefined;
  }),
}));

// Mock sleep to resolve immediately (avoids fake timer issues with retry logic)
vi.mock('../timer-utils.js', () => ({
  sleep: vi.fn(() => Promise.resolve()),
}));

/** Helper: create a mock child process */
function createMockProcess() {
  return Object.assign(new EventEmitter(), {
    stdin: new Writable({
      write(chunk: any, encoding: any, callback: any) {
        if (typeof callback === 'function') callback();
        return true;
      },
    }),
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
  });
}

describe('client', () => {
  let mockSpawn: ReturnType<typeof vi.fn>;
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(async () => {
    const { spawn } = await import('child_process');
    mockSpawn = spawn as ReturnType<typeof vi.fn>;
    mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('invokeClaudeCLI', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should spawn claude with correct arguments for streaming', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test prompt',
        model: 'opus',
        streamOutput: true,
      };

      const resultPromise = invokeClaudeCLI(options);

      // Simulate successful execution
      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('{"type":"result"}'));
        mockProcess.emit('close', 0);
      });

      const result = await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('claude'),
        [],
        expect.objectContaining({
          shell: true,
          windowsHide: true,
        })
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.exitCode).toBe(0);
      }
    });

    it('should spawn claude with correct arguments for json output', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test prompt',
        streamOutput: false,
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('output'));
        mockProcess.emit('close', 0);
      });

      const result = await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--output-format'),
        [],
        expect.anything()
      );

      // Should not contain --verbose for non-streaming
      const spawnCall = mockSpawn.mock.calls[0][0];
      if (!spawnCall.includes('stream-json')) {
        expect(spawnCall).not.toContain('--verbose');
      }
    });

    it('should include model in command', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        model: 'sonnet',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--model sonnet'),
        [],
        expect.anything()
      );
    });

    it('should include allowedTools in command', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        allowedTools: ['read', 'write', 'bash'],
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--allowedTools read,write,bash'),
        [],
        expect.anything()
      );
    });

    it('should include maxBudget in command', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        maxBudget: 0.5,
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('--max-budget-usd 0.5'),
        [],
        expect.anything()
      );
    });

    it('should write prompt to stdin', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test prompt with special chars: 한글',
      };

      const writespy = vi.spyOn(mockProcess.stdin!, 'write');
      const endSpy = vi.spyOn(mockProcess.stdin!, 'end');

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(writespy).toHaveBeenCalledWith('Test prompt with special chars: 한글');
      expect(endSpy).toHaveBeenCalled();
    });

    it('should use workingDir if provided', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        workingDir: '/custom/path',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.anything(),
        [],
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('should handle stdout data in streaming mode', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        streamOutput: true,
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('chunk1\n'));
        mockProcess.stdout?.emit('data', Buffer.from('chunk2\n'));
        mockProcess.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.output).toContain('chunk1');
        expect(result.data.output).toContain('chunk2');
      }
    });

    it('should handle stderr data', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.stderr?.emit('data', Buffer.from('error message'));
        mockProcess.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe('error message');
      }
    });

    it('should parse usage info from output', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.stdout?.emit(
          'data',
          Buffer.from('{"usage":{"input_tokens":100}}')
        );
        mockProcess.emit('close', 0);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usage).toEqual({
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.025,
        });
      }
    });

    it('should setup timeout handler', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      // Verify timeout was set up
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5000
      );
    });

    it('should handle CLI not found error', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        const error: NodeJS.ErrnoException = new Error('spawn ENOENT');
        error.code = 'ENOENT';
        mockProcess.emit('error', error);
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CLI_NOT_FOUND');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should handle generic spawn error', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('error', new Error('Spawn failed'));
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.message).toContain('Failed to spawn');
      }
    });

    it('should handle non-zero exit code', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.stdout?.emit('data', Buffer.from('error output'));
        mockProcess.emit('close', 1);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.exitCode).toBe(1);
      }
    });

    it('should clear timeout on successful completion', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should clear timeout on error', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('error', new Error('Test error'));
      });

      await resultPromise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should handle null exit code', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
      };

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', null);
      });

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exitCode).toBe(1);
      }
    });

    it('should default to 2 minute timeout', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        // timeout not specified
      };

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const resultPromise = invokeClaudeCLI(options);

      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      await resultPromise;

      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        120000
      );
    });
  });

  describe('safeInvokeClaude', () => {
    // sleep is mocked via vi.mock('../timer-utils.js') to resolve immediately.
    // Use setTimeout(fn, 0) instead of process.nextTick for mock event emission
    // because process.nextTick is unreliable in vitest's vmThreads pool.

    /** Helper: create a spawn mock that emits events via setTimeout(0) */
    function mockSpawnWithEvents(
      eventsFn: (proc: ReturnType<typeof createMockProcess>) => void
    ) {
      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        setTimeout(() => eventsFn(proc), 0);
        return proc;
      });
    }

    it('should return result on first success', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      mockSpawnWithEvents((proc) => {
        proc.stdout?.emit('data', Buffer.from('success'));
        proc.emit('close', 0);
      });

      const result = await safeInvokeClaude(options);

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit error', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      let attempt = 0;
      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        const currentAttempt = ++attempt;

        setTimeout(() => {
          if (currentAttempt === 1) {
            proc.stderr?.emit(
              'data',
              Buffer.from('Rate limit exceeded')
            );
            proc.emit('close', 1);
          } else {
            proc.stdout?.emit('data', Buffer.from('success'));
            proc.emit('close', 0);
          }
        }, 0);

        return proc;
      });

      const result = await safeInvokeClaude(options, 3);

      expect(result.success).toBe(true);
      expect(mockSpawn.mock.calls.length).toBeGreaterThan(1);
    });

    it('should retry on overloaded error', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      let attempt = 0;
      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        const currentAttempt = ++attempt;

        setTimeout(() => {
          if (currentAttempt === 1) {
            proc.stderr?.emit(
              'data',
              Buffer.from('Service is overloaded')
            );
            proc.emit('close', 1);
          } else {
            proc.stdout?.emit('data', Buffer.from('success'));
            proc.emit('close', 0);
          }
        }, 0);

        return proc;
      });

      const result = await safeInvokeClaude(options, 3);

      expect(result.success).toBe(true);
    });

    it('should use exponential backoff', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      let attempt = 0;
      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        const currentAttempt = ++attempt;

        setTimeout(() => {
          if (currentAttempt < 3) {
            proc.stderr?.emit('data', Buffer.from('Rate limit'));
            proc.emit('close', 1);
          } else {
            proc.stdout?.emit('data', Buffer.from('success'));
            proc.emit('close', 0);
          }
        }, 0);

        return proc;
      });

      await safeInvokeClaude(options, 3);

      // Verify retries happened with exponential backoff
      const { sleep } = await import('../timer-utils.js');
      expect(sleep).toHaveBeenCalledWith(1000); // 2^0 * 1000
      expect(sleep).toHaveBeenCalledWith(2000); // 2^1 * 1000
      expect(mockSpawn.mock.calls.length).toBe(3);
    });

    it('should not retry on CLI_NOT_FOUND error', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        setTimeout(() => {
          const error: NodeJS.ErrnoException = new Error('spawn ENOENT');
          error.code = 'ENOENT';
          proc.emit('error', error);
        }, 0);
        return proc;
      });

      const result = await safeInvokeClaude(options, 3);

      expect(result.success).toBe(false);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should return error on non-retryable failure', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      mockSpawnWithEvents((proc) => {
        proc.stderr?.emit(
          'data',
          Buffer.from('Invalid API key')
        );
        proc.emit('close', 1);
      });

      const result = await safeInvokeClaude(options, 3);

      expect(result.success).toBe(false);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should return last error after max retries', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        setTimeout(() => {
          proc.emit('error', new Error('Persistent error'));
        }, 0);
        return proc;
      });

      const result = await safeInvokeClaude(options, 3);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
      expect(mockSpawn).toHaveBeenCalledTimes(3);
    });

    it('should default to 3 retries', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        setTimeout(() => {
          proc.stderr?.emit('data', Buffer.from('Rate limit'));
          proc.emit('close', 1);
        }, 0);
        return proc;
      });

      await safeInvokeClaude(options);

      expect(mockSpawn).toHaveBeenCalledTimes(3);
    });

    it('should handle case-insensitive error messages', async () => {
      const options: ClaudeOptions = {
        prompt: 'Test',
        timeout: 5000,
      };

      let attempt = 0;
      mockSpawn.mockImplementation(() => {
        const proc = createMockProcess();
        const currentAttempt = ++attempt;

        setTimeout(() => {
          if (currentAttempt === 1) {
            proc.stderr?.emit(
              'data',
              Buffer.from('RATE LIMIT EXCEEDED')
            );
            proc.emit('close', 1);
          } else {
            proc.stdout?.emit('data', Buffer.from('success'));
            proc.emit('close', 0);
          }
        }, 0);

        return proc;
      });

      const result = await safeInvokeClaude(options, 3);

      expect(result.success).toBe(true);
    });
  });
});
