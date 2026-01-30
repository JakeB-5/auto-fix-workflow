/**
 * @module common/config-loader/yaml-parser
 * @description YAML parsing with error handling
 */

import { parse as parseYaml, YAMLParseError } from 'yaml';
import type { Result } from '../types/index.js';
import { ok, err } from '../types/index.js';
import { ConfigError } from './errors.js';

/**
 * Parse YAML content into an object
 *
 * @param content - Raw YAML string content
 * @param sourcePath - Optional source path for error messages
 * @returns Result containing parsed object or ConfigError
 */
export function parseYamlConfig(
  content: string,
  sourcePath?: string
): Result<unknown, ConfigError> {
  try {
    const parsed = parseYaml(content, {
      strict: true,
      uniqueKeys: true,
    });

    // Handle empty file
    if (parsed === null || parsed === undefined) {
      return err(
        new ConfigError(
          'CONFIG_PARSE_ERROR',
          'Configuration file is empty',
          sourcePath ? { path: sourcePath } : undefined
        )
      );
    }

    // Ensure it's an object
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return err(
        new ConfigError(
          'CONFIG_PARSE_ERROR',
          'Configuration must be a YAML object/map, not an array or scalar',
          sourcePath ? { path: sourcePath } : undefined
        )
      );
    }

    return ok(parsed);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      return err(
        ConfigError.parseError(
          sourcePath ?? 'unknown',
          new Error(`YAML syntax error at line ${error.linePos?.[0]?.line ?? 'unknown'}: ${error.message}`)
        )
      );
    }

    return err(
      ConfigError.parseError(
        sourcePath ?? 'unknown',
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }
}

/**
 * Stringify an object to YAML format
 *
 * @param data - Object to stringify
 * @returns YAML string
 */
export function stringifyYamlConfig(data: unknown): string {
  const { stringify } = require('yaml') as typeof import('yaml');
  return stringify(data, {
    indent: 2,
    lineWidth: 120,
  });
}
