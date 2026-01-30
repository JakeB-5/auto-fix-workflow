/**
 * @module commands/init/generators/__tests__/yaml-config.test
 * @description Tests for YAML config generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import {
  generateYamlConfig,
  writeYamlConfig,
  yamlConfigExists,
} from '../yaml-config.js';

describe('yaml-config', () => {
  describe('generateYamlConfig', () => {
    it('should generate valid YAML with default tokens', () => {
      const yaml = generateYamlConfig();

      expect(yaml).toContain('# 인증 토큰 (이 파일은 .gitignore에 추가됨)');
      expect(yaml).toContain('tokens:');
      expect(yaml).toContain('github: <token or empty>');
      expect(yaml).toContain('asana: <token or empty>');
    });

    it('should include GitHub token when provided', () => {
      const yaml = generateYamlConfig({ github: 'ghp_test123' });

      expect(yaml).toContain('github: ghp_test123');
    });

    it('should include Asana token when provided', () => {
      const yaml = generateYamlConfig({ asana: 'asana_test456' });

      expect(yaml).toContain('asana: asana_test456');
    });

    it('should include both tokens when provided', () => {
      const yaml = generateYamlConfig({
        github: 'ghp_test123',
        asana: 'asana_test456',
      });

      expect(yaml).toContain('github: ghp_test123');
      expect(yaml).toContain('asana: asana_test456');
    });

    it('should generate parseable YAML', () => {
      const yaml = generateYamlConfig();
      // Remove comment line for parsing
      const yamlContent = yaml
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');

      expect(() => yamlParse(yamlContent)).not.toThrow();
    });

    it('should include all required sections', () => {
      const yaml = generateYamlConfig();
      const yamlContent = yaml
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');
      const parsed = yamlParse(yamlContent);

      expect(parsed).toHaveProperty('tokens');
      expect(parsed).toHaveProperty('github');
      expect(parsed).toHaveProperty('asana');
      expect(parsed).toHaveProperty('checks');
      expect(parsed).toHaveProperty('worktree');
    });

    it('should include correct check order', () => {
      const yaml = generateYamlConfig();
      const yamlContent = yaml
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');
      const parsed = yamlParse(yamlContent);

      expect(parsed.checks.order).toEqual(['typecheck', 'lint', 'test']);
      expect(parsed.checks.timeout).toBe(300000);
      expect(parsed.checks.failFast).toBe(true);
    });

    it('should include correct worktree config', () => {
      const yaml = generateYamlConfig();
      const yamlContent = yaml
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');
      const parsed = yamlParse(yamlContent);

      expect(parsed.worktree.basePath).toBe('.worktrees');
      expect(parsed.worktree.maxParallel).toBe(3);
    });

    it('should include all GitHub labels', () => {
      const yaml = generateYamlConfig();
      const yamlContent = yaml
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');
      const parsed = yamlParse(yamlContent);

      expect(parsed.github.labels).toHaveProperty('autoFix');
      expect(parsed.github.labels).toHaveProperty('skip');
      expect(parsed.github.labels).toHaveProperty('failed');
      expect(parsed.github.labels).toHaveProperty('processing');
    });

    it('should include all Asana sections and tags', () => {
      const yaml = generateYamlConfig();
      const yamlContent = yaml
        .split('\n')
        .filter((line) => !line.startsWith('#'))
        .join('\n');
      const parsed = yamlParse(yamlContent);

      expect(parsed.asana.sections).toHaveProperty('triage');
      expect(parsed.asana.sections).toHaveProperty('needsInfo');
      expect(parsed.asana.sections).toHaveProperty('triaged');

      expect(parsed.asana.tags).toHaveProperty('triaged');
      expect(parsed.asana.tags).toHaveProperty('needsInfo');
      expect(parsed.asana.tags).toHaveProperty('cannotReproduce');
      expect(parsed.asana.tags).toHaveProperty('unclear');
      expect(parsed.asana.tags).toHaveProperty('needsContext');
      expect(parsed.asana.tags).toHaveProperty('skip');
    });
  });

  describe('writeYamlConfig', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(join(tmpdir(), 'yaml-config-test-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should write .auto-fix.yaml file', async () => {
      const result = await writeYamlConfig(testDir);

      expect(result.success).toBe(true);
      const exists = await yamlConfigExists(testDir);
      expect(exists).toBe(true);
    });

    it('should write file with correct content', async () => {
      const tokens = { github: 'ghp_test123', asana: 'asana_test456' };
      const result = await writeYamlConfig(testDir, tokens);

      expect(result.success).toBe(true);

      const configPath = join(testDir, '.auto-fix.yaml');
      const content = await fs.readFile(configPath, 'utf-8');

      expect(content).toContain('github: ghp_test123');
      expect(content).toContain('asana: asana_test456');
    });

    it('should handle write errors gracefully', async () => {
      // Try to write to invalid path
      const result = await writeYamlConfig('/invalid/path/that/does/not/exist');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(
          'Failed to write .auto-fix.yaml'
        );
      }
    });
  });

  describe('yamlConfigExists', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(join(tmpdir(), 'yaml-config-test-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should return false when file does not exist', async () => {
      const exists = await yamlConfigExists(testDir);
      expect(exists).toBe(false);
    });

    it('should return true when file exists', async () => {
      await writeYamlConfig(testDir);
      const exists = await yamlConfigExists(testDir);
      expect(exists).toBe(true);
    });
  });
});
