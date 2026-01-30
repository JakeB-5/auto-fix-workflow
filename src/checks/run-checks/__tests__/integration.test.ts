/**
 * @module checks/run-checks/__tests__/integration.test
 * @description Integration tests for check runner
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runChecks } from '../runner.js';
import { formatOutput, parseErrorMessages, extractFilePaths } from '../output.js';
import { isSuccess } from '../../../common/types/index.js';
import type { RunChecksParams } from '../../../common/types/index.js';

describe('Integration: runChecks with real project structure', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-integration-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should run all checks successfully on valid project', async () => {
    // Create package.json
    const packageJson = {
      name: 'test-project',
      scripts: {
        lint: 'echo "Linting completed successfully"',
        typecheck: 'echo "Type checking completed"',
        test: 'echo "All tests passed"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    // Create npm lock file
    await fs.writeFile(path.join(tempDir, 'package-lock.json'), '{}');

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['typecheck', 'lint', 'test'],
      failFast: false,
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const { data: value } = result;

      // All checks should pass
      expect(value.passed).toBe(true);
      expect(value.results).toHaveLength(3);

      // Verify order
      expect(value.results[0].check).toBe('typecheck');
      expect(value.results[1].check).toBe('lint');
      expect(value.results[2].check).toBe('test');

      // All should be passed
      expect(value.results[0].passed).toBe(true);
      expect(value.results[1].passed).toBe(true);
      expect(value.results[2].passed).toBe(true);

      // Test output formatting (results[0] is now typecheck due to new order)
      const formattedOutput = formatOutput(value.results[0]);
      expect(formattedOutput).toContain('TYPECHECK');
      expect(formattedOutput).toContain('PASSED');
    }
  });

  it('should handle lint failures with formatted output', async () => {
    // Create package.json with failing lint
    const packageJson = {
      name: 'test-project',
      scripts: {
        lint: process.platform === 'win32'
          ? 'echo Error: src/index.ts:10:5 - Unexpected token 1>&2 & exit 1'
          : 'echo "Error: src/index.ts:10:5 - Unexpected token" >&2 && exit 1',
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
      const lintResult = result.data.results[0];

      expect(lintResult.passed).toBe(false);
      expect(lintResult.status).toBe('failed');

      // Test error parsing
      const errors = parseErrorMessages(lintResult);
      expect(errors.length).toBeGreaterThan(0);

      // Test file path extraction
      const filePaths = extractFilePaths(lintResult.stderr ?? '');
      expect(filePaths).toContain('src/index.ts');
    }
  });

  it('should detect correct package manager and use appropriate commands', async () => {
    // Test with npm (most reliable across all environments)
    await fs.writeFile(path.join(tempDir, 'package-lock.json'), '{}');

    const packageJson = {
      name: 'test-project',
      scripts: {
        lint: 'echo "Using npm"',
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
      expect(result.data.results[0].passed).toBe(true);
    }
  });

  // Skip on Windows due to process cleanup issues, and on Linux CI due to shell quoting issues
  const skipTimeoutTest = process.platform === 'win32' || (process.platform === 'linux' && process.env.CI === 'true');
  it.skipIf(skipTimeoutTest)('should respect custom timeout', async () => {
    const packageJson = {
      name: 'test-project',
      scripts: {
        // Use node to sleep which works reliably across platforms
        test: 'node -e "setTimeout(() => {}, 10000)"',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['test'],
      timeout: 500, // 500ms timeout
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const testResult = result.data.results[0];
      expect(testResult.passed).toBe(false);
      expect(testResult.status).toBe('timeout');
    }
  });

  it('should provide detailed output formatting for debugging', async () => {
    const packageJson = {
      name: 'test-project',
      scripts: {
        typecheck: process.platform === 'win32'
          ? 'echo Checking types... & echo Found 3 errors & echo src/utils.ts:15:3 - Type error 1>&2 & exit 1'
          : 'echo "Checking types..." && echo "Found 3 errors" && echo "src/utils.ts:15:3 - Type error" >&2 && exit 1',
      },
    };
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
    );

    const params: RunChecksParams = {
      worktreePath: tempDir,
      checks: ['typecheck'],
    };

    const result = await runChecks(params);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      const typecheckResult = result.data.results[0];

      // Format output
      const formatted = formatOutput(typecheckResult);

      expect(formatted).toContain('TYPECHECK');
      expect(formatted).toContain('FAILED');
      expect(formatted).toContain('Duration:');
      expect(formatted).toContain('Exit Code: 1');

      // Should contain both stdout and stderr
      if (typecheckResult.stdout) {
        expect(formatted).toContain('Output:');
      }
      if (typecheckResult.stderr) {
        expect(formatted).toContain('Errors:');
      }
    }
  });
});
