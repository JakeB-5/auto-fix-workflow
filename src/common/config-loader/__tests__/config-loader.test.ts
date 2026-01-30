/**
 * @module common/config-loader/__tests__/config-loader.test
 * @description Unit and integration tests for config-loader module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { isSuccess, isFailure } from '../../types/index.js';

// Import module under test
import {
  loadConfig,
  loadConfigSync,
  clearConfigCache,
  getCachedConfig,
  reloadConfig,
  ConfigError,
  parseYamlConfig,
  getEnvOverrides,
  mergeWithEnvOverrides,
  validateConfig,
  findConfigFile,
  configFileExists,
  CONFIG_FILE_NAMES,
  DEFAULT_CHECKS_CONFIG,
  DEFAULT_LOGGING_CONFIG,
} from '../index.js';

// Mock fs modules
vi.mock('node:fs/promises');
vi.mock('node:fs');

describe('config-loader', () => {
  beforeEach(() => {
    clearConfigCache();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ConfigError', () => {
    it('should create a not found error', () => {
      const error = ConfigError.notFound(['/path/to/config.yaml']);
      expect(error.code).toBe('CONFIG_NOT_FOUND');
      expect(error.message).toContain('/path/to/config.yaml');
      expect(error.details?.searchedPaths).toContain('/path/to/config.yaml');
    });

    it('should create a parse error', () => {
      const cause = new Error('Invalid YAML');
      const error = ConfigError.parseError('/path/to/config.yaml', cause);
      expect(error.code).toBe('CONFIG_PARSE_ERROR');
      expect(error.path).toBe('/path/to/config.yaml');
      expect(error.cause).toBe(cause);
    });

    it('should create a validation error', () => {
      const issues = [{ path: 'github.token', message: 'Required' }];
      const error = ConfigError.validationError('/path/to/config.yaml', issues);
      expect(error.code).toBe('CONFIG_VALIDATION_ERROR');
      expect(error.message).toContain('github.token');
      expect(error.details?.issues).toEqual(issues);
    });

    it('should create a read error', () => {
      const cause = new Error('ENOENT');
      const error = ConfigError.readError('/path/to/config.yaml', cause);
      expect(error.code).toBe('CONFIG_READ_ERROR');
      expect(error.path).toBe('/path/to/config.yaml');
    });
  });

  describe('parseYamlConfig', () => {
    it('should parse valid YAML', () => {
      const yaml = `
github:
  token: test-token
  owner: test-owner
  repo: test-repo
`;
      const result = parseYamlConfig(yaml);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({
          github: {
            token: 'test-token',
            owner: 'test-owner',
            repo: 'test-repo',
          },
        });
      }
    });

    it('should reject empty content', () => {
      const result = parseYamlConfig('');
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('CONFIG_PARSE_ERROR');
      }
    });

    it('should reject array content', () => {
      const result = parseYamlConfig('- item1\n- item2');
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('CONFIG_PARSE_ERROR');
      }
    });

    it('should handle YAML syntax errors', () => {
      const yaml = `
github:
  token: "unclosed string
`;
      const result = parseYamlConfig(yaml, '/test/config.yaml');
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('CONFIG_PARSE_ERROR');
      }
    });
  });

  describe('getEnvOverrides', () => {
    it('should extract GitHub token from env', () => {
      const env = { GITHUB_TOKEN: 'env-token' };
      const result = getEnvOverrides(env);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.github?.token).toBe('env-token');
      }
    });

    it('should extract AUTO_FIX prefixed vars', () => {
      const env = {
        AUTO_FIX_GITHUB_OWNER: 'env-owner',
        AUTO_FIX_ASANA_TOKEN: 'asana-token',
      };
      const result = getEnvOverrides(env);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.github?.owner).toBe('env-owner');
        expect(result.data.asana?.token).toBe('asana-token');
      }
    });

    it('should parse numeric values', () => {
      const env = {
        AUTO_FIX_WORKTREE_MAX_CONCURRENT: '5',
        AUTO_FIX_CHECKS_TEST_TIMEOUT: '600',
      };
      const result = getEnvOverrides(env);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.worktree?.maxConcurrent).toBe(5);
        expect(result.data.checks?.testTimeout).toBe(600);
      }
    });

    it('should parse boolean values', () => {
      const env = {
        AUTO_FIX_LOGGING_PRETTY: 'true',
        AUTO_FIX_LOGGING_REDACT: 'false',
      };
      const result = getEnvOverrides(env);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.logging?.pretty).toBe(true);
        expect(result.data.logging?.redact).toBe(false);
      }
    });

    it('should parse array values (comma-separated)', () => {
      const env = {
        AUTO_FIX_ASANA_PROJECT_GIDS: 'gid1,gid2,gid3',
      };
      const result = getEnvOverrides(env);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.asana?.projectGids).toEqual(['gid1', 'gid2', 'gid3']);
      }
    });

    it('should ignore empty values', () => {
      const env = {
        GITHUB_TOKEN: '',
        AUTO_FIX_GITHUB_OWNER: undefined,
      };
      const result = getEnvOverrides(env);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.github).toBeUndefined();
      }
    });
  });

  describe('mergeWithEnvOverrides', () => {
    it('should merge env overrides into base config', () => {
      const base = {
        github: { token: 'base-token', owner: 'base-owner', repo: 'repo' },
      };
      const overrides = {
        github: { token: 'env-token' },
      };
      const result = mergeWithEnvOverrides(base, overrides);
      expect(result.github.token).toBe('env-token');
      expect(result.github.owner).toBe('base-owner');
    });

    it('should add new sections from overrides', () => {
      const base = {
        github: { token: 'token', owner: 'owner', repo: 'repo' },
      };
      const overrides = {
        logging: { level: 'debug' as const },
      };
      const result = mergeWithEnvOverrides(base, overrides);
      expect(result.logging).toEqual({ level: 'debug' });
    });
  });

  describe('validateConfig', () => {
    const validConfig = {
      github: {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
      asana: {
        token: 'asana-token',
        workspaceGid: 'workspace-gid',
        projectGids: ['project-1'],
      },
      worktree: {
        baseDir: '/tmp/worktrees',
      },
    };

    it('should validate a complete config', () => {
      const result = validateConfig(validConfig);
      expect(isSuccess(result)).toBe(true);
    });

    it('should apply default values', () => {
      const result = validateConfig(validConfig);
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.checks).toEqual(DEFAULT_CHECKS_CONFIG);
        expect(result.data.logging).toEqual(DEFAULT_LOGGING_CONFIG);
      }
    });

    it('should reject missing required fields', () => {
      const invalid = {
        github: { token: 'token' }, // missing owner and repo
        asana: {
          token: 'token',
          workspaceGid: 'gid',
          projectGids: ['p1'],
        },
        worktree: { baseDir: '/tmp' },
      };
      const result = validateConfig(invalid);
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('CONFIG_VALIDATION_ERROR');
      }
    });

    it('should reject invalid log level', () => {
      const invalid = {
        ...validConfig,
        logging: { level: 'invalid' },
      };
      const result = validateConfig(invalid);
      expect(isFailure(result)).toBe(true);
    });
  });

  describe('findConfigFile', () => {
    it('should find config file in current directory', () => {
      vi.mocked(fsSync.existsSync).mockImplementation((p) => {
        return String(p).endsWith('.auto-fix.yaml');
      });
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => true } as fsSync.Stats);

      const result = findConfigFile({ startDir: '/project', searchParents: false });
      expect(isSuccess(result)).toBe(true);
    });

    it('should search parent directories', () => {
      const parentDir = path.resolve('/parent');
      const childDir = path.join(parentDir, 'child');
      const targetFile = path.join(parentDir, '.auto-fix.yaml');

      vi.mocked(fsSync.existsSync).mockImplementation((p) => {
        return String(p) === targetFile;
      });
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => true } as fsSync.Stats);

      const result = findConfigFile({ startDir: childDir, searchParents: true });
      expect(isSuccess(result)).toBe(true);
    });

    it('should return error if not found', () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);

      const result = findConfigFile({ startDir: '/project', maxDepth: 2 });
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('CONFIG_NOT_FOUND');
      }
    });
  });

  describe('configFileExists', () => {
    it('should return true for existing file', () => {
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => true } as fsSync.Stats);
      expect(configFileExists('/path/to/config.yaml')).toBe(true);
    });

    it('should return false for non-existent file', () => {
      vi.mocked(fsSync.statSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(configFileExists('/path/to/nonexistent.yaml')).toBe(false);
    });

    it('should return false for directory', () => {
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => false } as fsSync.Stats);
      expect(configFileExists('/path/to/directory')).toBe(false);
    });
  });

  describe('loadConfig', () => {
    const validYaml = `
github:
  token: test-token
  owner: test-owner
  repo: test-repo
asana:
  token: asana-token
  workspaceGid: workspace-gid
  projectGids:
    - project-1
worktree:
  baseDir: /tmp/worktrees
`;

    beforeEach(() => {
      vi.mocked(fsSync.existsSync).mockImplementation((p) => {
        return String(p).endsWith('.auto-fix.yaml');
      });
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => true } as fsSync.Stats);
      vi.mocked(fs.readFile).mockResolvedValue(validYaml);
    });

    it('should load and validate config', async () => {
      const result = await loadConfig({ startDir: '/project' });
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.github.token).toBe('test-token');
        expect(result.data.github.owner).toBe('test-owner');
      }
    });

    it('should cache loaded config', async () => {
      await loadConfig({ startDir: '/project' });
      const cached = getCachedConfig();
      expect(cached).not.toBeNull();
      expect(cached?.github.token).toBe('test-token');
    });

    it('should use cache on subsequent loads', async () => {
      await loadConfig({ startDir: '/project' });
      await loadConfig({ startDir: '/project' });
      // readFile should only be called once due to caching
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when useCache is false', async () => {
      await loadConfig({ startDir: '/project' });
      await loadConfig({ startDir: '/project', useCache: false });
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should apply env overrides', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, GITHUB_TOKEN: 'env-override-token' };

      try {
        clearConfigCache();
        const result = await loadConfig({ startDir: '/project' });
        expect(isSuccess(result)).toBe(true);
        if (isSuccess(result)) {
          expect(result.data.github.token).toBe('env-override-token');
        }
      } finally {
        process.env = originalEnv;
      }
    });

    it('should skip env overrides when disabled', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, GITHUB_TOKEN: 'env-override-token' };

      try {
        clearConfigCache();
        const result = await loadConfig({ startDir: '/project', applyEnvOverrides: false });
        expect(isSuccess(result)).toBe(true);
        if (isSuccess(result)) {
          expect(result.data.github.token).toBe('test-token');
        }
      } finally {
        process.env = originalEnv;
      }
    });

    it('should load from explicit path', async () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      const result = await loadConfig({ configPath: '/custom/path/config.yaml' });
      expect(isSuccess(result)).toBe(true);
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));
      clearConfigCache();
      const result = await loadConfig({ startDir: '/project' });
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('CONFIG_READ_ERROR');
      }
    });
  });

  describe('loadConfigSync', () => {
    const validYaml = `
github:
  token: sync-token
  owner: sync-owner
  repo: sync-repo
asana:
  token: asana-token
  workspaceGid: workspace-gid
  projectGids:
    - project-1
worktree:
  baseDir: /tmp/worktrees
`;

    beforeEach(() => {
      vi.mocked(fsSync.existsSync).mockImplementation((p) => {
        return String(p).endsWith('.auto-fix.yaml');
      });
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => true } as fsSync.Stats);
      vi.mocked(fsSync.readFileSync).mockReturnValue(validYaml);
    });

    it('should load config synchronously', () => {
      const result = loadConfigSync({ startDir: '/project' });
      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.github.token).toBe('sync-token');
      }
    });
  });

  describe('reloadConfig', () => {
    it('should clear cache and reload', async () => {
      const yaml1 = `
github:
  token: token-1
  owner: owner
  repo: repo
asana:
  token: asana-token
  workspaceGid: gid
  projectGids: [p1]
worktree:
  baseDir: /tmp
`;
      const yaml2 = `
github:
  token: token-2
  owner: owner
  repo: repo
asana:
  token: asana-token
  workspaceGid: gid
  projectGids: [p1]
worktree:
  baseDir: /tmp
`;
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      vi.mocked(fsSync.statSync).mockReturnValue({ isFile: () => true } as fsSync.Stats);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(yaml1)
        .mockResolvedValueOnce(yaml2);

      await loadConfig({ startDir: '/project' });
      const result = await reloadConfig({ startDir: '/project' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.github.token).toBe('token-2');
      }
    });
  });

  describe('CONFIG_FILE_NAMES', () => {
    it('should include expected file names', () => {
      expect(CONFIG_FILE_NAMES).toContain('.auto-fix.yaml');
      expect(CONFIG_FILE_NAMES).toContain('.auto-fix.yml');
      expect(CONFIG_FILE_NAMES).toContain('auto-fix.yaml');
      expect(CONFIG_FILE_NAMES).toContain('auto-fix.yml');
    });
  });
});
