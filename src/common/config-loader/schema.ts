/**
 * @module common/config-loader/schema
 * @description Zod schemas for all configuration types
 */

import { z } from 'zod';

/**
 * GitHub configuration schema
 */
export const GitHubConfigSchema = z.object({
  token: z.string().min(1, 'GitHub token is required'),
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  apiBaseUrl: z.string().url().optional(),
  defaultBranch: z.string().optional(),
  autoFixLabel: z.string().optional(),
  skipLabel: z.string().optional(),
});

/**
 * Asana configuration schema
 */
export const AsanaConfigSchema = z.object({
  token: z.string().min(1, 'Asana token is required'),
  workspaceGid: z.string().min(1, 'Workspace GID is required'),
  projectGids: z.array(z.string().min(1)).min(1, 'At least one project GID is required'),
  triageSection: z.string().optional(),
  doneSection: z.string().optional(),
  syncedTag: z.string().optional(),
});

/**
 * Sentry configuration schema (all optional)
 */
export const SentryConfigSchema = z.object({
  dsn: z.string().optional(),
  organization: z.string().optional(),
  project: z.string().optional(),
  webhookSecret: z.string().optional(),
}).optional();

/**
 * Worktree configuration schema
 */
export const WorktreeConfigSchema = z.object({
  baseDir: z.string().min(1, 'Worktree base directory is required'),
  maxConcurrent: z.number().int().positive().optional(),
  autoCleanupMinutes: z.number().int().positive().optional(),
  prefix: z.string().optional(),
});

/**
 * Checks configuration schema
 */
export const ChecksConfigSchema = z.object({
  testCommand: z.string().optional(),
  typeCheckCommand: z.string().optional(),
  lintCommand: z.string().optional(),
  testTimeout: z.number().int().positive().optional(),
  typeCheckTimeout: z.number().int().positive().optional(),
  lintTimeout: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
}).optional();

/**
 * Logging level schema
 */
export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: LogLevelSchema,
  pretty: z.boolean().optional(),
  filePath: z.string().optional(),
  redact: z.boolean().optional(),
}).optional();

/**
 * Complete configuration schema
 */
export const ConfigSchema = z.object({
  github: GitHubConfigSchema,
  asana: AsanaConfigSchema,
  sentry: SentryConfigSchema,
  worktree: WorktreeConfigSchema,
  checks: ChecksConfigSchema,
  logging: LoggingConfigSchema,
});

/**
 * Partial configuration schema (for environment variable overrides)
 */
export const PartialConfigSchema = z.object({
  github: GitHubConfigSchema.partial().optional(),
  asana: AsanaConfigSchema.partial().optional(),
  sentry: SentryConfigSchema,
  worktree: WorktreeConfigSchema.partial().optional(),
  checks: ChecksConfigSchema,
  logging: LoggingConfigSchema,
}).partial();

/**
 * Inferred types from schemas
 */
export type GitHubConfigInput = z.input<typeof GitHubConfigSchema>;
export type AsanaConfigInput = z.input<typeof AsanaConfigSchema>;
export type SentryConfigInput = z.input<typeof SentryConfigSchema>;
export type WorktreeConfigInput = z.input<typeof WorktreeConfigSchema>;
export type ChecksConfigInput = z.input<typeof ChecksConfigSchema>;
export type LoggingConfigInput = z.input<typeof LoggingConfigSchema>;
export type ConfigInput = z.input<typeof ConfigSchema>;
export type PartialConfigInput = z.input<typeof PartialConfigSchema>;
