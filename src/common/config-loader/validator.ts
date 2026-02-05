/**
 * @module common/config-loader/validator
 * @description Configuration validation against Zod schema
 */

import type { ZodError } from 'zod';
import type { Config } from '../types/index.js';
import type { Result } from '../types/index.js';
import { ok, err } from '../types/index.js';
import { ConfigSchema } from './schema.js';
import { ConfigError } from './errors.js';
import {
  applyChecksDefaults,
  applyLoggingDefaults,
} from './defaults.js';

/**
 * Validation issue from Zod
 */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Format Zod errors into validation issues
 */
function formatZodErrors(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}

/**
 * Validate raw config data against the schema
 *
 * @param data - Raw configuration data (from YAML parsing)
 * @param sourcePath - Optional source path for error messages
 * @returns Result containing validated Config or ConfigError
 */
export function validateConfig(
  data: unknown,
  sourcePath?: string
): Result<Config, ConfigError> {
  // Apply defaults for optional sections before validation
  const dataWithDefaults = applyOptionalDefaults(data);

  const result = ConfigSchema.safeParse(dataWithDefaults);

  if (result.success) {
    return ok(result.data as Config);
  }

  const issues = formatZodErrors(result.error);
  return err(ConfigError.validationError(sourcePath ?? 'config', issues));
}

/**
 * Normalize user-friendly config field names to schema-expected names
 *
 * Transformations:
 * - tokens.asana → asana.token
 * - tokens.github → github.token
 * - asana.workspaceId → asana.workspaceGid
 * - asana.projectId (string) → asana.projectGids (array)
 * - worktree.basePath → worktree.baseDir
 * - worktree.maxParallel → worktree.maxConcurrent
 */
function normalizeConfig(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };

  // Handle tokens section - merge into respective configs
  const tokens = data['tokens'] as Record<string, string> | undefined;
  if (tokens) {
    // Merge GitHub token
    if (tokens['github']) {
      const github = (result['github'] as Record<string, unknown>) ?? {};
      if (!github['token']) {
        result['github'] = { ...github, token: tokens['github'] };
      }
    }

    // Merge Asana token
    if (tokens['asana']) {
      const asana = (result['asana'] as Record<string, unknown>) ?? {};
      if (!asana['token']) {
        result['asana'] = { ...asana, token: tokens['asana'] };
      }
    }

    // Remove tokens section after merging
    delete result['tokens'];
  }

  // Normalize Asana config field names
  const asana = result['asana'] as Record<string, unknown> | undefined;
  if (asana) {
    const normalizedAsana = { ...asana };

    // workspaceId → workspaceGid
    if (asana['workspaceId'] && !asana['workspaceGid']) {
      normalizedAsana['workspaceGid'] = asana['workspaceId'];
      delete normalizedAsana['workspaceId'];
    }

    // projectId (string) → projectGids (array)
    if (asana['projectId'] && !asana['projectGids']) {
      const projectId = asana['projectId'] as string;
      normalizedAsana['projectGids'] = [projectId];
      delete normalizedAsana['projectId'];
    }

    result['asana'] = normalizedAsana;
  }

  // Normalize Worktree config field names
  const worktree = result['worktree'] as Record<string, unknown> | undefined;
  if (worktree) {
    const normalizedWorktree = { ...worktree };

    // basePath → baseDir
    if (worktree['basePath'] && !worktree['baseDir']) {
      normalizedWorktree['baseDir'] = worktree['basePath'];
      delete normalizedWorktree['basePath'];
    }

    // maxParallel → maxConcurrent
    if (worktree['maxParallel'] && !worktree['maxConcurrent']) {
      normalizedWorktree['maxConcurrent'] = worktree['maxParallel'];
      delete normalizedWorktree['maxParallel'];
    }

    result['worktree'] = normalizedWorktree;
  }

  // Normalize Checks config field names
  const checks = result['checks'] as Record<string, unknown> | undefined;
  if (checks) {
    const normalizedChecks = { ...checks };

    // timeout → testTimeout, typeCheckTimeout, lintTimeout (apply to all if not individually set)
    if (checks['timeout'] !== undefined) {
      const timeout = checks['timeout'] as number;
      if (!checks['testTimeout']) {
        normalizedChecks['testTimeout'] = timeout;
      }
      if (!checks['typeCheckTimeout']) {
        normalizedChecks['typeCheckTimeout'] = timeout;
      }
      if (!checks['lintTimeout']) {
        normalizedChecks['lintTimeout'] = timeout;
      }
      delete normalizedChecks['timeout'];
    }

    // Remove non-schema fields (order, failFast are used elsewhere but not in schema)
    delete normalizedChecks['order'];
    delete normalizedChecks['failFast'];

    result['checks'] = normalizedChecks;
  }

  return result;
}

/**
 * Apply defaults to optional configuration sections
 */
function applyOptionalDefaults(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // First normalize field names
  const normalized = normalizeConfig(data as Record<string, unknown>);

  return {
    ...normalized,
    checks: applyChecksDefaults(normalized['checks'] as Record<string, unknown> | undefined),
    logging: applyLoggingDefaults(normalized['logging'] as Record<string, unknown> | undefined),
  };
}

/**
 * Validate a partial config (for environment overrides)
 *
 * @param data - Partial configuration data
 * @returns Result containing validated partial config or ConfigError
 */
export function validatePartialConfig(
  data: unknown
): Result<Partial<Config>, ConfigError> {
  if (!data || typeof data !== 'object') {
    return err(
      new ConfigError(
        'CONFIG_VALIDATION_ERROR',
        'Partial config must be an object',
        { details: { received: typeof data } }
      )
    );
  }

  // For partial configs, we just ensure each section that exists is valid
  // This is a looser validation that allows missing required fields
  return ok(data as Partial<Config>);
}

/**
 * Check if a value looks like a valid config structure
 *
 * @param data - Data to check
 * @returns True if data appears to be a config object
 */
export function looksLikeConfig(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check for expected top-level keys
  const configKeys = ['github', 'asana', 'worktree', 'sentry', 'checks', 'logging'];
  const hasConfigKey = configKeys.some((key) => key in obj);

  return hasConfigKey;
}
