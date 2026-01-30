/**
 * @module common/issue-parser/fallback
 * @description Error handling and fallback strategies for issue parsing
 */

import type { IssueSource, IssueType, IssuePriority } from '../types/index.js';
import type { ParsedIssue, ParseError, ExtendedAcceptanceCriteria } from './types.js';
import { DEFAULT_VALUES } from './types.js';

/**
 * Fallback strategies configuration
 */
export interface FallbackConfig {
  /** Use defaults for missing required fields */
  readonly useDefaults: boolean;
  /** Attempt to infer values from context */
  readonly inferFromContext: boolean;
  /** Log warnings when using fallbacks */
  readonly logWarnings: boolean;
  /** Maximum attempts for recovery */
  readonly maxAttempts: number;
}

/**
 * Default fallback configuration
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  useDefaults: true,
  inferFromContext: true,
  logWarnings: true,
  maxAttempts: 3,
};

/**
 * Recovery context for tracking fallback attempts
 */
export interface RecoveryContext {
  readonly attempts: number;
  readonly errors: readonly ParseError[];
  readonly fallbacksUsed: readonly string[];
}

/**
 * Create initial recovery context
 */
export function createRecoveryContext(): RecoveryContext {
  return {
    attempts: 0,
    errors: [],
    fallbacksUsed: [],
  };
}

/**
 * Record a fallback being used
 */
export function recordFallback(
  context: RecoveryContext,
  fallback: string
): RecoveryContext {
  return {
    ...context,
    attempts: context.attempts + 1,
    fallbacksUsed: [...context.fallbacksUsed, fallback],
  };
}

/**
 * Record an error during recovery
 */
export function recordError(
  context: RecoveryContext,
  error: ParseError
): RecoveryContext {
  return {
    ...context,
    attempts: context.attempts + 1,
    errors: [...context.errors, error],
  };
}

/**
 * Create a minimal valid ParsedIssue from raw text
 * Used as ultimate fallback when normal parsing fails
 *
 * @param body - Raw issue body text
 * @param config - Fallback configuration
 * @returns Minimal parsed issue
 */
export function createFallbackIssue(
  body: string,
  config: FallbackConfig = DEFAULT_FALLBACK_CONFIG
): ParsedIssue {
  const source: IssueSource = inferSource(body) ?? DEFAULT_VALUES.source;
  const type: IssueType = inferType(body) ?? DEFAULT_VALUES.type;
  const priority: IssuePriority = inferPriority(body) ?? DEFAULT_VALUES.priority;

  return {
    source,
    type,
    problemDescription: extractFallbackDescription(body),
    context: {
      priority,
      relatedFiles: config.inferFromContext ? inferFilePaths(body) : [],
      relatedSymbols: config.inferFromContext ? inferSymbols(body) : [],
    },
    acceptanceCriteria: config.inferFromContext ? inferAcceptanceCriteria(body) : [],
    rawSections: {
      body,
    },
  };
}

/**
 * Infer source from raw text
 */
function inferSource(text: string): IssueSource | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('sentry')) return 'sentry';
  if (lower.includes('asana')) return 'asana';
  if (lower.includes('github')) return 'github';
  return undefined;
}

/**
 * Infer type from raw text
 */
function inferType(text: string): IssueType | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('bug') || lower.includes('error') || lower.includes('fix')) return 'bug';
  if (lower.includes('feature') || lower.includes('add') || lower.includes('new')) return 'feature';
  if (lower.includes('refactor') || lower.includes('cleanup')) return 'refactor';
  if (lower.includes('doc') || lower.includes('readme')) return 'docs';
  if (lower.includes('test')) return 'test';
  return undefined;
}

/**
 * Infer priority from raw text
 */
function inferPriority(text: string): IssuePriority | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('critical') || lower.includes('urgent') || lower.includes('p0')) return 'critical';
  if (lower.includes('high') || lower.includes('important') || lower.includes('p1')) return 'high';
  if (lower.includes('low') || lower.includes('minor')) return 'low';
  return undefined;
}

/**
 * Extract fallback description from raw text
 */
function extractFallbackDescription(text: string): string {
  // Remove markdown headings
  let cleaned = text.replace(/^#{1,6}\s+.+$/gm, '');

  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`[^`]+`/g, '');

  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Take first 500 characters
  if (cleaned.length > 500) {
    const lastSpace = cleaned.lastIndexOf(' ', 500);
    cleaned = cleaned.slice(0, lastSpace > 400 ? lastSpace : 500) + '...';
  }

  return cleaned || 'No description available';
}

/**
 * Infer file paths from raw text
 */
function inferFilePaths(text: string): string[] {
  const paths: string[] = [];
  const pattern = /(?:^|[\s`'"(])([./]?(?:[\w-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|php|vue|css|scss|html|json|yaml|yml|md))(?:$|[\s`'")\]:,])/gm;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const path = match[1];
    if (path && !paths.includes(path)) {
      paths.push(path);
    }
  }

  return paths.slice(0, 10); // Limit to 10 paths
}

/**
 * Infer symbols from raw text
 */
function inferSymbols(text: string): string[] {
  const symbols = new Set<string>();

  // Extract backtick code
  const backticks = text.match(/`([A-Za-z_$][A-Za-z0-9_$]*)`/g);
  if (backticks) {
    for (const bt of backticks) {
      const symbol = bt.slice(1, -1);
      if (symbol.length > 2) {
        symbols.add(symbol);
      }
    }
  }

  // Extract function-like patterns
  const functions = text.match(/\b([a-z_$][A-Za-z0-9_$]*)\s*\(/g);
  if (functions) {
    for (const fn of functions) {
      const name = fn.replace(/\s*\($/, '');
      if (name.length > 2 && !isCommonWord(name)) {
        symbols.add(name);
      }
    }
  }

  return Array.from(symbols).slice(0, 20); // Limit to 20 symbols
}

/**
 * Check if a word is too common to be a symbol
 */
function isCommonWord(word: string): boolean {
  const common = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'return', 'throw', 'try', 'catch', 'new', 'function', 'class',
    'import', 'export', 'from', 'const', 'let', 'var', 'async', 'await',
    'true', 'false', 'null', 'undefined', 'this', 'super',
  ]);
  return common.has(word.toLowerCase());
}

/**
 * Infer acceptance criteria from raw text
 */
function inferAcceptanceCriteria(text: string): ExtendedAcceptanceCriteria[] {
  const criteria: ExtendedAcceptanceCriteria[] = [];

  // Look for checkbox items
  const checkboxes = text.match(/^\s*[-*]\s*\[([ xX])\]\s*(.+)$/gm);
  if (checkboxes) {
    for (const cb of checkboxes) {
      const match = cb.match(/\[([ xX])\]\s*(.+)$/);
      if (match?.[2]) {
        criteria.push({
          description: match[2].trim(),
          completed: match[1]?.toLowerCase() === 'x',
        });
      }
    }
  }

  // Look for GIVEN-WHEN-THEN (using [\s\S] instead of 's' flag for ES2017 compatibility)
  const gwtMatch = text.match(/GIVEN\s+([\s\S]+?)\s+WHEN\s+([\s\S]+?)\s+THEN\s+([\s\S]+)/i);
  if (gwtMatch) {
    criteria.push({
      description: gwtMatch[0].trim(),
      completed: false,
      scenario: {
        given: gwtMatch[1]?.trim() ?? '',
        when: gwtMatch[2]?.trim() ?? '',
        then: gwtMatch[3]?.trim() ?? '',
      },
    });
  }

  return criteria.slice(0, 10); // Limit to 10 criteria
}

/**
 * Attempt to recover from a parse error
 *
 * @param error - The parse error
 * @param body - Original issue body
 * @param context - Recovery context
 * @param config - Fallback configuration
 * @returns Recovered parsed issue or null if recovery not possible
 */
export function attemptRecovery(
  error: ParseError,
  body: string,
  context: RecoveryContext,
  config: FallbackConfig = DEFAULT_FALLBACK_CONFIG
): ParsedIssue | null {
  if (context.attempts >= config.maxAttempts) {
    return null;
  }

  // For AST errors, fall back to text-based parsing
  if (error.code === 'AST_ERROR' || error.code === 'PARSE_ERROR') {
    return createFallbackIssue(body, config);
  }

  // For missing sections, create partial issue
  if (error.code === 'MISSING_SECTION') {
    return createFallbackIssue(body, config);
  }

  // For validation errors, try with defaults
  if (error.code === 'VALIDATION_ERROR' && config.useDefaults) {
    return createFallbackIssue(body, config);
  }

  return null;
}

/**
 * Create error message for logging
 */
export function formatRecoveryLog(
  context: RecoveryContext,
  result: 'success' | 'failure'
): string {
  const parts = [
    `Parse recovery ${result}`,
    `attempts: ${context.attempts}`,
  ];

  if (context.fallbacksUsed.length > 0) {
    parts.push(`fallbacks: ${context.fallbacksUsed.join(', ')}`);
  }

  if (context.errors.length > 0) {
    parts.push(`errors: ${context.errors.map((e) => e.code).join(', ')}`);
  }

  return parts.join(' | ');
}
