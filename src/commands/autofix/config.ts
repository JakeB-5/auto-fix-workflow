/**
 * @module commands/autofix/config
 * @description CLI parameters and configuration system for autofix command
 */

import { z } from 'zod';
import type { GroupBy, Config, GitHubConfig, WorktreeConfig, ChecksConfig } from '../../common/types/index.js';
import type { AutofixOptions } from './types.js';

/**
 * CLI argument schema
 */
export const AutofixArgsSchema = z.object({
  /** Specific issue numbers (comma-separated or repeated) */
  issues: z.union([
    z.string().transform(s => s.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))),
    z.array(z.number()),
  ]).optional(),

  /** Process all auto-fix labeled issues without confirmation */
  all: z.boolean().default(false)
    .describe('Process all auto-fix labeled issues without confirmation'),

  /** Grouping strategy */
  groupBy: z.enum(['component', 'file', 'label', 'type', 'priority'])
    .default('component')
    .describe('How to group issues for processing'),

  /** Maximum parallel worktrees */
  maxParallel: z.number().min(1).max(10).default(3)
    .describe('Maximum number of parallel worktrees'),

  /** Dry-run mode */
  dryRun: z.boolean().default(false)
    .describe('Preview changes without making them'),

  /** Maximum retries */
  maxRetries: z.number().min(1).max(10).default(3)
    .describe('Maximum retry attempts per group'),

  /** Label filter */
  labels: z.string().optional()
    .transform(s => s?.split(',').map(l => l.trim()))
    .describe('Labels to filter issues (comma-separated)'),

  /** Exclude labels */
  excludeLabels: z.string().optional()
    .transform(s => s?.split(',').map(l => l.trim()))
    .describe('Labels to exclude (comma-separated)'),

  /** Base branch */
  baseBranch: z.string().optional()
    .describe('Base branch for PRs (default: autofixing)'),

  /** Verbose output */
  verbose: z.boolean().default(false)
    .describe('Enable verbose output'),

  /** Config file path */
  config: z.string().optional()
    .describe('Path to config file'),
}).refine(
  (data) => !(data.all && data.issues),
  {
    message: 'Cannot use --all and --issues together',
    path: ['all'],
  }
);

export type AutofixArgs = z.infer<typeof AutofixArgsSchema>;

/**
 * Environment variable mappings
 */
export const ENV_MAPPINGS = {
  GITHUB_TOKEN: 'github.token',
  GITHUB_OWNER: 'github.owner',
  GITHUB_REPO: 'github.repo',
  GITHUB_API_URL: 'github.apiBaseUrl',
  GITHUB_DEFAULT_BRANCH: 'github.defaultBranch',
  AUTOFIX_LABEL: 'github.autoFixLabel',
  AUTOFIX_SKIP_LABEL: 'github.skipLabel',
  WORKTREE_BASE_DIR: 'worktree.baseDir',
  WORKTREE_MAX_CONCURRENT: 'worktree.maxConcurrent',
  WORKTREE_PREFIX: 'worktree.prefix',
  TEST_COMMAND: 'checks.testCommand',
  TYPECHECK_COMMAND: 'checks.typeCheckCommand',
  LINT_COMMAND: 'checks.lintCommand',
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<Config> = {
  github: {
    token: '',
    owner: '',
    repo: '',
    defaultBranch: 'main',
    autoFixLabel: 'auto-fix',
    skipLabel: 'auto-fix-skip',
  },
  worktree: {
    baseDir: '.worktrees',
    maxConcurrent: 3,
    autoCleanupMinutes: 60,
    prefix: 'autofix-',
  },
  checks: {
    testCommand: 'npm test',
    typeCheckCommand: 'npm run type-check',
    lintCommand: 'npm run lint',
    testTimeout: 300,
    typeCheckTimeout: 60,
    lintTimeout: 120,
    maxRetries: 3,
  },
};

/**
 * Parse CLI arguments to AutofixOptions
 */
export function parseArgs(args: unknown): AutofixOptions {
  const parsed = AutofixArgsSchema.parse(args);

  const options: AutofixOptions = {
    groupBy: parsed.groupBy as GroupBy,
    maxParallel: parsed.maxParallel,
    dryRun: parsed.dryRun,
    maxRetries: parsed.maxRetries,
  };

  // Only set optional properties if they have values
  if (parsed.all) {
    (options as { all?: boolean }).all = parsed.all;
  }
  if (parsed.issues) {
    (options as { issueNumbers?: readonly number[] }).issueNumbers = parsed.issues;
  }
  if (parsed.labels) {
    (options as { labels?: readonly string[] }).labels = parsed.labels;
  }
  if (parsed.excludeLabels) {
    (options as { excludeLabels?: readonly string[] }).excludeLabels = parsed.excludeLabels;
  }
  if (parsed.baseBranch) {
    (options as { baseBranch?: string }).baseBranch = parsed.baseBranch;
  }
  if (parsed.verbose) {
    (options as { verbose?: boolean }).verbose = parsed.verbose;
  }

  return options;
}

/**
 * Load configuration from environment variables
 */
export function loadEnvConfig(): Partial<Config> {
  const config: Record<string, unknown> = {};

  for (const [envKey, configPath] of Object.entries(ENV_MAPPINGS)) {
    const value = process.env[envKey];
    if (value !== undefined) {
      setNestedValue(config, configPath, value);
    }
  }

  return config as Partial<Config>;
}

/**
 * Merge configurations (later values override earlier)
 */
export function mergeConfigs(...configs: Array<Partial<Config> | Config>): Config {
  const merged: Record<string, unknown> = {};

  for (const config of configs) {
    deepMerge(merged, config as Record<string, unknown>);
  }

  return merged as unknown as Config;
}

/**
 * Validate complete configuration
 */
export function validateConfig(config: Config): ValidationResult {
  const errors: string[] = [];

  // Required GitHub config
  if (!config.github?.token) {
    errors.push('GitHub token is required (set GITHUB_TOKEN or github.token in config)');
  }
  if (!config.github?.owner) {
    errors.push('GitHub owner is required (set GITHUB_OWNER or github.owner in config)');
  }
  if (!config.github?.repo) {
    errors.push('GitHub repo is required (set GITHUB_REPO or github.repo in config)');
  }

  // Worktree config
  if (!config.worktree?.baseDir) {
    errors.push('Worktree base directory is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Create GitHub config from Config
 */
export function extractGitHubConfig(config: Config): GitHubConfig {
  return config.github;
}

/**
 * Create Worktree config from Config
 */
export function extractWorktreeConfig(config: Config): WorktreeConfig {
  return config.worktree;
}

/**
 * Create Checks config from Config
 */
export function extractChecksConfig(config: Config): ChecksConfig {
  return config.checks ?? {};
}

/**
 * Generate help text for CLI
 */
export function generateHelpText(): string {
  return `
autofix - Automatically fix GitHub issues

USAGE:
  autofix [options]

OPTIONS:
  --all                 Process all auto-fix labeled issues without confirmation
                        (cannot be used with --issues)
  --issues <nums>       Specific issue numbers (comma-separated)
  --group-by <strategy> Grouping strategy: component, file, label, type, priority
                        (default: component)
  --max-parallel <n>    Maximum parallel worktrees (default: 3)
  --dry-run             Preview changes without making them
  --max-retries <n>     Maximum retry attempts (default: 3)
  --labels <labels>     Filter issues by labels (comma-separated)
  --exclude-labels      Exclude issues with labels (comma-separated)
  --base-branch <name>  Base branch for PRs (default: autofixing)
  --verbose             Enable verbose output
  --config <path>       Path to config file

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN          GitHub Personal Access Token (required)
  GITHUB_OWNER          Repository owner (required)
  GITHUB_REPO           Repository name (required)
  GITHUB_API_URL        GitHub API base URL
  WORKTREE_BASE_DIR     Base directory for worktrees
  TEST_COMMAND          Custom test command
  TYPECHECK_COMMAND     Custom type-check command
  LINT_COMMAND          Custom lint command

EXAMPLES:
  # Process all auto-fix labeled issues
  autofix

  # Process all issues without confirmation
  autofix --all

  # Process all issues in dry-run mode
  autofix --all --dry-run

  # Process specific issues
  autofix --issues 123,456,789

  # Dry-run to preview
  autofix --dry-run

  # Group by file and run 5 parallel
  autofix --group-by file --max-parallel 5
`.trim();
}

// Helper functions

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

function deepMerge(target: Record<string, unknown>, source: unknown): void {
  if (!source || typeof source !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key] as Record<string, unknown>, value);
    } else {
      target[key] = value;
    }
  }
}
