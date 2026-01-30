/**
 * @module checks/run-checks/__tests__/executor.test
 * @description Tests for command execution engine
 */

import { describe, it, expect } from 'vitest';
import type { CheckCommand } from '../../../common/types/index.js';
import { executeCommand } from '../executor.js';

describe('executeCommand', () => {
  it('should execute successful command', async () => {
    const cmd: CheckCommand = {
      check: 'lint',
      command: process.platform === 'win32' ? 'cmd' : 'echo',
      args: process.platform === 'win32' ? ['/c', 'echo', 'test'] : ['test'],
      timeoutMs: 5000,
      cwd: process.cwd(),
    };

    const result = await executeCommand(cmd);

    expect(result.check).toBe('lint');
    expect(result.passed).toBe(true);
    expect(result.status).toBe('passed');
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should handle failing command', async () => {
    const cmd: CheckCommand = {
      check: 'test',
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args: process.platform === 'win32' ? ['/c', 'exit', '1'] : ['-c', 'exit 1'],
      timeoutMs: 5000,
      cwd: process.cwd(),
    };

    const result = await executeCommand(cmd);

    expect(result.check).toBe('test');
    expect(result.passed).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('exit code 1');
  });

  it('should handle command timeout', async () => {
    // Use node to sleep which works reliably across platforms
    const cmd: CheckCommand = {
      check: 'typecheck',
      command: 'node',
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      timeoutMs: 100,
      cwd: process.cwd(),
    };

    const result = await executeCommand(cmd);

    expect(result.check).toBe('typecheck');
    expect(result.passed).toBe(false);
    expect(result.status).toBe('timeout');
    expect(result.error).toContain('timed out');
    expect(result.durationMs).toBeGreaterThanOrEqual(100);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('should collect stdout output', async () => {
    const cmd: CheckCommand = {
      check: 'lint',
      command: process.platform === 'win32' ? 'cmd' : 'echo',
      args: process.platform === 'win32' ? ['/c', 'echo', 'Hello World'] : ['Hello World'],
      timeoutMs: 5000,
      cwd: process.cwd(),
    };

    const result = await executeCommand(cmd);

    expect(result.stdout).toBeDefined();
    expect(result.stdout).toContain('Hello World');
  });

  it('should collect stderr output', async () => {
    const cmd: CheckCommand = {
      check: 'test',
      command: process.platform === 'win32' ? 'cmd' : 'sh',
      args: process.platform === 'win32'
        ? ['/c', 'echo Error message 1>&2']
        : ['-c', 'echo "Error message" >&2'],
      timeoutMs: 5000,
      cwd: process.cwd(),
    };

    const result = await executeCommand(cmd);

    expect(result.stderr).toBeDefined();
    expect(result.stderr).toContain('Error message');
  });

  it('should handle non-existent command', async () => {
    const cmd: CheckCommand = {
      check: 'lint',
      command: 'non-existent-command-xyz',
      args: [],
      timeoutMs: 5000,
      cwd: process.cwd(),
    };

    const result = await executeCommand(cmd);

    expect(result.passed).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });
});
