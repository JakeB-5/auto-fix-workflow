/**
 * @module commands/autofix/mcp-tools/run-checks
 * @description Local check MCP tool for running tests, linting, and type checking
 */

import { z } from 'zod';
import type {
  CheckType,
  CheckStatus,
  CheckResult,
  SingleCheckResult,
  RunChecksParams,
  CheckConfiguration,
  CheckCommand,
  PackageManager,
} from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err } from '../../../common/types/result.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Schema for run checks parameters
 */
export const RunChecksInputSchema = z.object({
  worktreePath: z.string(),
  checks: z.array(z.enum(['test', 'typecheck', 'lint'])),
  failFast: z.boolean().optional().default(true),
  timeout: z.number().optional().default(300000),
});

export type RunChecksInput = z.infer<typeof RunChecksInputSchema>;

/**
 * Run checks error
 */
export interface RunChecksError {
  readonly code: RunChecksErrorCode;
  readonly message: string;
  readonly check?: CheckType | undefined;
  readonly cause?: Error | undefined;
}

export type RunChecksErrorCode =
  | 'INVALID_PATH'
  | 'PACKAGE_MANAGER_NOT_FOUND'
  | 'CHECK_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Check configuration options
 */
export interface ChecksToolConfig {
  readonly testCommand?: string;
  readonly typeCheckCommand?: string;
  readonly lintCommand?: string;
  readonly testTimeout?: number;
  readonly typeCheckTimeout?: number;
  readonly lintTimeout?: number;
}

/**
 * Run Checks MCP Tool
 *
 * Executes test, lint, and type-check commands in a worktree
 */
export class RunChecksTool {
  private readonly config: ChecksToolConfig;

  constructor(config: ChecksToolConfig = {}) {
    this.config = config;
  }

  /**
   * Tool name for MCP registration
   */
  static readonly toolName = 'run_checks';

  /**
   * Tool description
   */
  static readonly toolDescription = 'Run test, lint, and type-check commands';

  /**
   * Run checks in a worktree
   */
  async runChecks(
    params: RunChecksParams
  ): Promise<Result<CheckResult, RunChecksError>> {
    const startTime = Date.now();
    const results: SingleCheckResult[] = [];

    try {
      // Validate worktree path
      const pathExists = await this.pathExists(params.worktreePath);
      if (!pathExists) {
        return err({
          code: 'INVALID_PATH',
          message: `Worktree path does not exist: ${params.worktreePath}`,
        });
      }

      // Detect package manager and configuration
      const checkConfig = await this.detectConfiguration(params.worktreePath);

      // Run each check in order
      for (const checkType of params.checks) {
        const checkStartTime = Date.now();
        const command = checkConfig.commands[checkType];

        try {
          const result = await this.executeCheck(
            checkType,
            command.command,
            command.args,
            params.worktreePath,
            params.timeout ?? command.timeoutMs
          );

          results.push(result);

          // Stop on first failure if failFast
          if (params.failFast !== false && !result.passed) {
            break;
          }
        } catch (error) {
          const errorResult: SingleCheckResult = {
            check: checkType,
            passed: false,
            status: 'failed',
            durationMs: Date.now() - checkStartTime,
            error: error instanceof Error ? error.message : String(error),
          };
          results.push(errorResult);

          if (params.failFast !== false) {
            break;
          }
        }
      }

      const totalDurationMs = Date.now() - startTime;
      const passed = results.every(r => r.passed);

      return ok({
        passed,
        results,
        attempt: 1,
        totalDurationMs,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCause = error instanceof Error ? error : undefined;
      return err({
        code: 'UNKNOWN' as const,
        message: errorMessage,
        ...(errorCause ? { cause: errorCause } : {}),
      });
    }
  }

  /**
   * Execute a single check
   */
  private async executeCheck(
    checkType: CheckType,
    command: string,
    args: readonly string[],
    cwd: string,
    timeout: number
  ): Promise<SingleCheckResult> {
    const startTime = Date.now();
    const fullCommand = `${command} ${args.join(' ')}`.trim();

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          CI: 'true',
          FORCE_COLOR: '0',
        },
      });

      return {
        check: checkType,
        passed: true,
        status: 'passed',
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        exitCode: 0,
      };
    } catch (error) {
      const execError = error as ExecError;
      const durationMs = Date.now() - startTime;

      // Check for timeout
      if (execError.killed && execError.signal === 'SIGTERM') {
        const result: SingleCheckResult = {
          check: checkType,
          passed: false,
          status: 'timeout',
          durationMs,
          error: 'Check timed out',
        };
        if (execError.stdout !== undefined) (result as { stdout?: string }).stdout = execError.stdout;
        if (execError.stderr !== undefined) (result as { stderr?: string }).stderr = execError.stderr;
        return result;
      }

      const failResult: SingleCheckResult = {
        check: checkType,
        passed: false,
        status: 'failed',
        durationMs,
        error: execError.message,
      };
      if (execError.stdout !== undefined) (failResult as { stdout?: string }).stdout = execError.stdout;
      if (execError.stderr !== undefined) (failResult as { stderr?: string }).stderr = execError.stderr;
      if (execError.code !== undefined) (failResult as { exitCode?: number }).exitCode = execError.code;
      return failResult;
    }
  }

  /**
   * Detect package manager and generate check configuration
   */
  private async detectConfiguration(
    worktreePath: string
  ): Promise<CheckConfiguration> {
    const packageManager = await this.detectPackageManager(worktreePath);

    const commands: Readonly<Record<CheckType, CheckCommand>> = {
      test: {
        check: 'test' as CheckType,
        command: this.config.testCommand ?? this.getTestCommand(packageManager),
        args: [],
        timeoutMs: this.config.testTimeout ?? 300000,
        cwd: worktreePath,
      },
      typecheck: {
        check: 'typecheck' as CheckType,
        command: this.config.typeCheckCommand ?? this.getTypeCheckCommand(packageManager),
        args: [],
        timeoutMs: this.config.typeCheckTimeout ?? 60000,
        cwd: worktreePath,
      },
      lint: {
        check: 'lint' as CheckType,
        command: this.config.lintCommand ?? this.getLintCommand(packageManager),
        args: [],
        timeoutMs: this.config.lintTimeout ?? 120000,
        cwd: worktreePath,
      },
    };

    return {
      packageManager,
      commands,
      order: ['lint', 'typecheck', 'test'],
    };
  }

  /**
   * Detect package manager from lock files
   */
  private async detectPackageManager(
    worktreePath: string
  ): Promise<PackageManager> {
    const checks: Array<[string, PackageManager]> = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
    ];

    for (const [file, pm] of checks) {
      if (await this.pathExists(path.join(worktreePath, file))) {
        return pm;
      }
    }

    return 'npm';
  }

  /**
   * Get test command for package manager
   */
  private getTestCommand(pm: PackageManager): string {
    switch (pm) {
      case 'pnpm':
        return 'pnpm test';
      case 'yarn':
        return 'yarn test';
      default:
        return 'npm test';
    }
  }

  /**
   * Get type-check command for package manager
   */
  private getTypeCheckCommand(pm: PackageManager): string {
    switch (pm) {
      case 'pnpm':
        return 'pnpm run type-check';
      case 'yarn':
        return 'yarn type-check';
      default:
        return 'npm run type-check';
    }
  }

  /**
   * Get lint command for package manager
   */
  private getLintCommand(pm: PackageManager): string {
    switch (pm) {
      case 'pnpm':
        return 'pnpm run lint';
      case 'yarn':
        return 'yarn lint';
      default:
        return 'npm run lint';
    }
  }

  /**
   * Check if path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Exec error type
 */
interface ExecError extends Error {
  code?: number;
  signal?: string;
  killed?: boolean;
  stdout?: string;
  stderr?: string;
}

/**
 * Create tool definition for MCP server
 */
export function createRunChecksTool(config?: ChecksToolConfig) {
  const tool = new RunChecksTool(config);

  return {
    name: RunChecksTool.toolName,
    description: RunChecksTool.toolDescription,
    inputSchema: {
      type: 'object' as const,
      properties: {
        worktreePath: {
          type: 'string',
          description: 'Path to the worktree',
        },
        checks: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['test', 'typecheck', 'lint'],
          },
          description: 'Checks to run',
        },
        failFast: {
          type: 'boolean',
          description: 'Stop on first failure',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
        },
      },
      required: ['worktreePath', 'checks'],
    },
    handler: async (params: RunChecksInput) => {
      return tool.runChecks(params);
    },
  };
}
