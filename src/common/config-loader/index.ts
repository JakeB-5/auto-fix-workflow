/**
 * @module common/config-loader
 * @description Configuration loader module public API
 */

// Main loader functions
export {
  loadConfig,
  loadConfigSync,
  clearConfigCache,
  getCachedConfig,
  getConfigCacheInfo,
  reloadConfig,
  type LoadConfigOptions,
} from './loader.js';

// Error handling
export { ConfigError, type ConfigErrorCode } from './errors.js';

// Schemas for external validation
export {
  GitHubConfigSchema,
  AsanaConfigSchema,
  SentryConfigSchema,
  WorktreeConfigSchema,
  ChecksConfigSchema,
  LoggingConfigSchema,
  ConfigSchema,
  PartialConfigSchema,
  LogLevelSchema,
  type GitHubConfigInput,
  type AsanaConfigInput,
  type SentryConfigInput,
  type WorktreeConfigInput,
  type ChecksConfigInput,
  type LoggingConfigInput,
  type ConfigInput,
  type PartialConfigInput,
} from './schema.js';

// YAML parsing utilities
export { parseYamlConfig, stringifyYamlConfig } from './yaml-parser.js';

// Environment variable handling
export {
  getEnvOverrides,
  mergeWithEnvOverrides,
  getSupportedEnvVars,
} from './env-override.js';

// Validation utilities
export {
  validateConfig,
  validatePartialConfig,
  looksLikeConfig,
  type ValidationIssue,
} from './validator.js';

// Path finding utilities
export {
  findConfigFile,
  configFileExists,
  resolveConfigPath,
  getConfigDir,
  CONFIG_FILE_NAMES,
  CONFIG_ENV_VAR,
  type FindConfigOptions,
} from './path-finder.js';

// Default values
export {
  DEFAULT_GITHUB_CONFIG,
  DEFAULT_ASANA_CONFIG,
  DEFAULT_WORKTREE_CONFIG,
  DEFAULT_CHECKS_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  applyGitHubDefaults,
  applyAsanaDefaults,
  applyWorktreeDefaults,
  applyChecksDefaults,
  applyLoggingDefaults,
} from './defaults.js';
