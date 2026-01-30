/**
 * @module common/issue-parser/context-parser
 * @description Parse Context section from issue body
 */

import type { Root, Content } from 'mdast';
import type { IssuePriority, Result } from '../types/index.js';
import { ok, err, isFailure, isSuccess } from '../types/index.js';
import {
  findSection,
  getSectionText,
  extractText,
  extractListItems,
  isList,
} from './ast.js';
import type { ParseError } from './types.js';
import { SECTION_NAMES, DEFAULT_VALUES } from './types.js';

/**
 * Parsed context information
 */
export interface ParsedContext {
  readonly component?: string;
  readonly service?: string;
  readonly environment?: string;
  readonly priority?: IssuePriority;
  readonly relatedFiles: readonly string[];
  readonly relatedSymbols: readonly string[];
}

/**
 * Priority patterns for detection
 */
const PRIORITY_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly priority: IssuePriority;
}> = [
  { pattern: /priority:\s*critical/i, priority: 'critical' },
  { pattern: /priority:\s*high/i, priority: 'high' },
  { pattern: /priority:\s*medium/i, priority: 'medium' },
  { pattern: /priority:\s*low/i, priority: 'low' },
  { pattern: /\[critical\]/i, priority: 'critical' },
  { pattern: /\[high\]/i, priority: 'high' },
  { pattern: /\[medium\]/i, priority: 'medium' },
  { pattern: /\[low\]/i, priority: 'low' },
  { pattern: /\bp0\b|\bp1\b/i, priority: 'critical' },
  { pattern: /\bp2\b/i, priority: 'high' },
  { pattern: /\bp3\b/i, priority: 'medium' },
  { pattern: /\bp4\b|\bp5\b/i, priority: 'low' },
  { pattern: /\burgent\b|\bcritical\b|\bblocker\b/i, priority: 'critical' },
  { pattern: /\bhigh priority\b|\bimportant\b/i, priority: 'high' },
  { pattern: /\blow priority\b|\bminor\b/i, priority: 'low' },
];

/**
 * File path pattern (common file extensions and paths)
 */
const FILE_PATH_PATTERN = /(?:^|[\s`'"(])([./]?(?:[\w-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|php|vue|svelte|css|scss|less|html|json|yaml|yml|toml|md|sql|sh|bash|zsh))(?:$|[\s`'")\]:,])/gm;

/**
 * Symbol pattern (function/class/method names)
 */
const SYMBOL_PATTERNS = [
  // Function calls: functionName(
  /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
  // Class names: ClassName or new ClassName
  /(?:class|new|extends|implements)\s+([A-Z][A-Za-z0-9_$]*)/g,
  // Method references: object.method
  /\.([a-z_$][A-Za-z0-9_$]*)\s*\(/g,
  // Backtick code: `symbolName`
  /`([A-Za-z_$][A-Za-z0-9_$]*)`/g,
];

/**
 * Common symbols to exclude
 */
const EXCLUDED_SYMBOLS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
  'instanceof', 'void', 'this', 'super', 'class', 'extends', 'implements',
  'import', 'export', 'from', 'as', 'default', 'function', 'const', 'let',
  'var', 'async', 'await', 'yield', 'true', 'false', 'null', 'undefined',
  'console', 'log', 'error', 'warn', 'info', 'debug', 'print', 'string',
  'number', 'boolean', 'object', 'array', 'any', 'unknown', 'never', 'void',
]);

/**
 * Extract priority from text
 */
function extractPriority(text: string): IssuePriority | undefined {
  for (const { pattern, priority } of PRIORITY_PATTERNS) {
    if (pattern.test(text)) {
      return priority;
    }
  }
  return undefined;
}

/**
 * Extract file paths from text
 */
function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex
  FILE_PATH_PATTERN.lastIndex = 0;

  while ((match = FILE_PATH_PATTERN.exec(text)) !== null) {
    const path = match[1];
    if (path && !paths.includes(path)) {
      paths.push(path);
    }
  }

  // Also look for paths in backticks
  const backtickPaths = text.match(/`([./]?(?:[\w-]+\/)*[\w.-]+\.\w+)`/g);
  if (backtickPaths) {
    for (const bp of backtickPaths) {
      const path = bp.slice(1, -1); // Remove backticks
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
  }

  return paths;
}

/**
 * Extract symbols from text
 */
function extractSymbols(text: string): string[] {
  const symbols = new Set<string>();

  for (const pattern of SYMBOL_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const symbol = match[1];
      if (symbol && !EXCLUDED_SYMBOLS.has(symbol.toLowerCase()) && symbol.length > 1) {
        symbols.add(symbol);
      }
    }
  }

  return Array.from(symbols);
}

/**
 * Extract key-value pairs from text
 */
function extractKeyValue(text: string, key: string): string | undefined {
  // Try various formats: "Key: value", "Key = value", "**Key:** value"
  const patterns = [
    new RegExp(`\\*\\*${key}\\*\\*[:\\s]+([^\\n]+)`, 'i'),
    new RegExp(`${key}[:\\s]+([^\\n]+)`, 'i'),
    new RegExp(`${key}\\s*=\\s*([^\\n]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Parse lists in section content
 */
function parseListContent(content: readonly Content[]): string[] {
  const items: string[] = [];

  for (const node of content) {
    if (isList(node)) {
      items.push(...extractListItems([node]));
    }
  }

  return items;
}

/**
 * Parse the Context section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing parsed context information
 */
export function parseContext(ast: Root): Result<ParsedContext, ParseError> {
  const sectionResult = findSection(ast, SECTION_NAMES.CONTEXT);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.CONTEXT,
      cause: sectionResult.error,
    });
  }

  const section = sectionResult.data;

  // Collect text from entire document for extraction
  let fullText = '';
  for (const child of ast.children) {
    fullText += extractText(child) + '\n';
  }

  // If no Context section found, extract from full document
  if (section === null) {
    return ok({
      component: extractKeyValue(fullText, 'component'),
      service: extractKeyValue(fullText, 'service'),
      environment: extractKeyValue(fullText, 'environment') ?? extractKeyValue(fullText, 'env'),
      priority: extractPriority(fullText),
      relatedFiles: extractFilePaths(fullText),
      relatedSymbols: extractSymbols(fullText),
    });
  }

  const sectionText = getSectionText(section);

  // Parse context section
  const component = extractKeyValue(sectionText, 'component');
  const service = extractKeyValue(sectionText, 'service');
  const environment = extractKeyValue(sectionText, 'environment') ?? extractKeyValue(sectionText, 'env');
  const priority = extractPriority(sectionText) ?? extractPriority(fullText);

  // Check for Related Files subsection
  const relatedFilesSection = findSection(ast, SECTION_NAMES.RELATED_FILES);
  let relatedFiles: string[];

  if (isSuccess(relatedFilesSection) && relatedFilesSection.data !== null) {
    const filesList = parseListContent(relatedFilesSection.data.content);
    relatedFiles = filesList.length > 0 ? filesList : extractFilePaths(sectionText);
  } else {
    relatedFiles = extractFilePaths(sectionText);
    // If no files in context section, try full document
    if (relatedFiles.length === 0) {
      relatedFiles = extractFilePaths(fullText);
    }
  }

  // Check for Related Symbols subsection
  const relatedSymbolsSection = findSection(ast, SECTION_NAMES.RELATED_SYMBOLS);
  let relatedSymbols: string[];

  if (isSuccess(relatedSymbolsSection) && relatedSymbolsSection.data !== null) {
    const symbolsList = parseListContent(relatedSymbolsSection.data.content);
    relatedSymbols = symbolsList.length > 0 ? symbolsList : extractSymbols(sectionText);
  } else {
    relatedSymbols = extractSymbols(sectionText);
  }

  return ok({
    component,
    service,
    environment,
    priority,
    relatedFiles,
    relatedSymbols,
  });
}

/**
 * Parse context from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Parsed context information
 */
export function parseContextFromText(text: string): ParsedContext {
  return {
    component: extractKeyValue(text, 'component'),
    service: extractKeyValue(text, 'service'),
    environment: extractKeyValue(text, 'environment') ?? extractKeyValue(text, 'env'),
    priority: extractPriority(text) ?? DEFAULT_VALUES.priority,
    relatedFiles: extractFilePaths(text),
    relatedSymbols: extractSymbols(text),
  };
}
