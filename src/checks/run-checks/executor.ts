/**
 * @module checks/run-checks/executor
 * @description Command execution engine for checks
 */

import { spawn } from 'child_process';
import type { CheckCommand, SingleCheckResult, CheckStatus } from '../../common/types/index.js';

/**
 * Execute a check command
 * @param cmd - Check command to execute
 * @returns Check result
 */
export async function executeCommand(cmd: CheckCommand): Promise<SingleCheckResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let exitCode: number | undefined;

    // Spawn child process
    const child = spawn(cmd.command, cmd.args, {
      cwd: cmd.cwd,
      shell: true,
      windowsHide: true,
    });

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, cmd.timeoutMs);

    // Collect stdout
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Collect stderr
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Handle process exit
    child.on('exit', (code) => {
      exitCode = code ?? undefined;
    });

    // Handle process close
    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      if (exitCode === undefined) {
        exitCode = code ?? undefined;
      }

      let status: CheckStatus;
      let passed: boolean;
      let error: string | undefined;

      if (timedOut) {
        status = 'timeout';
        passed = false;
        error = `Check timed out after ${cmd.timeoutMs}ms`;
      } else if (exitCode === 0) {
        status = 'passed';
        passed = true;
      } else {
        status = 'failed';
        passed = false;
        error = `Check failed with exit code ${exitCode}`;
      }

      resolve({
        check: cmd.check,
        passed,
        status,
        stdout: stdout.trim() || undefined,
        stderr: stderr.trim() || undefined,
        durationMs,
        exitCode,
        error,
      });
    });

    // Handle process error
    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      resolve({
        check: cmd.check,
        passed: false,
        status: 'failed',
        stdout: stdout.trim() || undefined,
        stderr: stderr.trim() || undefined,
        durationMs,
        exitCode: undefined,
        error: `Failed to execute command: ${err.message}`,
      });
    });
  });
}
