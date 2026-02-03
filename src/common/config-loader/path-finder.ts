/**
 * @module common/config-loader/path-finder
 * @description Find configuration file in directory hierarchy
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Result } from '../types/index.js';
import { ok, err } from '../types/index.js';
import { ConfigError } from './errors.js';

/**
 * Environment variable name for explicit config path
 */
export const CONFIG_ENV_VAR = 'AUTO_FIX_CONFIG';

/**
 * Default configuration file names (in priority order)
 */
export const CONFIG_FILE_NAMES = [
  '.auto-fix.yaml',
  '.auto-fix.yml',
  'auto-fix.yaml',
  'auto-fix.yml',
] as const;

/**
 * Options for finding config file
 */
export interface FindConfigOptions {
  /** Starting directory (defaults to cwd) */
  readonly startDir?: string;
  /** Whether to search parent directories */
  readonly searchParents?: boolean;
  /** Maximum directories to traverse up */
  readonly maxDepth?: number;
  /** Custom config file names to search for */
  readonly fileNames?: readonly string[];
  /** Whether to check AUTO_FIX_CONFIG env var (defaults to true) */
  readonly checkEnvVar?: boolean;
}

/**
 * Find configuration file in directory hierarchy
 *
 * Checks AUTO_FIX_CONFIG environment variable first, then searches
 * for config files in the directory hierarchy.
 *
 * @param options - Search options
 * @returns Result containing absolute path to config file or ConfigError
 */
export function findConfigFile(
  options: FindConfigOptions = {}
): Result<string, ConfigError> {
  const {
    startDir = process.cwd(),
    searchParents = true,
    maxDepth = 10,
    fileNames = CONFIG_FILE_NAMES,
    checkEnvVar = true,
  } = options;

  // Check AUTO_FIX_CONFIG environment variable first
  if (checkEnvVar) {
    const envConfigPath = process.env[CONFIG_ENV_VAR];
    if (envConfigPath) {
      const resolvedEnvPath = path.resolve(envConfigPath);
      if (fs.existsSync(resolvedEnvPath)) {
        try {
          const stat = fs.statSync(resolvedEnvPath);
          if (stat.isFile()) {
            return ok(resolvedEnvPath);
          }
        } catch {
          // Fall through to normal search
        }
      }
      // If env var is set but file doesn't exist, report it
      return err(ConfigError.notFound([resolvedEnvPath], process.cwd(), envConfigPath));
    }
  }

  const searchedPaths: string[] = [];
  let currentDir = path.resolve(startDir);
  let depth = 0;

  while (depth <= maxDepth) {
    // Search for each config file name in current directory
    for (const fileName of fileNames) {
      const filePath = path.join(currentDir, fileName);
      searchedPaths.push(filePath);

      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            return ok(filePath);
          }
        } catch {
          // Continue searching if stat fails
        }
      }
    }

    // Stop if we shouldn't search parents
    if (!searchParents) {
      break;
    }

    // Move to parent directory
    const parentDir = path.dirname(currentDir);

    // Stop if we've reached the root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  return err(ConfigError.notFound(searchedPaths, process.cwd()));
}

/**
 * Check if a specific config file exists
 *
 * @param filePath - Path to check
 * @returns True if file exists and is readable
 */
export function configFileExists(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Get the absolute path for a config file
 *
 * @param configPath - Config path (may be relative)
 * @param basePath - Base path for resolving relative paths
 * @returns Absolute path
 */
export function resolveConfigPath(
  configPath: string,
  basePath: string = process.cwd()
): string {
  if (path.isAbsolute(configPath)) {
    return configPath;
  }
  return path.resolve(basePath, configPath);
}

/**
 * Get the directory containing a config file
 *
 * @param configPath - Path to config file
 * @returns Directory path
 */
export function getConfigDir(configPath: string): string {
  return path.dirname(path.resolve(configPath));
}
