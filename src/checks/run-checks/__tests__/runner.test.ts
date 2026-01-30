/**
 * @module checks/run-checks/__tests__/runner.test
 * @description Tests for main check runner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runChecks } from '../runner.js';
import { isSuccess, isFailure } from '../../../common/types/index.js';
import type { RunChecksParams } from '../../../common/types/index.js';

describe('runChecks', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-runner-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should fail when worktree path does not exist', async () => {
    const params: RunChecksParams = {
      worktreePath: path.join(tempDir, 'does-not-exist'),
      checks: ['lint'],
    };

    const result = await runChecks(params);

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe('WORKTREE_NOT_FOUND');
    }
  });

  it('should fail when checks array is empty', async () => {
    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: [],
    };

    const result = await runChecks(params);

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe('INVALID_CHECKS');
    }
  });

  it('should fail when checks contain invalid type', async () => {
    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['lint', 'invalid' as any],
    };

    const result = await runChecks(params);

    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error.code).toBe('INVALID_CHECKS');
    }
  });

  it('should detect package manager from lock file', async () => {
    // Create pnpm lock file
    await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');

    // Create package.json with test script
    const packageJson = {
      name: 'test',
      scripts: {
        lint: 'echo "lint passed"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['lint'],
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.results).toHaveLength(1);
    }
  });

  it('should execute checks in order: typecheck, lint, test', async () => {
    // Create package.json with all scripts
    const packageJson = {
      name: 'test',
      scripts: {
        lint: 'echo "lint"',
        typecheck: 'echo "typecheck"',
        test: 'echo "test"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['test', 'lint', 'typecheck'], // Out of order
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const checks = result.data.results.map((r) => r.check);
      expect(checks).toEqual(['typecheck', 'lint', 'test']);
    }
  });

  it('should stop on first failure when failFast is true', async () => {
    // Create package.json with failing typecheck (first in order)
    const packageJson = {
      name: 'test',
      scripts: {
        lint: 'echo "lint"',
        typecheck: 'exit 1',
        test: 'echo "test"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['typecheck', 'lint', 'test'],
      failFast: true,
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.passed).toBe(false);
      expect(result.data.results).toHaveLength(1); // Only typecheck ran
      expect(result.data.results[0].check).toBe('typecheck');
      expect(result.data.results[0].passed).toBe(false);
    }
  });

  it('should continue on failure when failFast is false', async () => {
    // Create package.json with failing typecheck (first in order)
    const packageJson = {
      name: 'test',
      scripts: {
        lint: 'echo "lint"',
        typecheck: 'exit 1',
        test: 'echo "test"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['typecheck', 'lint', 'test'],
      failFast: false,
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.passed).toBe(false);
      expect(result.data.results).toHaveLength(3); // All ran
      expect(result.data.results[0].passed).toBe(false); // typecheck failed
      expect(result.data.results[1].passed).toBe(true);  // lint passed
      expect(result.data.results[2].passed).toBe(true);  // test passed
    }
  });

  it('should track total duration', async () => {
    // Create package.json with scripts
    const packageJson = {
      name: 'test',
      scripts: {
        lint: 'echo "lint"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['lint'],
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.totalDurationMs).toBeGreaterThan(0);
    }
  });

  it('should set attempt to 1', async () => {
    // Create package.json with scripts
    const packageJson = {
      name: 'test',
      scripts: {
        lint: 'echo "lint"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['lint'],
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.attempt).toBe(1);
    }
  });
});
