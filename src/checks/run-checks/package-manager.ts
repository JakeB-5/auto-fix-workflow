/**
 * @module checks/run-checks/package-manager
 * @description Package manager detection utilities
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { PackageManager } from '../../common/types/index.js';

/**
 * Detect package manager from lock files
 * @param cwd - Working directory to check
 * @returns Detected package manager
 */
export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  // Check for lock files in priority order
  const lockFiles: Array<{ file: string; manager: PackageManager }> = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'package-lock.json', manager: 'npm' },
  ];

  for (const { file, manager } of lockFiles) {
    const lockFilePath = path.join(cwd, file);
    try {
      await fs.access(lockFilePath);
      return manager;
    } catch {
      // File doesn't exist, continue
    }
  }

  // Default to npm if no lock file found
  return 'npm';
}
