/**
 * @module analyzer/code-locator/__tests__/integration
 * @description Integration tests for CodeLocator
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CodeLocator } from '../locator.js';
import { isSuccess, isFailure } from '../../../common/types/result.js';
import type { CodeHint } from '../types.js';
import { LocatorErrorCode } from '../types.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

describe('CodeLocator Integration', () => {
  let testDir: string;
  let locator: CodeLocator;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-locator-test-'));

    // Create test file structure
    await createTestFiles(testDir);

    // Initialize locator
    locator = new CodeLocator(testDir);
  });

  describe('locate', () => {
    it('should locate code from function hint', async () => {
      const hints: CodeHint[] = [
        { type: 'function', content: 'processUser' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.locations.length).toBeGreaterThan(0);
        expect(result.data.locations[0]?.functionName).toBe('processUser');
      }
    });

    it('should locate code from class hint', async () => {
      const hints: CodeHint[] = [
        { type: 'class', content: 'UserService' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.locations.length).toBeGreaterThan(0);
        expect(result.data.locations[0]?.className).toBe('UserService');
      }
    });

    it('should locate code from filename hint', async () => {
      const hints: CodeHint[] = [
        { type: 'filename', content: 'user-service.ts' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.locations.length).toBeGreaterThan(0);
        expect(result.data.locations[0]?.filePath).toContain('user-service.ts');
      }
    });

    it('should locate code from text hint', async () => {
      const hints: CodeHint[] = [
        { type: 'text', content: 'validateEmail' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.locations.length).toBeGreaterThan(0);
      }
    });

    it('should identify components', async () => {
      const hints: CodeHint[] = [
        { type: 'function', content: 'processUser' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.components.length).toBeGreaterThan(0);
      }
    });

    it('should suggest labels', async () => {
      const hints: CodeHint[] = [
        { type: 'function', content: 'processUser' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.suggestedLabels.length).toBeGreaterThan(0);
      }
    });

    it('should return error for empty hints', async () => {
      const result = await locator.locate([]);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe(LocatorErrorCode.INVALID_HINT);
      }
    });

    it('should handle multiple hints', async () => {
      const hints: CodeHint[] = [
        { type: 'function', content: 'processUser' },
        { type: 'class', content: 'UserService' },
      ];

      const result = await locator.locate(hints);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.locations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('locateFromError', () => {
    it('should locate code from error with stack trace', async () => {
      const filePath = path.join(testDir, 'src/user/user-service.ts');
      const errorMessage = `
Error: User not found
    at processUser (${filePath}:10:15)
      `.trim();

      const result = await locator.locateFromError(errorMessage);

      // Should successfully process the stack trace
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        // Result should have the expected structure
        expect(result.data).toHaveProperty('locations');
        expect(result.data).toHaveProperty('components');
        expect(result.data).toHaveProperty('suggestedLabels');
        expect(Array.isArray(result.data.locations)).toBe(true);
      }
    });

    it('should locate code from error without stack trace', async () => {
      const errorMessage = 'validateEmail failed';

      const result = await locator.locateFromError(errorMessage);

      expect(isSuccess(result)).toBe(true);
      // May or may not find results, depending on test files
    });
  });
});

/**
 * Create test file structure
 */
async function createTestFiles(baseDir: string): Promise<void> {
  const srcDir = path.join(baseDir, 'src');
  const userDir = path.join(srcDir, 'user');

  await fs.mkdir(userDir, { recursive: true });

  // Create user-service.ts
  const userServiceContent = `
export class UserService {
  processUser(userId: string): void {
    const email = this.validateEmail(userId);
    console.log(email);
  }

  validateEmail(email: string): string {
    return email.toLowerCase();
  }
}

export function processUser(userId: string): void {
  const service = new UserService();
  service.processUser(userId);
}
  `.trim();

  await fs.writeFile(
    path.join(userDir, 'user-service.ts'),
    userServiceContent,
    'utf-8'
  );

  // Create validator.ts
  const validatorContent = `
export function validateEmail(email: string): boolean {
  return email.includes('@');
}
  `.trim();

  await fs.writeFile(
    path.join(userDir, 'validator.ts'),
    validatorContent,
    'utf-8'
  );
}
