/**
 * @module analyzer/code-locator/file-explorer
 * @description Progressive file exploration using glob patterns
 */

import { glob } from 'glob';
import path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * Find files matching a glob pattern
 *
 * @param pattern - Glob pattern (e.g., "**\/*.ts", "src/**\/*.js")
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Promise resolving to array of matching file paths
 */
export async function findFiles(
  pattern: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  try {
    const files = await glob(pattern, {
      cwd,
      absolute: false,
      nodir: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.test.ts',
        '**/*.test.js',
        '**/*.spec.ts',
        '**/*.spec.js',
      ],
    });

    return files.map(file => path.resolve(cwd, file));
  } catch (error) {
    console.error(`Error finding files with pattern "${pattern}":`, error);
    return [];
  }
}

/**
 * Find files by exact name
 *
 * @param fileName - File name to search for
 * @param cwd - Working directory
 * @returns Promise resolving to array of matching file paths
 */
export async function findFilesByName(
  fileName: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  const pattern = `**/${fileName}`;
  return findFiles(pattern, cwd);
}

/**
 * Find files by extension
 *
 * @param extension - File extension (with or without dot)
 * @param cwd - Working directory
 * @returns Promise resolving to array of matching file paths
 */
export async function findFilesByExtension(
  extension: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const pattern = `**/*${ext}`;
  return findFiles(pattern, cwd);
}

/**
 * Find files in specific directory
 *
 * @param directory - Directory path
 * @param cwd - Working directory
 * @returns Promise resolving to array of file paths in directory
 */
export async function findFilesInDirectory(
  directory: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  const dirPath = path.isAbsolute(directory)
    ? directory
    : path.resolve(cwd, directory);

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(path.join(dirPath, entry.name));
      }
    }

    return files;
  } catch (error) {
    console.error(`Error reading directory "${dirPath}":`, error);
    return [];
  }
}

/**
 * Check if file exists
 *
 * @param filePath - File path to check
 * @returns Promise resolving to true if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve partial file path to full paths
 * Useful for stack traces with relative or partial paths
 *
 * @param partialPath - Partial file path
 * @param cwd - Working directory
 * @returns Promise resolving to array of possible full paths
 */
export async function resolvePartialPath(
  partialPath: string,
  cwd: string = process.cwd()
): Promise<string[]> {
  // If it's an absolute path and exists, return it directly
  if (path.isAbsolute(partialPath)) {
    const exists = await fileExists(partialPath);
    if (exists) {
      return [partialPath];
    }
  }

  // Clean up the path
  const cleanPath = partialPath.replace(/\\/g, '/');

  // Extract filename
  const fileName = path.basename(cleanPath);

  // Find all files with this name
  const candidates = await findFilesByName(fileName, cwd);

  // Filter candidates that match the partial path
  const matches = candidates.filter(candidate => {
    const candidateNormalized = candidate.replace(/\\/g, '/');
    return candidateNormalized.includes(cleanPath) ||
           candidateNormalized.endsWith(cleanPath);
  });

  return matches.length > 0 ? matches : candidates;
}

/**
 * Find source files (common programming languages)
 *
 * @param cwd - Working directory
 * @returns Promise resolving to array of source file paths
 */
export async function findSourceFiles(
  cwd: string = process.cwd()
): Promise<string[]> {
  const extensions = ['ts', 'js', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h'];
  const patterns = extensions.map(ext => `**/*.${ext}`);

  const results = await Promise.all(
    patterns.map(pattern => findFiles(pattern, cwd))
  );

  return results.flat();
}
