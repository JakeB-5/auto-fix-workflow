/**
 * @module commands/autofix/pipeline/stages/check-stage
 * @description Check execution and dependency installation stage
 */

import type { CheckResult } from '../../../../common/types/index.js';
import type { Result } from '../../../../common/types/result.js';
import { ok, err } from '../../../../common/types/result.js';
import type { PipelineContext, PipelineStage } from '../../types.js';
import { RunChecksTool, type RunChecksError, type ChecksToolConfig } from '../../mcp-tools/run-checks.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Check stage configuration
 */
export interface CheckStageConfig {
  readonly checksConfig: ChecksToolConfig;
}

/**
 * Check Stage Error
 */
export interface CheckStageError {
  readonly code: 'INSTALL_FAILED' | 'CHECKS_FAILED' | 'INVALID_STATE';
  readonly message: string;
  readonly cause?: Error | undefined;
}

/**
 * Check Stage
 *
 * Handles dependency installation and running checks (lint, typecheck, test)
 */
export class CheckStage {
  readonly stageName: PipelineStage = 'checks';
  private readonly checksTool: RunChecksTool;

  constructor(config: CheckStageConfig) {
    this.checksTool = new RunChecksTool(config.checksConfig);
  }

  /**
   * Run checks in worktree
   */
  async execute(context: PipelineContext): Promise<Result<CheckResult, RunChecksError>> {
    if (!context.worktree) {
      return err({
        code: 'INVALID_PATH',
        message: 'No worktree available for checks',
      });
    }

    return this.checksTool.runChecks({
      worktreePath: context.worktree.path,
      checks: ['lint', 'typecheck', 'test'],
      failFast: true,
    });
  }

  /**
   * Install dependencies in worktree
   * Worktrees don't share node_modules, so we need to install dependencies
   */
  async installDependencies(worktreePath: string): Promise<Result<void, CheckStageError>> {
    // Detect package manager based on lock file
    let installCommand: string;
    if (fs.existsSync(path.join(worktreePath, 'pnpm-lock.yaml'))) {
      installCommand = 'pnpm install --frozen-lockfile';
    } else if (fs.existsSync(path.join(worktreePath, 'yarn.lock'))) {
      installCommand = 'yarn install --frozen-lockfile';
    } else if (fs.existsSync(path.join(worktreePath, 'package-lock.json'))) {
      installCommand = 'npm ci';
    } else if (fs.existsSync(path.join(worktreePath, 'package.json'))) {
      // Fallback to npm install if no lock file but package.json exists
      installCommand = 'npm install';
    } else {
      // No package.json, skip dependency installation
      return ok(undefined);
    }

    // Execute install command
    try {
      await execAsync(installCommand, {
        cwd: worktreePath,
        timeout: 5 * 60 * 1000, // 5 minute timeout for install
        env: { ...process.env, CI: 'true' }, // CI mode for cleaner output
      });
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        code: 'INSTALL_FAILED',
        message: `Failed to install dependencies: ${message}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Format check failure details for error message
   */
  formatCheckFailures(checkResult: CheckResult): string {
    const failedChecks = checkResult.results.filter(r => !r.passed);
    return failedChecks.map(c => {
      let detail = `[${c.check}] ${c.status}`;
      if (c.error) {
        detail += `: ${c.error}`;
      }
      // Include stderr or stdout for more context (truncated)
      const output = c.stderr || c.stdout;
      if (output) {
        const truncated = output.slice(0, 500);
        detail += `\n${truncated}${output.length > 500 ? '...(truncated)' : ''}`;
      }
      return detail;
    }).join('\n\n');
  }
}

/**
 * Create check stage from config
 */
export function createCheckStage(checksConfig: ChecksToolConfig): CheckStage {
  return new CheckStage({ checksConfig });
}
