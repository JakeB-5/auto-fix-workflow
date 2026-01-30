/**
 * @module commands/init/cli
 * @description CLI parameter parsing for init command
 */

import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { InitOptions } from './types.js';

/**
 * Mutable options builder type
 */
type MutableInitOptions = {
  -readonly [K in keyof InitOptions]: InitOptions[K];
};

/**
 * Default init options
 */
const DEFAULT_OPTIONS: MutableInitOptions = {
  nonInteractive: false,
  force: false,
  skipValidation: false,
};

/**
 * CLI flag definitions
 */
interface FlagDefinition {
  readonly short?: string;
  readonly long: string;
  readonly description: string;
  readonly takesValue: boolean;
}

const FLAG_DEFINITIONS: readonly FlagDefinition[] = [
  { short: 'n', long: 'non-interactive', description: 'Read tokens from environment variables', takesValue: false },
  { short: 'f', long: 'force', description: 'Overwrite existing configuration files', takesValue: false },
  { short: 's', long: 'skip-validation', description: 'Skip token validation steps', takesValue: false },
  { short: 'h', long: 'help', description: 'Show help message', takesValue: false },
  { long: 'version', description: 'Show version', takesValue: false },
] as const;

/**
 * Parse command line arguments into InitOptions
 */
export function parseArgs(args: readonly string[]): Result<InitOptions, Error> {
  const options: MutableInitOptions = { ...DEFAULT_OPTIONS };
  const errors: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // Help flag
    if (arg === '-h' || arg === '--help') {
      return err(new HelpRequestedError(getHelpMessage()));
    }

    // Version flag
    if (arg === '--version') {
      return err(new VersionRequestedError('auto-fix-workflow init v0.1.0'));
    }

    // Long flags
    if (arg.startsWith('--')) {
      const flagName = arg.slice(2);
      const [key, inlineValue] = flagName.split('=');
      const definition = FLAG_DEFINITIONS.find((d) => d.long === key);

      if (!definition) {
        errors.push(`Unknown flag: --${key}`);
        i++;
        continue;
      }

      if (definition.takesValue) {
        const value = inlineValue ?? args[++i];
        if (!value || value.startsWith('-')) {
          errors.push(`Flag --${key} requires a value`);
          continue;
        }
        applyFlag(options, key, value, errors);
      } else {
        applyFlag(options, key, 'true', errors);
      }
    }
    // Short flags
    else if (arg.startsWith('-') && arg.length > 1) {
      const shortFlag = arg.slice(1);

      // Handle combined short flags like -nf
      if (shortFlag.length > 1 && !shortFlag.includes('=')) {
        for (const char of shortFlag) {
          const definition = FLAG_DEFINITIONS.find((d) => d.short === char);
          if (!definition) {
            errors.push(`Unknown flag: -${char}`);
            continue;
          }
          if (definition.takesValue) {
            errors.push(`Flag -${char} requires a value and cannot be combined`);
            continue;
          }
          applyFlag(options, definition.long, 'true', errors);
        }
      } else {
        const [key, inlineValue] = shortFlag.split('=');
        const definition = FLAG_DEFINITIONS.find((d) => d.short === key);

        if (!definition) {
          errors.push(`Unknown flag: -${key}`);
          i++;
          continue;
        }

        if (definition.takesValue) {
          const value = inlineValue ?? args[++i];
          if (!value || value.startsWith('-')) {
            errors.push(`Flag -${key} requires a value`);
            continue;
          }
          applyFlag(options, definition.long, value, errors);
        } else {
          applyFlag(options, definition.long, 'true', errors);
        }
      }
    }
    // No positional arguments expected for init command
    else {
      errors.push(`Unexpected argument: ${arg}`);
    }

    i++;
  }

  if (errors.length > 0) {
    return err(new Error(`CLI parsing errors:\n  - ${errors.join('\n  - ')}`));
  }

  return ok(options as InitOptions);
}

/**
 * Apply a parsed flag to options
 */
function applyFlag(
  options: MutableInitOptions,
  flag: string,
  value: string,
  errors: string[]
): void {
  switch (flag) {
    case 'non-interactive':
      options.nonInteractive = value === 'true';
      break;

    case 'force':
      options.force = value === 'true';
      break;

    case 'skip-validation':
      options.skipValidation = value === 'true';
      break;

    default:
      errors.push(`Unknown flag: ${flag}`);
  }
}

/**
 * Generate help message
 */
export function getHelpMessage(): string {
  const lines: string[] = [
    'Usage: auto-fix-workflow init [options]',
    '',
    'Options:',
    '  -n, --non-interactive  환경변수에서 토큰 읽기',
    '  -f, --force            기존 파일 강제 덮어쓰기',
    '  -s, --skip-validation  토큰 검증 건너뛰기',
    '  -h, --help             도움말 출력',
  ];

  return lines.join('\n');
}

/**
 * Error class for help request
 */
export class HelpRequestedError extends Error {
  readonly helpText: string;

  constructor(helpText: string) {
    super('Help requested');
    this.name = 'HelpRequestedError';
    this.helpText = helpText;
  }
}

/**
 * Error class for version request
 */
export class VersionRequestedError extends Error {
  readonly version: string;

  constructor(version: string) {
    super('Version requested');
    this.name = 'VersionRequestedError';
    this.version = version;
  }
}

/**
 * Format options for display
 */
export function formatOptions(options: InitOptions): string {
  const lines: string[] = ['Init Options:'];

  lines.push(`  Non-Interactive: ${options.nonInteractive ? 'yes' : 'no'}`);
  lines.push(`  Force Overwrite: ${options.force ? 'yes' : 'no'}`);
  lines.push(`  Skip Validation: ${options.skipValidation ? 'yes' : 'no'}`);

  return lines.join('\n');
}
