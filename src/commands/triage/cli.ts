/**
 * @module commands/triage/cli
 * @description CLI parameter parsing for triage command
 */

import type { Result } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { IssuePriority } from '../../common/types/index.js';
import type { TriageOptions, TriageMode } from './types.js';

/**
 * Mutable options builder type
 */
type MutableTriageOptions = {
  -readonly [K in keyof TriageOptions]: TriageOptions[K];
};

/**
 * Default triage options
 */
const DEFAULT_OPTIONS: MutableTriageOptions = {
  mode: 'interactive',
  dryRun: false,
  verbose: false,
  skipConfirmation: false,
};

/**
 * CLI flag definitions
 */
interface FlagDefinition {
  readonly short?: string;
  readonly long: string;
  readonly description: string;
  readonly takesValue: boolean;
  readonly defaultValue?: string;
}

const FLAG_DEFINITIONS: readonly FlagDefinition[] = [
  { short: 'm', long: 'mode', description: 'Operation mode (interactive, batch, single)', takesValue: true, defaultValue: 'interactive' },
  { short: 'd', long: 'dry-run', description: 'Simulate without making changes', takesValue: false },
  { short: 'p', long: 'project', description: 'Asana project ID', takesValue: true },
  { short: 's', long: 'section', description: 'Asana section ID', takesValue: true },
  { short: 'P', long: 'priority', description: 'Filter by priority (critical, high, medium, low)', takesValue: true },
  { short: 'l', long: 'limit', description: 'Maximum number of tasks to process', takesValue: true },
  { short: 'y', long: 'yes', description: 'Skip confirmation prompts', takesValue: false },
  { short: 'v', long: 'verbose', description: 'Enable verbose output', takesValue: false },
  { short: 'h', long: 'help', description: 'Show help message', takesValue: false },
  { long: 'version', description: 'Show version', takesValue: false },
] as const;

/**
 * Parse command line arguments into TriageOptions
 */
export function parseArgs(args: readonly string[]): Result<TriageOptions, Error> {
  const options: MutableTriageOptions = { ...DEFAULT_OPTIONS };
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
      return err(new VersionRequestedError('auto-fix-workflow triage v0.1.0'));
    }

    // Long flags
    if (arg !== undefined && arg.startsWith('--')) {
      const flagName = arg.slice(2);
      const [key, inlineValue] = flagName.split('=');
      const definition = FLAG_DEFINITIONS.find((d) => d.long === key);

      if (!definition || key === undefined) {
        errors.push(`Unknown flag: --${key ?? 'unknown'}`);
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
    else if (arg !== undefined && arg.startsWith('-') && arg.length > 1) {
      const shortFlag = arg.slice(1);

      // Handle combined short flags like -dv
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
    // Positional arguments (task GID for single mode)
    else if (arg !== undefined && !options.projectId && isValidGid(arg)) {
      // First positional could be project or task
      options.projectId = arg;
    }

    i++;
  }

  if (errors.length > 0) {
    return err(new Error(`CLI parsing errors:\n  - ${errors.join('\n  - ')}`));
  }

  // Validate mode
  if (options.mode && !isValidMode(options.mode)) {
    return err(new Error(`Invalid mode: ${options.mode}. Must be 'interactive', 'batch', or 'single'`));
  }

  // Validate priority
  if (options.priority && !isValidPriority(options.priority)) {
    return err(new Error(`Invalid priority: ${options.priority}. Must be 'critical', 'high', 'medium', or 'low'`));
  }

  return ok(options as TriageOptions);
}

/**
 * Apply a parsed flag to options
 */
function applyFlag(
  options: MutableTriageOptions,
  flag: string,
  value: string,
  errors: string[]
): void {
  switch (flag) {
    case 'mode':
      if (isValidMode(value)) {
        options.mode = value;
      } else {
        errors.push(`Invalid mode: ${value}`);
      }
      break;

    case 'dry-run':
      options.dryRun = value === 'true';
      break;

    case 'project':
      options.projectId = value;
      break;

    case 'section':
      options.sectionId = value;
      break;

    case 'priority':
      if (isValidPriority(value)) {
        options.priority = value;
      } else {
        errors.push(`Invalid priority: ${value}`);
      }
      break;

    case 'limit':
      const limit = parseInt(value, 10);
      if (isNaN(limit) || limit <= 0) {
        errors.push(`Invalid limit: ${value}. Must be a positive integer`);
      } else {
        options.limit = limit;
      }
      break;

    case 'yes':
      options.skipConfirmation = true;
      break;

    case 'verbose':
      options.verbose = true;
      break;
  }
}

/**
 * Check if a string is a valid GID
 */
function isValidGid(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Check if a string is a valid mode
 */
function isValidMode(value: string): value is TriageMode {
  return ['interactive', 'batch', 'single'].includes(value);
}

/**
 * Check if a string is a valid priority
 */
function isValidPriority(value: string): value is IssuePriority {
  return ['critical', 'high', 'medium', 'low'].includes(value);
}

/**
 * Generate help message
 */
export function getHelpMessage(): string {
  const lines: string[] = [
    'Usage: auto-fix triage [options]',
    '',
    'Triage Asana tasks and create GitHub issues',
    '',
    'Options:',
  ];

  for (const flag of FLAG_DEFINITIONS) {
    const shortPart = flag.short ? `-${flag.short}, ` : '    ';
    const longPart = `--${flag.long}${flag.takesValue ? ' <value>' : ''}`;
    const padding = ' '.repeat(Math.max(1, 25 - shortPart.length - longPart.length));
    lines.push(`  ${shortPart}${longPart}${padding}${flag.description}`);
  }

  lines.push('');
  lines.push('Modes:');
  lines.push('  interactive   Select tasks interactively (default)');
  lines.push('  batch         Process all triage tasks automatically');
  lines.push('  single        Process a single task by GID');
  lines.push('');
  lines.push('Examples:');
  lines.push('  auto-fix triage                         Interactive mode');
  lines.push('  auto-fix triage --mode batch --dry-run  Batch dry run');
  lines.push('  auto-fix triage -p 123456 -m single     Process single project');
  lines.push('  auto-fix triage --priority high -l 10   High priority, max 10');

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
export function formatOptions(options: TriageOptions): string {
  const lines: string[] = ['Triage Options:'];

  lines.push(`  Mode: ${options.mode}`);
  lines.push(`  Dry Run: ${options.dryRun ? 'yes' : 'no'}`);

  if (options.projectId) {
    lines.push(`  Project ID: ${options.projectId}`);
  }

  if (options.sectionId) {
    lines.push(`  Section ID: ${options.sectionId}`);
  }

  if (options.priority) {
    lines.push(`  Priority Filter: ${options.priority}`);
  }

  if (options.limit) {
    lines.push(`  Limit: ${options.limit}`);
  }

  lines.push(`  Skip Confirmation: ${options.skipConfirmation ? 'yes' : 'no'}`);
  lines.push(`  Verbose: ${options.verbose ? 'yes' : 'no'}`);

  return lines.join('\n');
}
