/**
 * @module common/config-loader/env-override
 * @description Environment variable overrides for configuration
 */

import type { PartialConfig } from '../types/index.js';
import type { Result } from '../types/index.js';
import { ok } from '../types/index.js';

/**
 * Environment variable prefix for auto-fix configuration
 */
const ENV_PREFIX = 'AUTO_FIX';

/**
 * Environment variable mappings
 * Maps ENV_VAR_NAME to config path
 */
const ENV_MAPPINGS: Record<string, { section: keyof PartialConfig; key: string }> = {
  // GitHub
  'GITHUB_TOKEN': { section: 'github', key: 'token' },
  'AUTO_FIX_GITHUB_TOKEN': { section: 'github', key: 'token' },
  'AUTO_FIX_GITHUB_OWNER': { section: 'github', key: 'owner' },
  'AUTO_FIX_GITHUB_REPO': { section: 'github', key: 'repo' },
  'AUTO_FIX_GITHUB_API_BASE_URL': { section: 'github', key: 'apiBaseUrl' },
  'AUTO_FIX_GITHUB_DEFAULT_BRANCH': { section: 'github', key: 'defaultBranch' },
  'AUTO_FIX_GITHUB_AUTO_FIX_LABEL': { section: 'github', key: 'autoFixLabel' },
  'AUTO_FIX_GITHUB_SKIP_LABEL': { section: 'github', key: 'skipLabel' },

  // Asana
  'ASANA_TOKEN': { section: 'asana', key: 'token' },
  'AUTO_FIX_ASANA_TOKEN': { section: 'asana', key: 'token' },
  'AUTO_FIX_ASANA_WORKSPACE_GID': { section: 'asana', key: 'workspaceGid' },
  'AUTO_FIX_ASANA_PROJECT_GIDS': { section: 'asana', key: 'projectGids' },
  'AUTO_FIX_ASANA_TRIAGE_SECTION': { section: 'asana', key: 'triageSection' },
  'AUTO_FIX_ASANA_DONE_SECTION': { section: 'asana', key: 'doneSection' },
  'AUTO_FIX_ASANA_SYNCED_TAG': { section: 'asana', key: 'syncedTag' },

  // Sentry
  'SENTRY_DSN': { section: 'sentry', key: 'dsn' },
  'AUTO_FIX_SENTRY_DSN': { section: 'sentry', key: 'dsn' },
  'AUTO_FIX_SENTRY_ORGANIZATION': { section: 'sentry', key: 'organization' },
  'AUTO_FIX_SENTRY_PROJECT': { section: 'sentry', key: 'project' },
  'AUTO_FIX_SENTRY_WEBHOOK_SECRET': { section: 'sentry', key: 'webhookSecret' },

  // Worktree
  'AUTO_FIX_WORKTREE_BASE_DIR': { section: 'worktree', key: 'baseDir' },
  'AUTO_FIX_WORKTREE_MAX_CONCURRENT': { section: 'worktree', key: 'maxConcurrent' },
  'AUTO_FIX_WORKTREE_AUTO_CLEANUP_MINUTES': { section: 'worktree', key: 'autoCleanupMinutes' },
  'AUTO_FIX_WORKTREE_PREFIX': { section: 'worktree', key: 'prefix' },

  // Checks
  'AUTO_FIX_CHECKS_TEST_COMMAND': { section: 'checks', key: 'testCommand' },
  'AUTO_FIX_CHECKS_TYPE_CHECK_COMMAND': { section: 'checks', key: 'typeCheckCommand' },
  'AUTO_FIX_CHECKS_LINT_COMMAND': { section: 'checks', key: 'lintCommand' },
  'AUTO_FIX_CHECKS_TEST_TIMEOUT': { section: 'checks', key: 'testTimeout' },
  'AUTO_FIX_CHECKS_TYPE_CHECK_TIMEOUT': { section: 'checks', key: 'typeCheckTimeout' },
  'AUTO_FIX_CHECKS_LINT_TIMEOUT': { section: 'checks', key: 'lintTimeout' },
  'AUTO_FIX_CHECKS_MAX_RETRIES': { section: 'checks', key: 'maxRetries' },

  // Logging
  'AUTO_FIX_LOGGING_LEVEL': { section: 'logging', key: 'level' },
  'AUTO_FIX_LOGGING_PRETTY': { section: 'logging', key: 'pretty' },
  'AUTO_FIX_LOGGING_FILE_PATH': { section: 'logging', key: 'filePath' },
  'AUTO_FIX_LOGGING_REDACT': { section: 'logging', key: 'redact' },
};

/**
 * Keys that should be parsed as numbers
 */
const NUMBER_KEYS = new Set([
  'maxConcurrent',
  'autoCleanupMinutes',
  'testTimeout',
  'typeCheckTimeout',
  'lintTimeout',
  'maxRetries',
]);

/**
 * Keys that should be parsed as booleans
 */
const BOOLEAN_KEYS = new Set(['pretty', 'redact']);

/**
 * Keys that should be parsed as arrays (comma-separated)
 */
const ARRAY_KEYS = new Set(['projectGids']);

/**
 * Parse a string value to the appropriate type
 */
function parseEnvValue(key: string, value: string): unknown {
  if (NUMBER_KEYS.has(key)) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`Invalid number value for ${key}: ${value}`);
    }
    return num;
  }

  if (BOOLEAN_KEYS.has(key)) {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
    throw new Error(`Invalid boolean value for ${key}: ${value}`);
  }

  if (ARRAY_KEYS.has(key)) {
    return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }

  return value;
}

/**
 * Get environment variable overrides as a partial config
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns Result containing partial config from environment
 */
export function getEnvOverrides(
  env: Record<string, string | undefined> = process.env
): Result<PartialConfig, never> {
  const overrides: Record<string, Record<string, unknown>> = {};

  for (const [envKey, mapping] of Object.entries(ENV_MAPPINGS)) {
    const value = env[envKey];
    if (value !== undefined && value !== '') {
      // Initialize section if needed
      if (!overrides[mapping.section]) {
        overrides[mapping.section] = {};
      }

      try {
        overrides[mapping.section]![mapping.key] = parseEnvValue(mapping.key, value);
      } catch {
        // Skip invalid values silently - validation will catch them later
        continue;
      }
    }
  }

  return ok(overrides as PartialConfig);
}

/**
 * Merge base config with environment overrides
 *
 * @param baseConfig - Base configuration object
 * @param overrides - Environment overrides
 * @returns Merged configuration
 */
export function mergeWithEnvOverrides<T extends Record<string, unknown>>(
  baseConfig: T,
  overrides: PartialConfig
): T {
  const result = { ...baseConfig } as Record<string, unknown>;

  for (const [section, sectionOverrides] of Object.entries(overrides)) {
    if (sectionOverrides && typeof sectionOverrides === 'object') {
      const baseSection = result[section];
      if (baseSection && typeof baseSection === 'object') {
        result[section] = {
          ...baseSection,
          ...sectionOverrides,
        };
      } else {
        result[section] = sectionOverrides;
      }
    }
  }

  return result as T;
}

/**
 * Get the list of supported environment variables
 *
 * @returns Array of environment variable names
 */
export function getSupportedEnvVars(): string[] {
  return Object.keys(ENV_MAPPINGS).sort();
}
