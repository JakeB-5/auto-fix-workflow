/**
 * @module common/config-loader/defaults
 * @description Default configuration values
 */

import type {
  GitHubConfig,
  AsanaConfig,
  WorktreeConfig,
  ChecksConfig,
  LoggingConfig,
} from '../types/index.js';

/**
 * Default GitHub configuration values
 */
export const DEFAULT_GITHUB_CONFIG: Partial<GitHubConfig> = {
  apiBaseUrl: 'https://api.github.com',
  defaultBranch: 'main',
  autoFixLabel: 'auto-fix',
  skipLabel: 'auto-fix-skip',
} as const;

/**
 * Default Asana configuration values
 */
export const DEFAULT_ASANA_CONFIG: Partial<AsanaConfig> = {
  triageSection: 'Triage',
  doneSection: 'Done',
  syncedTag: 'github-synced',
} as const;

/**
 * Default Worktree configuration values
 */
export const DEFAULT_WORKTREE_CONFIG: Partial<WorktreeConfig> = {
  maxConcurrent: 3,
  autoCleanupMinutes: 60,
  prefix: 'autofix-',
} as const;

/**
 * Default Checks configuration values
 * Note: Command defaults are intentionally NOT set here.
 * The run-checks tool will detect available scripts at runtime.
 */
export const DEFAULT_CHECKS_CONFIG: Partial<ChecksConfig> = {
  testTimeout: 300000,     // 5 minutes for tests
  typeCheckTimeout: 60000, // 1 minute for type check
  lintTimeout: 120000,     // 2 minutes for lint
  maxRetries: 3,
} as const;

/**
 * Default Logging configuration values
 */
export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: 'info',
  pretty: false,
  redact: true,
} as const;

/**
 * Apply default values to a partial GitHub config
 */
export function applyGitHubDefaults(
  config: Partial<GitHubConfig>
): Partial<GitHubConfig> {
  return {
    ...DEFAULT_GITHUB_CONFIG,
    ...config,
  };
}

/**
 * Apply default values to a partial Asana config
 */
export function applyAsanaDefaults(
  config: Partial<AsanaConfig>
): Partial<AsanaConfig> {
  return {
    ...DEFAULT_ASANA_CONFIG,
    ...config,
  };
}

/**
 * Apply default values to a partial Worktree config
 */
export function applyWorktreeDefaults(
  config: Partial<WorktreeConfig>
): Partial<WorktreeConfig> {
  return {
    ...DEFAULT_WORKTREE_CONFIG,
    ...config,
  };
}

/**
 * Apply default values to a partial Checks config
 */
export function applyChecksDefaults(
  config?: Partial<ChecksConfig>
): Partial<ChecksConfig> {
  return {
    ...DEFAULT_CHECKS_CONFIG,
    ...config,
  };
}

/**
 * Apply default values to a partial Logging config
 */
export function applyLoggingDefaults(
  config?: Partial<LoggingConfig>
): LoggingConfig {
  return {
    ...DEFAULT_LOGGING_CONFIG,
    ...config,
  };
}
