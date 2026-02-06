/**
 * @module workflow/code-fix-strategy/scope-analyzer
 * @description Analyze modification scope to detect overly broad changes
 */

import path from 'node:path';
import type { FileChange, ScopeAnalysis } from './types.js';
import {
  MAX_FILES_PER_FIX,
  MAX_DIRECTORIES_PER_FIX,
} from './constants.js';

/**
 * Analyze the scope of file changes
 *
 * @param changes - File changes to analyze
 * @returns Scope analysis result
 */
export function analyzeScope(
  changes: readonly FileChange[]
): ScopeAnalysis {
  const totalFiles = changes.length;
  const directories = extractDirectories(changes);
  const components = extractComponents(changes);

  const isTooBoard =
    totalFiles > MAX_FILES_PER_FIX ||
    directories.length > MAX_DIRECTORIES_PER_FIX;

  const result: ScopeAnalysis = {
    totalFiles,
    directories,
    isTooBoard,
    components,
  };

  if (isTooBoard) {
    (result as { warning?: string }).warning = generateWarning(totalFiles, directories.length);
  }

  return result;
}

/**
 * Extract unique directories from file changes
 *
 * @param changes - File changes
 * @returns Array of directory paths
 */
function extractDirectories(
  changes: readonly FileChange[]
): readonly string[] {
  const dirs = new Set<string>();

  for (const change of changes) {
    const dir = path.dirname(change.path);
    dirs.add(dir);
  }

  return Array.from(dirs).sort();
}

/**
 * Extract component names from file paths
 *
 * @param changes - File changes
 * @returns Array of component names
 */
function extractComponents(
  changes: readonly FileChange[]
): readonly string[] {
  const components = new Set<string>();

  for (const change of changes) {
    const parts = change.path.split(/[/\\]/);

    // Look for common component indicators
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (
        part === 'components' ||
        part === 'modules' ||
        part === 'features' ||
        part === 'packages'
      ) {
        const componentName = parts[i + 1];
        if (componentName) {
          components.add(componentName);
        }
      }
    }
  }

  return Array.from(components).sort();
}

/**
 * Generate warning message for overly broad changes
 *
 * @param totalFiles - Total number of files changed
 * @param totalDirs - Total number of directories affected
 * @returns Warning message
 */
function generateWarning(
  totalFiles: number,
  totalDirs: number
): string {
  const warnings: string[] = [];

  if (totalFiles > MAX_FILES_PER_FIX) {
    warnings.push(
      `Too many files changed: ${totalFiles} (max: ${MAX_FILES_PER_FIX})`
    );
  }

  if (totalDirs > MAX_DIRECTORIES_PER_FIX) {
    warnings.push(
      `Too many directories affected: ${totalDirs} (max: ${MAX_DIRECTORIES_PER_FIX})`
    );
  }

  return warnings.join('. ');
}

/**
 * Check if changes are within allowed scopes
 *
 * @param changes - File changes
 * @param allowedScopes - Allowed directory scopes
 * @returns True if all changes are within allowed scopes
 */
export function isWithinAllowedScopes(
  changes: readonly FileChange[],
  allowedScopes: readonly string[]
): boolean {
  if (allowedScopes.length === 0) {
    return true; // No restrictions
  }

  for (const change of changes) {
    const isAllowed = allowedScopes.some((scope) =>
      change.path.startsWith(scope)
    );

    if (!isAllowed) {
      return false;
    }
  }

  return true;
}

/**
 * Get files outside allowed scopes
 *
 * @param changes - File changes
 * @param allowedScopes - Allowed directory scopes
 * @returns Array of file paths outside allowed scopes
 */
export function getFilesOutsideScopes(
  changes: readonly FileChange[],
  allowedScopes: readonly string[]
): readonly string[] {
  if (allowedScopes.length === 0) {
    return [];
  }

  const outsideFiles: string[] = [];

  for (const change of changes) {
    const isAllowed = allowedScopes.some((scope) =>
      change.path.startsWith(scope)
    );

    if (!isAllowed) {
      outsideFiles.push(change.path);
    }
  }

  return outsideFiles;
}
