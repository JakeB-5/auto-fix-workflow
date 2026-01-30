/**
 * @module checks/run-checks/output
 * @description Output log processing and formatting
 */

import type { SingleCheckResult } from '../../common/types/index.js';

/**
 * Format a single check result for display
 * @param result - Check result to format
 * @returns Formatted output string
 */
export function formatOutput(result: SingleCheckResult): string {
  const lines: string[] = [];

  // Header
  const statusEmoji = result.passed ? '✓' : '✗';
  const statusText = result.status.toUpperCase();
  lines.push(`${statusEmoji} ${result.check.toUpperCase()} - ${statusText}`);

  // Duration
  const durationSec = (result.durationMs / 1000).toFixed(2);
  lines.push(`Duration: ${durationSec}s`);

  // Exit code if available
  if (result.exitCode !== undefined) {
    lines.push(`Exit Code: ${result.exitCode}`);
  }

  // Error message if present
  if (result.error) {
    lines.push('');
    lines.push('Error:');
    lines.push(result.error);
  }

  // Standard output if present
  if (result.stdout) {
    lines.push('');
    lines.push('Output:');
    lines.push(formatLogs(result.stdout, 100));
  }

  // Standard error if present
  if (result.stderr) {
    lines.push('');
    lines.push('Errors:');
    lines.push(formatLogs(result.stderr, 100));
  }

  return lines.join('\n');
}

/**
 * Format log output, optionally truncating to max lines
 * @param logs - Raw log output
 * @param maxLines - Maximum lines to include (0 = no limit)
 * @returns Formatted log output
 */
function formatLogs(logs: string, maxLines: number = 0): string {
  const lines = logs.split('\n');

  if (maxLines > 0 && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const truncated = lines.length - maxLines;
    kept.push(`... (${truncated} more lines truncated)`);
    return kept.join('\n');
  }

  return logs;
}

/**
 * Parse error messages from check output
 * @param result - Check result
 * @returns Array of parsed error messages
 */
export function parseErrorMessages(result: SingleCheckResult): string[] {
  const errors: string[] = [];

  // Add main error if present
  if (result.error) {
    errors.push(result.error);
  }

  // Parse stderr for error patterns
  if (result.stderr) {
    // Common error patterns
    const patterns = [
      /error:/gi,
      /Error:/g,
      /failed/gi,
      /Failed/g,
      /✗/g,
      /✖/g,
    ];

    const lines = result.stderr.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && patterns.some((pattern) => pattern.test(trimmed))) {
        errors.push(trimmed);
      }
    }
  }

  return errors;
}

/**
 * Extract file paths from error messages
 * @param output - Check output (stdout or stderr)
 * @returns Array of file paths mentioned in errors
 */
export function extractFilePaths(output: string): string[] {
  const filePaths = new Set<string>();

  // Common file path patterns
  const patterns = [
    // TypeScript/JavaScript: src/path/to/file.ts:line:col
    /(?:\.\/)?(?:src|test|lib)\/[^\s:]+\.[jt]sx?(?::\d+:\d+)?/g,
    // Generic: path/to/file.ext
    /(?:\.\/)?[\w-]+(?:\/[\w-]+)+\.\w+/g,
  ];

  for (const pattern of patterns) {
    const matches = output.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        // Remove line/column numbers
        const cleaned = match.replace(/:\d+:\d+$/, '');
        filePaths.add(cleaned);
      });
    }
  }

  return Array.from(filePaths);
}
