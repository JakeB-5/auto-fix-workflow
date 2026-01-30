/**
 * @fileoverview Unit tests for gitignore generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasGitignoreEntry,
  addToGitignore,
  ensureAutoFixYamlIgnored,
} from '../gitignore.js';
import { isSuccess, isFailure } from '../../../../common/types/index.js';

describe('gitignore generator', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = join(tmpdir(), `gitignore-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('hasGitignoreEntry', () => {
    it('should return false when .gitignore does not exist', async () => {
      const result = await hasGitignoreEntry(testDir, '.auto-fix.yaml');
      expect(result).toBe(false);
    });

    it('should return false when entry does not exist', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n.env\n', 'utf-8');

      const result = await hasGitignoreEntry(testDir, '.auto-fix.yaml');
      expect(result).toBe(false);
    });

    it('should return true when entry exists', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(
        gitignorePath,
        'node_modules/\n.auto-fix.yaml\n.env\n',
        'utf-8'
      );

      const result = await hasGitignoreEntry(testDir, '.auto-fix.yaml');
      expect(result).toBe(true);
    });

    it('should ignore comments', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(
        gitignorePath,
        'node_modules/\n# .auto-fix.yaml\n.env\n',
        'utf-8'
      );

      const result = await hasGitignoreEntry(testDir, '.auto-fix.yaml');
      expect(result).toBe(false);
    });

    it('should handle inline comments', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(
        gitignorePath,
        'node_modules/\n.auto-fix.yaml # config file\n.env\n',
        'utf-8'
      );

      const result = await hasGitignoreEntry(testDir, '.auto-fix.yaml');
      expect(result).toBe(true);
    });

    it('should handle whitespace', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(
        gitignorePath,
        'node_modules/\n  .auto-fix.yaml  \n.env\n',
        'utf-8'
      );

      const result = await hasGitignoreEntry(testDir, '.auto-fix.yaml');
      expect(result).toBe(true);
    });
  });

  describe('addToGitignore', () => {
    it('should create .gitignore if it does not exist', async () => {
      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const gitignorePath = join(testDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('.auto-fix.yaml\n');
    });

    it('should append to existing .gitignore with newline', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n.env\n', 'utf-8');

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('node_modules/\n.env\n.auto-fix.yaml\n');
    });

    it('should add newline if file does not end with one', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n.env', 'utf-8');

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('node_modules/\n.env\n.auto-fix.yaml\n');
    });

    it('should not add duplicate entry', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(
        gitignorePath,
        'node_modules/\n.auto-fix.yaml\n.env\n',
        'utf-8'
      );

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('node_modules/\n.auto-fix.yaml\n.env\n');
    });

    it('should handle empty file', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '', 'utf-8');

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('.auto-fix.yaml\n');
    });

    it('should return error on invalid path', async () => {
      const invalidPath = join(testDir, 'nonexistent', 'deep', 'path');
      const result = await addToGitignore(invalidPath, '.auto-fix.yaml');

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('should preserve existing content exactly', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      const existingContent = '# Generated files\nnode_modules/\n.env\n\n# IDE\n.vscode/\n';
      await fs.writeFile(gitignorePath, existingContent, 'utf-8');

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe(existingContent + '.auto-fix.yaml\n');
    });
  });

  describe('ensureAutoFixYamlIgnored', () => {
    it('should add .auto-fix.yaml to gitignore', async () => {
      const result = await ensureAutoFixYamlIgnored(testDir);

      expect(isSuccess(result)).toBe(true);

      const gitignorePath = join(testDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('.auto-fix.yaml\n');
    });

    it('should not duplicate if already present', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(
        gitignorePath,
        'node_modules/\n.auto-fix.yaml\n.env\n',
        'utf-8'
      );

      const result = await ensureAutoFixYamlIgnored(testDir);

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('node_modules/\n.auto-fix.yaml\n.env\n');
    });

    it('should work with empty gitignore', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '', 'utf-8');

      const result = await ensureAutoFixYamlIgnored(testDir);

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('.auto-fix.yaml\n');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple calls idempotently', async () => {
      await addToGitignore(testDir, '.auto-fix.yaml');
      await addToGitignore(testDir, '.auto-fix.yaml');
      await addToGitignore(testDir, '.auto-fix.yaml');

      const gitignorePath = join(testDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      const occurrences = (content.match(/\.auto-fix\.yaml/g) || []).length;
      expect(occurrences).toBe(1);
    });

    it('should handle different entries independently', async () => {
      await addToGitignore(testDir, '.auto-fix.yaml');
      await addToGitignore(testDir, '.env');
      await addToGitignore(testDir, 'node_modules/');

      const gitignorePath = join(testDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('.auto-fix.yaml\n.env\nnode_modules/\n');
    });

    it('should handle file with only whitespace', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '   \n  \n\n', 'utf-8');

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe('   \n  \n\n.auto-fix.yaml\n');
    });

    it('should handle file with CRLF line endings', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\r\n.env\r\n', 'utf-8');

      const result = await addToGitignore(testDir, '.auto-fix.yaml');

      expect(isSuccess(result)).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      // Should append with LF, preserving existing CRLF
      expect(content).toBe('node_modules/\r\n.env\r\n.auto-fix.yaml\n');
    });
  });
});
