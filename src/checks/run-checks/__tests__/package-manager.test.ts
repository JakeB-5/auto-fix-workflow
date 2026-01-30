/**
 * @module checks/run-checks/__tests__/package-manager.test
 * @description Tests for package manager detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { detectPackageManager } from '../package-manager.js';

describe('detectPackageManager', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-pm-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should detect pnpm from pnpm-lock.yaml', async () => {
    await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('pnpm');
  });

  it('should detect yarn from yarn.lock', async () => {
    await fs.writeFile(path.join(tempDir, 'yarn.lock'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('yarn');
  });

  it('should detect npm from package-lock.json', async () => {
    await fs.writeFile(path.join(tempDir, 'package-lock.json'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('npm');
  });

  it('should prioritize pnpm over yarn', async () => {
    await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');
    await fs.writeFile(path.join(tempDir, 'yarn.lock'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('pnpm');
  });

  it('should prioritize yarn over npm', async () => {
    await fs.writeFile(path.join(tempDir, 'yarn.lock'), '');
    await fs.writeFile(path.join(tempDir, 'package-lock.json'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('yarn');
  });

  it('should default to npm when no lock file exists', async () => {
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('npm');
  });

  it('should handle non-existent directory gracefully', async () => {
    const nonExistentDir = path.join(tempDir, 'does-not-exist');
    const result = await detectPackageManager(nonExistentDir);
    expect(result).toBe('npm');
  });
});
