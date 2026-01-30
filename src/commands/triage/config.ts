/**
 * @module commands/triage/config
 * @description Triage configuration loader
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { TriageConfig } from './types.js';
import { DEFAULT_TRIAGE_CONFIG } from './types.js';

/**
 * Mutable config builder type
 */
type MutableTriageConfig = {
  -readonly [K in keyof TriageConfig]: TriageConfig[K] extends object
    ? { -readonly [P in keyof TriageConfig[K]]: TriageConfig[K][P] }
    : TriageConfig[K];
};

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = [
  '.auto-fix.yaml',
  '.auto-fix.yml',
  '.autofix.yaml',
  '.autofix.yml',
  'auto-fix.config.yaml',
  'auto-fix.config.yml',
] as const;

/**
 * Raw configuration structure from YAML
 */
interface RawConfig {
  triage?: Partial<TriageConfig>;
  asana?: {
    defaultProjectGid?: string;
    triageSection?: string;
    processedSection?: string;
    syncedTag?: string;
  };
  github?: {
    defaultLabels?: string[];
  };
  retry?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
}

/**
 * Load triage configuration from file
 */
export async function loadTriageConfig(
  basePath: string = process.cwd()
): Promise<Result<TriageConfig, Error>> {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = join(basePath, fileName);
    try {
      const content = await readFile(filePath, 'utf-8');
      const rawConfig = parseYaml(content) as RawConfig;
      const config = mergeConfig(rawConfig);
      return ok(config);
    } catch {
      // File not found or parse error, try next
      continue;
    }
  }

  // No config file found, return defaults
  return ok(DEFAULT_TRIAGE_CONFIG);
}

/**
 * Merge raw config with defaults
 */
function mergeConfig(raw: RawConfig): TriageConfig {
  return {
    defaultProjectGid: raw.triage?.defaultProjectGid ?? raw.asana?.defaultProjectGid,
    triageSectionName:
      raw.triage?.triageSectionName ?? raw.asana?.triageSection ?? DEFAULT_TRIAGE_CONFIG.triageSectionName,
    processedSectionName:
      raw.triage?.processedSectionName ?? raw.asana?.processedSection ?? DEFAULT_TRIAGE_CONFIG.processedSectionName,
    syncedTagName:
      raw.triage?.syncedTagName ?? raw.asana?.syncedTag ?? DEFAULT_TRIAGE_CONFIG.syncedTagName,
    defaultLabels:
      raw.triage?.defaultLabels ?? raw.github?.defaultLabels ?? DEFAULT_TRIAGE_CONFIG.defaultLabels,
    priorityFieldName: raw.triage?.priorityFieldName ?? DEFAULT_TRIAGE_CONFIG.priorityFieldName,
    componentFieldName: raw.triage?.componentFieldName ?? DEFAULT_TRIAGE_CONFIG.componentFieldName,
    githubIssueFieldName: raw.triage?.githubIssueFieldName ?? DEFAULT_TRIAGE_CONFIG.githubIssueFieldName,
    maxBatchSize: raw.triage?.maxBatchSize ?? DEFAULT_TRIAGE_CONFIG.maxBatchSize,
    retry: {
      maxAttempts:
        raw.triage?.retry?.maxAttempts ?? raw.retry?.maxAttempts ?? DEFAULT_TRIAGE_CONFIG.retry.maxAttempts,
      initialDelayMs:
        raw.triage?.retry?.initialDelayMs ?? raw.retry?.initialDelayMs ?? DEFAULT_TRIAGE_CONFIG.retry.initialDelayMs,
      maxDelayMs:
        raw.triage?.retry?.maxDelayMs ?? raw.retry?.maxDelayMs ?? DEFAULT_TRIAGE_CONFIG.retry.maxDelayMs,
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: TriageConfig): Result<TriageConfig, Error> {
  const errors: string[] = [];

  if (config.maxBatchSize <= 0) {
    errors.push('maxBatchSize must be positive');
  }

  if (config.retry.maxAttempts <= 0) {
    errors.push('retry.maxAttempts must be positive');
  }

  if (config.retry.initialDelayMs < 0) {
    errors.push('retry.initialDelayMs must be non-negative');
  }

  if (config.retry.maxDelayMs < config.retry.initialDelayMs) {
    errors.push('retry.maxDelayMs must be >= retry.initialDelayMs');
  }

  if (!config.triageSectionName) {
    errors.push('triageSectionName is required');
  }

  if (!config.processedSectionName) {
    errors.push('processedSectionName is required');
  }

  if (errors.length > 0) {
    return err(new Error(`Configuration validation failed: ${errors.join('; ')}`));
  }

  return ok(config);
}

/**
 * Get configuration from environment variables
 */
export function getEnvConfig(): Partial<MutableTriageConfig> {
  const envConfig: Partial<MutableTriageConfig> = {};

  const projectGid = process.env.ASANA_DEFAULT_PROJECT_GID;
  if (projectGid) {
    envConfig.defaultProjectGid = projectGid;
  }

  const triageSection = process.env.ASANA_TRIAGE_SECTION;
  if (triageSection) {
    envConfig.triageSectionName = triageSection;
  }

  const processedSection = process.env.ASANA_PROCESSED_SECTION;
  if (processedSection) {
    envConfig.processedSectionName = processedSection;
  }

  const syncedTag = process.env.ASANA_SYNCED_TAG;
  if (syncedTag) {
    envConfig.syncedTagName = syncedTag;
  }

  const maxBatchSize = process.env.TRIAGE_MAX_BATCH_SIZE;
  if (maxBatchSize) {
    const parsed = parseInt(maxBatchSize, 10);
    if (!isNaN(parsed)) {
      envConfig.maxBatchSize = parsed;
    }
  }

  return envConfig;
}

/**
 * Load and merge configuration from file and environment
 */
export async function loadConfig(basePath?: string): Promise<Result<TriageConfig, Error>> {
  const fileConfigResult = await loadTriageConfig(basePath);
  if (!fileConfigResult.success) {
    return fileConfigResult;
  }

  const envConfig = getEnvConfig();
  const mergedConfig: TriageConfig = {
    ...fileConfigResult.data,
    ...envConfig,
    retry: {
      ...fileConfigResult.data.retry,
    },
  };

  return validateConfig(mergedConfig);
}

/**
 * Create a configuration writer for saving config back to file
 */
export async function saveConfig(
  config: TriageConfig,
  basePath: string = process.cwd(),
  fileName: string = '.auto-fix.yaml'
): Promise<Result<void, Error>> {
  const { stringify } = await import('yaml');
  const { writeFile } = await import('node:fs/promises');
  const filePath = join(basePath, fileName);

  try {
    const yamlContent = stringify({ triage: config });
    await writeFile(filePath, yamlContent, 'utf-8');
    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error ? error : new Error(`Failed to save config: ${String(error)}`)
    );
  }
}
