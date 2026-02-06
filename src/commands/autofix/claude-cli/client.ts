/**
 * @module commands/autofix/claude-cli/client
 * @description Claude CLI invocation and execution
 */

import { spawn } from 'child_process';
import type { Result } from '../../../common/types/result.js';
import { ok, err, isFailure } from '../../../common/types/result.js';
import type { ClaudeOptions, ClaudeResult, AIError } from './types.js';
import { parseStreamJsonChunk, parseUsageInfo } from './parser.js';

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Invoke Claude CLI as subprocess
 */
export async function invokeClaudeCLI(
  options: ClaudeOptions
): Promise<Result<ClaudeResult, AIError>> {
  const {
    prompt,
    model = 'opus',
    allowedTools = [],
    maxBudget,
    workingDir,
    timeout = 120000, // 2 minutes default
    streamOutput = true, // Default to streaming
  } = options;

  // Build command string with all arguments
  // Use stream-json for real-time output visibility
  const cmdParts: string[] = [
    'claude',
    '--dangerously-skip-permissions',
    '--print',
    '--output-format',
    streamOutput ? 'stream-json' : 'json',
  ];

  // --verbose is required when using --print with --output-format=stream-json
  if (streamOutput) {
    cmdParts.push('--verbose');
  }

  if (model) {
    cmdParts.push('--model', model);
  }

  if (allowedTools.length > 0) {
    // Use comma-separated format for reliability
    cmdParts.push('--allowedTools', allowedTools.join(','));
  }

  if (maxBudget !== undefined) {
    cmdParts.push('--max-budget-usd', maxBudget.toString());
  }

  // Build complete command string (prompt will be piped via stdin)
  const commandStr = cmdParts.join(' ');

  return new Promise((resolve) => {
    // Use shell: true with command as string (no args array) to avoid DEP0190 warning
    // The prompt is piped through stdin to avoid EINVAL errors with special characters
    const claude = spawn(commandStr, [], {
      cwd: workingDir || process.cwd(),
      env: { ...process.env },
      shell: true,
      // On Windows, hide the console window
      windowsHide: true,
    });

    // Write prompt to stdin and close it
    // This avoids command-line argument issues with special characters (Korean, etc.)
    if (claude.stdin) {
      claude.stdin.write(prompt);
      claude.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let finalResult = ''; // Accumulate the final result text

    // Setup timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      claude.kill('SIGTERM');
    }, timeout);

    claude.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Parse stream-json format and display in real-time
      if (streamOutput) {
        const text = parseStreamJsonChunk(chunk, (t) => process.stderr.write(t));
        finalResult += text;
      }
    });

    claude.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutHandle);

      // Add newline after streaming output
      if (streamOutput && finalResult) {
        process.stderr.write('\n');
      }

      if (timedOut) {
        resolve(
          err({
            code: 'TIMEOUT',
            message: `Claude CLI timed out after ${timeout}ms`,
          })
        );
        return;
      }

      const exitCode = code ?? 1;
      // Use finalResult for stream mode, raw stdout for json mode
      const outputText = streamOutput ? finalResult : stdout;
      const result: ClaudeResult = {
        success: exitCode === 0,
        output: outputText || stdout,
        exitCode,
      };

      // Add error only if stderr has content
      if (stderr) {
        (result as { error?: string }).error = stderr;
      }

      // Try to parse usage information from JSON output
      const usage = parseUsageInfo(stdout);
      if (usage) {
        (result as { usage?: typeof usage }).usage = usage;
      }

      resolve(ok(result));
    });

    claude.on('error', (error) => {
      clearTimeout(timeoutHandle);

      // Check if command not found
      if ('code' in error && error.code === 'ENOENT') {
        resolve(
          err({
            code: 'CLI_NOT_FOUND',
            message: 'Claude CLI not found. Please install it first.',
            cause: error,
          })
        );
        return;
      }

      resolve(
        err({
          code: 'API_ERROR',
          message: `Failed to spawn Claude CLI: ${error.message}`,
          cause: error,
        })
      );
    });
  });
}

/**
 * Invoke Claude with retry logic
 */
export async function safeInvokeClaude(
  options: ClaudeOptions,
  maxRetries = 3
): Promise<Result<ClaudeResult, AIError>> {
  let lastError: AIError | undefined;

  for (let i = 0; i < maxRetries; i++) {
    const result = await invokeClaudeCLI(options);

    if (result.success) {
      if (result.data.success) {
        return result;
      }

      // Check for rate limit or overload
      const errorMsg = result.data.error?.toLowerCase() || '';
      if (
        errorMsg.includes('overloaded') ||
        errorMsg.includes('rate') ||
        errorMsg.includes('limit')
      ) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }

      // Other failure, return immediately
      return err({
        code: 'API_ERROR',
        message: result.data.error || 'Claude CLI failed',
      });
    } else if (isFailure(result)) {
      // If we reach here, result.success is false
      // Handle known error codes
      if (result.error.code === 'CLI_NOT_FOUND') {
        return result; // Don't retry if CLI not found
      }

      if (result.error.code === 'TIMEOUT') {
        return result; // Don't retry on timeout
      }

      lastError = result.error;
      await sleep(1000); // Brief pause before retry
    }
  }

  return err(
    lastError || {
      code: 'API_ERROR',
      message: 'Max retries exceeded',
    }
  );
}
