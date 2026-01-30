/**
 * @fileoverview Unit tests for MCP config generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateMcpConfig,
  mergeMcpConfig,
  readExistingMcpConfig,
  writeMcpConfig,
  mcpConfigExists,
} from '../mcp-config.js';

describe('mcp-config generator', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mcp-config-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateMcpConfig', () => {
    it('should generate valid MCP config structure', () => {
      const config = generateMcpConfig();

      expect(config).toHaveProperty('mcpServers');
      expect(config.mcpServers).toHaveProperty('auto-fix-workflow');
    });

    it('should use npx command', () => {
      const config = generateMcpConfig();

      expect(config.mcpServers['auto-fix-workflow'].command).toBe('npx');
    });

    it('should have auto-fix-workflow as first arg', () => {
      const config = generateMcpConfig();

      expect(config.mcpServers['auto-fix-workflow'].args).toEqual([
        'auto-fix-workflow',
      ]);
    });

    it('should have empty env object', () => {
      const config = generateMcpConfig();

      expect(config.mcpServers['auto-fix-workflow'].env).toEqual({});
    });

    it('should generate consistent config on multiple calls', () => {
      const config1 = generateMcpConfig();
      const config2 = generateMcpConfig();

      expect(config1).toEqual(config2);
    });
  });

  describe('readExistingMcpConfig', () => {
    it('should return null when file does not exist', async () => {
      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should read existing valid JSON config', async () => {
      const configPath = join(testDir, '.mcp.json');
      const existingConfig = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js'],
            env: {},
          },
        },
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(existingConfig);
      }
    });

    it('should handle empty JSON object', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, '{}', 'utf-8');

      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it('should return error for invalid JSON', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, 'invalid json{', 'utf-8');

      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain('Failed to parse existing .mcp.json');
      }
    });

    it('should return error for malformed JSON', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, '{"key": }', 'utf-8');

      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain('Failed to parse existing .mcp.json');
      }
    });

    it('should handle empty file', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, '', 'utf-8');

      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(false);
    });

    it('should handle file with only whitespace', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, '   \n\n  ', 'utf-8');

      const result = await readExistingMcpConfig(testDir);

      expect(result.success).toBe(false);
    });
  });

  describe('mergeMcpConfig', () => {
    it('should return new config when existing is null', () => {
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(null, newConfig);

      expect(merged).toEqual(newConfig);
    });

    it('should return new config when existing is not an object', () => {
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig('string' as any, newConfig);

      expect(merged).toEqual(newConfig);
    });

    it('should return new config when existing has no mcpServers', () => {
      const existing = { someOtherKey: 'value' };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing, newConfig);

      expect(merged).toEqual(newConfig);
    });

    it('should return new config when existing mcpServers is not an object', () => {
      const existing = { mcpServers: 'not an object' };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing as any, newConfig);

      expect(merged).toEqual(newConfig);
    });

    it('should merge configs preserving other servers', () => {
      const existing = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js'],
            env: { KEY: 'value' },
          },
        },
      };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing, newConfig);

      expect(merged.mcpServers).toHaveProperty('other-server');
      expect(merged.mcpServers).toHaveProperty('auto-fix-workflow');
      expect(merged.mcpServers['other-server']).toEqual(
        existing.mcpServers['other-server']
      );
    });

    it('should overwrite auto-fix-workflow server if exists', () => {
      const existing = {
        mcpServers: {
          'auto-fix-workflow': {
            command: 'old-command',
            args: ['old-arg'],
            env: { OLD: 'value' },
          },
        },
      };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing, newConfig);

      expect(merged.mcpServers['auto-fix-workflow']).toEqual(
        newConfig.mcpServers['auto-fix-workflow']
      );
      expect(merged.mcpServers['auto-fix-workflow'].command).toBe('npx');
    });

    it('should merge multiple existing servers', () => {
      const existing = {
        mcpServers: {
          'server1': { command: 'cmd1', args: [], env: {} },
          'server2': { command: 'cmd2', args: [], env: {} },
          'server3': { command: 'cmd3', args: [], env: {} },
        },
      };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing, newConfig);

      expect(Object.keys(merged.mcpServers)).toHaveLength(4);
      expect(merged.mcpServers).toHaveProperty('server1');
      expect(merged.mcpServers).toHaveProperty('server2');
      expect(merged.mcpServers).toHaveProperty('server3');
      expect(merged.mcpServers).toHaveProperty('auto-fix-workflow');
    });

    it('should preserve order with auto-fix-workflow last', () => {
      const existing = {
        mcpServers: {
          'alpha': { command: 'a', args: [], env: {} },
          'beta': { command: 'b', args: [], env: {} },
        },
      };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing, newConfig);

      const keys = Object.keys(merged.mcpServers);
      expect(keys).toEqual(['alpha', 'beta', 'auto-fix-workflow']);
    });

    it('should handle empty existing mcpServers', () => {
      const existing = { mcpServers: {} };
      const newConfig = generateMcpConfig();
      const merged = mergeMcpConfig(existing, newConfig);

      expect(merged.mcpServers).toHaveProperty('auto-fix-workflow');
      expect(Object.keys(merged.mcpServers)).toHaveLength(1);
    });
  });

  describe('writeMcpConfig', () => {
    it('should create new .mcp.json file', async () => {
      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);

      const configPath = join(testDir, '.mcp.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('mcpServers');
      expect(parsed.mcpServers).toHaveProperty('auto-fix-workflow');
    });

    it('should write pretty-formatted JSON', async () => {
      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);

      const configPath = join(testDir, '.mcp.json');
      const content = await fs.readFile(configPath, 'utf-8');

      // Should have indentation
      expect(content).toContain('  ');
      // Should have newlines
      expect(content.split('\n').length).toBeGreaterThan(1);
      // Should end with newline
      expect(content.endsWith('\n')).toBe(true);
    });

    it('should merge with existing config', async () => {
      const configPath = join(testDir, '.mcp.json');
      const existingConfig = {
        mcpServers: {
          'other-server': {
            command: 'node',
            args: ['other.js'],
            env: {},
          },
        },
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);

      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.mcpServers).toHaveProperty('other-server');
      expect(parsed.mcpServers).toHaveProperty('auto-fix-workflow');
    });

    it('should overwrite existing auto-fix-workflow config', async () => {
      const configPath = join(testDir, '.mcp.json');
      const existingConfig = {
        mcpServers: {
          'auto-fix-workflow': {
            command: 'old-command',
            args: ['old-arg'],
            env: { OLD: 'value' },
          },
        },
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);

      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.mcpServers['auto-fix-workflow'].command).toBe('npx');
      expect(parsed.mcpServers['auto-fix-workflow'].args).toEqual([
        'auto-fix-workflow',
      ]);
    });

    it('should handle invalid existing config gracefully', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, 'invalid json', 'utf-8');

      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain('Failed to parse');
      }
    });

    it('should return error for invalid path', async () => {
      const invalidPath = join(testDir, 'nonexistent', 'deep', 'path');
      const result = await writeMcpConfig(invalidPath);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error.message).toContain('Failed to');
      }
    });

    it('should create valid JSON parseable by JSON.parse', async () => {
      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);

      const configPath = join(testDir, '.mcp.json');
      const content = await fs.readFile(configPath, 'utf-8');

      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('mcpConfigExists', () => {
    it('should return false when file does not exist', async () => {
      const exists = await mcpConfigExists(testDir);
      expect(exists).toBe(false);
    });

    it('should return true when file exists', async () => {
      await writeMcpConfig(testDir);
      const exists = await mcpConfigExists(testDir);
      expect(exists).toBe(true);
    });

    it('should return true for empty file', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, '', 'utf-8');

      const exists = await mcpConfigExists(testDir);
      expect(exists).toBe(true);
    });

    it('should return true for invalid JSON file', async () => {
      const configPath = join(testDir, '.mcp.json');
      await fs.writeFile(configPath, 'invalid json', 'utf-8');

      const exists = await mcpConfigExists(testDir);
      expect(exists).toBe(true);
    });

    it('should handle permission errors', async () => {
      // On Windows, we can't easily test permission errors
      // Just verify it doesn't throw
      const exists = await mcpConfigExists('/root/nonexistent');
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent writes', async () => {
      const promises = [
        writeMcpConfig(testDir),
        writeMcpConfig(testDir),
        writeMcpConfig(testDir),
      ];

      const results = await Promise.all(promises);

      // At least one should succeed
      const successes = results.filter((r) => r.success);
      expect(successes.length).toBeGreaterThan(0);

      // Final state should be valid
      const exists = await mcpConfigExists(testDir);
      expect(exists).toBe(true);
    });

    it('should handle very long server names', async () => {
      const configPath = join(testDir, '.mcp.json');
      const longName = 'a'.repeat(1000);
      const existingConfig = {
        mcpServers: {
          [longName]: { command: 'cmd', args: [], env: {} },
        },
      };

      await fs.writeFile(configPath, JSON.stringify(existingConfig), 'utf-8');

      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);
    });

    it('should preserve JSON structure integrity', async () => {
      const configPath = join(testDir, '.mcp.json');
      const complexConfig = {
        mcpServers: {
          'server1': {
            command: 'cmd',
            args: ['arg1', 'arg2', 'arg3'],
            env: {
              KEY1: 'value1',
              KEY2: 'value2',
              NESTED: JSON.stringify({ nested: 'object' }),
            },
          },
        },
      };

      await fs.writeFile(configPath, JSON.stringify(complexConfig, null, 2), 'utf-8');

      const result = await writeMcpConfig(testDir);

      expect(result.success).toBe(true);

      const content = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Original server should be preserved exactly
      expect(parsed.mcpServers['server1']).toEqual(complexConfig.mcpServers['server1']);
    });
  });
});
