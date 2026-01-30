/**
 * @module common/config-loader/loader
 * @description Main configuration loader with caching
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import type { Config } from '../types/index.js';
import type { Result } from '../types/index.js';
import { ok, err, isSuccess } from '../types/index.js';
import { ConfigError } from './errors.js';
import { parseYamlConfig } from './yaml-parser.js';
import { getEnvOverrides, mergeWithEnvOverrides } from './env-override.js';
import { validateConfig } from './validator.js';
import { findConfigFile, resolveConfigPath, configFileExists } from './path-finder.js';

/**
 * Cached configuration data
 */
interface CachedConfig {
  readonly config: Config;
  readonly path: string;
  readonly loadedAt: number;
}

/**
 * Module-level cache for loaded configuration
 */
let configCache: CachedConfig | null = null;

/**
 * Options for loading configuration
 */
export interface LoadConfigOptions {
  /** Explicit path to config file */
  readonly configPath?: string;
  /** Whether to use cached config if available */
  readonly useCache?: boolean;
  /** Whether to apply environment variable overrides */
  readonly applyEnvOverrides?: boolean;
  /** Starting directory for config search */
  readonly startDir?: string;
}

/**
 * Load configuration from file with environment overrides
 *
 * @param options - Loading options
 * @returns Result containing Config or ConfigError
 */
export async function loadConfig(
  options: LoadConfigOptions = {}
): Promise<Result<Config, ConfigError>> {
  const {
    configPath,
    useCache = true,
    applyEnvOverrides = true,
    startDir,
  } = options;

  // Check cache first
  if (useCache && configCache) {
    // If explicit path matches or no explicit path given
    if (!configPath || configCache.path === resolveConfigPath(configPath)) {
      return ok(configCache.config);
    }
  }

  // Find or resolve config path
  let resolvedPath: string;

  if (configPath) {
    resolvedPath = resolveConfigPath(configPath);
    if (!configFileExists(resolvedPath)) {
      return err(ConfigError.notFound([resolvedPath]));
    }
  } else {
    const findOptions = startDir !== undefined ? { startDir } : {};
    const findResult = findConfigFile(findOptions);
    if (!isSuccess(findResult)) {
      return findResult;
    }
    resolvedPath = findResult.data;
  }

  // Read file content
  let content: string;
  try {
    content = await fs.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    return err(
      ConfigError.readError(
        resolvedPath,
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }

  // Parse YAML
  const parseResult = parseYamlConfig(content, resolvedPath);
  if (!isSuccess(parseResult)) {
    return parseResult;
  }

  let configData = parseResult.data as Record<string, unknown>;

  // Apply environment overrides
  if (applyEnvOverrides) {
    const envResult = getEnvOverrides();
    if (isSuccess(envResult)) {
      configData = mergeWithEnvOverrides(configData, envResult.data);
    }
  }

  // Validate configuration
  const validationResult = validateConfig(configData, resolvedPath);
  if (!isSuccess(validationResult)) {
    return validationResult;
  }

  // Update cache
  configCache = {
    config: validationResult.data,
    path: resolvedPath,
    loadedAt: Date.now(),
  };

  return ok(validationResult.data);
}

/**
 * Load configuration synchronously (for initialization)
 *
 * @param options - Loading options
 * @returns Result containing Config or ConfigError
 */
export function loadConfigSync(
  options: LoadConfigOptions = {}
): Result<Config, ConfigError> {
  const {
    configPath,
    useCache = true,
    applyEnvOverrides = true,
    startDir,
  } = options;

  // Check cache first
  if (useCache && configCache) {
    if (!configPath || configCache.path === resolveConfigPath(configPath)) {
      return ok(configCache.config);
    }
  }

  // Find or resolve config path
  let resolvedPath: string;

  if (configPath) {
    resolvedPath = resolveConfigPath(configPath);
    if (!configFileExists(resolvedPath)) {
      return err(ConfigError.notFound([resolvedPath]));
    }
  } else {
    const findOptions = startDir !== undefined ? { startDir } : {};
    const findResult = findConfigFile(findOptions);
    if (!isSuccess(findResult)) {
      return findResult;
    }
    resolvedPath = findResult.data;
  }

  // Read file content synchronously
  let content: string;
  try {
    content = fsSync.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    return err(
      ConfigError.readError(
        resolvedPath,
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }

  // Parse YAML
  const parseResult = parseYamlConfig(content, resolvedPath);
  if (!isSuccess(parseResult)) {
    return parseResult;
  }

  let configData = parseResult.data as Record<string, unknown>;

  // Apply environment overrides
  if (applyEnvOverrides) {
    const envResult = getEnvOverrides();
    if (isSuccess(envResult)) {
      configData = mergeWithEnvOverrides(configData, envResult.data);
    }
  }

  // Validate configuration
  const validationResult = validateConfig(configData, resolvedPath);
  if (!isSuccess(validationResult)) {
    return validationResult;
  }

  // Update cache
  configCache = {
    config: validationResult.data,
    path: resolvedPath,
    loadedAt: Date.now(),
  };

  return ok(validationResult.data);
}

/**
 * Clear the configuration cache
 */
export function clearConfigCache(): void {
  configCache = null;
}

/**
 * Get the cached configuration without loading
 *
 * @returns Cached config or null if not loaded
 */
export function getCachedConfig(): Config | null {
  return configCache?.config ?? null;
}

/**
 * Get information about the cached configuration
 *
 * @returns Cache info or null if not loaded
 */
export function getConfigCacheInfo(): { path: string; loadedAt: Date } | null {
  if (!configCache) {
    return null;
  }
  return {
    path: configCache.path,
    loadedAt: new Date(configCache.loadedAt),
  };
}

/**
 * Reload configuration, ignoring cache
 *
 * @param options - Loading options (useCache is forced to false)
 * @returns Result containing Config or ConfigError
 */
export async function reloadConfig(
  options: Omit<LoadConfigOptions, 'useCache'> = {}
): Promise<Result<Config, ConfigError>> {
  clearConfigCache();
  return loadConfig({ ...options, useCache: false });
}
