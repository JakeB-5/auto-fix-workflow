/**
 * @module checks/run-checks/command-mapper
 * @description Maps check types to package manager commands
 */

import type { CheckType, CheckCommand, PackageManager } from '../../common/types/index.js';

/**
 * Default timeout per check type (milliseconds)
 */
const DEFAULT_TIMEOUTS: Record<CheckType, number> = {
  lint: 60_000,      // 1 minute
  typecheck: 120_000, // 2 minutes
  test: 300_000,     // 5 minutes
};

/**
 * Command mapping for each check type and package manager
 */
const COMMAND_MAP: Record<CheckType, Record<PackageManager, { command: string; args: string[] }>> = {
  lint: {
    npm: { command: 'npm', args: ['run', 'lint'] },
    pnpm: { command: 'pnpm', args: ['run', 'lint'] },
    yarn: { command: 'yarn', args: ['run', 'lint'] },
  },
  typecheck: {
    npm: { command: 'npm', args: ['run', 'typecheck'] },
    pnpm: { command: 'pnpm', args: ['run', 'typecheck'] },
    yarn: { command: 'yarn', args: ['run', 'typecheck'] },
  },
  test: {
    npm: { command: 'npm', args: ['run', 'test'] },
    pnpm: { command: 'pnpm', args: ['run', 'test'] },
    yarn: { command: 'yarn', args: ['run', 'test'] },
  },
};

/**
 * Get check command for given check type and package manager
 * @param check - Check type
 * @param pm - Package manager
 * @param cwd - Working directory
 * @param timeout - Optional custom timeout
 * @returns Check command configuration
 */
export function getCheckCommand(
  check: CheckType,
  pm: PackageManager,
  cwd: string,
  timeout?: number,
): CheckCommand {
  const mapping = COMMAND_MAP[check][pm];

  return {
    check,
    command: mapping.command,
    args: mapping.args,
    timeoutMs: timeout ?? DEFAULT_TIMEOUTS[check],
    cwd,
  };
}
