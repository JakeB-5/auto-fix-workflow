/**
 * @module asana/analyze-task/codebase
 * @description Codebase exploration for task context
 */

import type { FormattedTaskDetail } from '../get-task/tool.js';
import { extractFilePaths, extractSymbols } from './heuristics.js';

/** Codebase context */
export interface CodebaseContext {
  /** Files mentioned in task that exist */
  readonly existingFiles: readonly FileInfo[];
  /** Files mentioned that don't exist */
  readonly missingFiles: readonly string[];
  /** Symbols found in codebase */
  readonly foundSymbols: readonly SymbolInfo[];
  /** Symbols mentioned but not found */
  readonly missingSymbols: readonly string[];
  /** Related files (by similarity) */
  readonly relatedFiles: readonly FileInfo[];
  /** Test files for mentioned source files */
  readonly testFiles: readonly FileInfo[];
}

/** File information */
export interface FileInfo {
  readonly path: string;
  readonly exists: boolean;
  readonly type: FileType;
  readonly estimatedLines?: number;
}

/** Symbol information */
export interface SymbolInfo {
  readonly name: string;
  readonly type: 'function' | 'class' | 'variable' | 'type' | 'unknown';
  readonly file?: string;
  readonly line?: number;
}

/** File type classification */
export type FileType =
  | 'source'
  | 'test'
  | 'config'
  | 'docs'
  | 'style'
  | 'asset'
  | 'unknown';

/** Codebase exploration options */
export interface ExploreOptions {
  /** Root directory for exploration */
  readonly rootDir?: string;
  /** Maximum files to scan */
  readonly maxFiles?: number;
  /** Include test file discovery */
  readonly findTests?: boolean;
  /** Include related file discovery */
  readonly findRelated?: boolean;
}

/**
 * Explore codebase for task context (stub implementation)
 *
 * This is a placeholder that extracts information from task description
 * without actually accessing the filesystem. Full implementation would
 * integrate with file system operations.
 *
 * @param task - Task details
 * @param _options - Exploration options
 * @returns Codebase context
 */
export async function exploreCodebase(
  task: FormattedTaskDetail,
  _options: ExploreOptions = {}
): Promise<CodebaseContext> {
  const filePaths = extractFilePaths(task.markdownDescription);
  const symbols = extractSymbols(task.markdownDescription);

  // Convert to FileInfo (all marked as potentially existing)
  const mentionedFiles: FileInfo[] = filePaths.map((path) => ({
    path,
    exists: true, // Would be verified by actual filesystem check
    type: classifyFileType(path),
  }));

  // Convert to SymbolInfo
  const mentionedSymbols: SymbolInfo[] = symbols.map((name) => ({
    name,
    type: guessSymbolType(name),
  }));

  // Find potential test files
  const testFiles: FileInfo[] = mentionedFiles
    .filter((f) => f.type === 'source')
    .map((f) => guessTestFile(f.path))
    .filter((f): f is FileInfo => f !== null);

  return {
    existingFiles: mentionedFiles,
    missingFiles: [],
    foundSymbols: mentionedSymbols,
    missingSymbols: [],
    relatedFiles: [],
    testFiles,
  };
}

/**
 * Classify file type based on path
 *
 * @param path - File path
 * @returns File type
 */
export function classifyFileType(path: string): FileType {
  const lower = path.toLowerCase();

  // Test files
  if (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__') ||
    lower.includes('__mocks__')
  ) {
    return 'test';
  }

  // Config files
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.toml') ||
    lower.includes('config') ||
    lower.includes('.rc')
  ) {
    return 'config';
  }

  // Documentation
  if (lower.endsWith('.md') || lower.endsWith('.mdx') || lower.includes('docs/')) {
    return 'docs';
  }

  // Styles
  if (
    lower.endsWith('.css') ||
    lower.endsWith('.scss') ||
    lower.endsWith('.less') ||
    lower.endsWith('.sass')
  ) {
    return 'style';
  }

  // Assets
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.svg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico')
  ) {
    return 'asset';
  }

  // Source files
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.py') ||
    lower.endsWith('.go') ||
    lower.endsWith('.rs')
  ) {
    return 'source';
  }

  return 'unknown';
}

/**
 * Guess symbol type from name
 *
 * @param name - Symbol name
 * @returns Symbol type
 */
function guessSymbolType(
  name: string
): 'function' | 'class' | 'variable' | 'type' | 'unknown' {
  // PascalCase usually indicates class or type
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
    // Interface/Type naming conventions
    if (name.startsWith('I') && name.length > 1 && /^I[A-Z]/.test(name)) {
      return 'type';
    }
    if (name.endsWith('Type') || name.endsWith('Interface')) {
      return 'type';
    }
    return 'class';
  }

  // camelCase with verb prefix usually indicates function
  const verbPrefixes = [
    'get', 'set', 'is', 'has', 'can', 'should', 'will',
    'create', 'update', 'delete', 'fetch', 'load', 'save',
    'handle', 'on', 'do', 'make', 'build', 'parse', 'format',
  ];
  if (verbPrefixes.some((prefix) => name.startsWith(prefix))) {
    return 'function';
  }

  // ALL_CAPS usually indicates constant
  if (/^[A-Z_][A-Z0-9_]*$/.test(name)) {
    return 'variable';
  }

  return 'unknown';
}

/**
 * Guess test file path for a source file
 *
 * @param sourcePath - Source file path
 * @returns Potential test file info or null
 */
function guessTestFile(sourcePath: string): FileInfo | null {
  // Common test file patterns
  const patterns = [
    (p: string) => p.replace(/\.([^.]+)$/, '.test.$1'),
    (p: string) => p.replace(/\.([^.]+)$/, '.spec.$1'),
    (p: string) => p.replace(/\/([^/]+)$/, '/__tests__/$1'),
  ];

  for (const pattern of patterns) {
    const testPath = pattern(sourcePath);
    if (testPath !== sourcePath) {
      return {
        path: testPath,
        exists: false, // Would need actual filesystem check
        type: 'test',
      };
    }
  }

  return null;
}

/**
 * Find related files based on naming similarity
 *
 * @param baseName - Base file name
 * @param files - All available files
 * @returns Related file paths
 */
export function findRelatedFiles(
  baseName: string,
  files: readonly string[]
): string[] {
  const base = baseName.toLowerCase().replace(/\.[^.]+$/, '');
  const related: string[] = [];

  for (const file of files) {
    const fileLower = file.toLowerCase();

    // Same base name, different extension
    if (fileLower.includes(base) && file !== baseName) {
      related.push(file);
    }
  }

  return related;
}

/**
 * Get common file patterns for a component type
 *
 * @param componentName - Component or module name
 * @returns Array of potential file patterns
 */
export function getFilePatterns(componentName: string): string[] {
  const name = componentName.toLowerCase();
  const pascalName =
    componentName.charAt(0).toUpperCase() + componentName.slice(1);

  return [
    // Source files
    `${name}.ts`,
    `${name}.tsx`,
    `${name}.js`,
    `${pascalName}.ts`,
    `${pascalName}.tsx`,
    // Index files
    `${name}/index.ts`,
    `${name}/index.tsx`,
    // Test files
    `${name}.test.ts`,
    `${name}.test.tsx`,
    `${name}.spec.ts`,
    `__tests__/${name}.test.ts`,
    // Type files
    `${name}.types.ts`,
    `types/${name}.ts`,
    // Style files
    `${name}.css`,
    `${name}.module.css`,
    `${name}.scss`,
  ];
}
