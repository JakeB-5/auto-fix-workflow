/**
 * @module workflow/code-fix-strategy/__tests__/scope-analyzer
 * @description Tests for scope analysis
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeScope,
  isWithinAllowedScopes,
  getFilesOutsideScopes,
} from '../scope-analyzer.js';
import {
  MAX_FILES_PER_FIX,
  MAX_DIRECTORIES_PER_FIX,
} from '../constants.js';
import type { FileChange } from '../types.js';

/**
 * Helper to create a FileChange
 */
function createChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    path: 'src/app.ts',
    type: 'modified',
    additions: 5,
    deletions: 2,
    ...overrides,
  };
}

describe('scope-analyzer', () => {
  describe('analyzeScope', () => {
    it('should count total files', () => {
      const changes = [
        createChange({ path: 'src/a.ts' }),
        createChange({ path: 'src/b.ts' }),
        createChange({ path: 'src/c.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.totalFiles).toBe(3);
    });

    it('should extract unique directories', () => {
      const changes = [
        createChange({ path: 'src/a.ts' }),
        createChange({ path: 'src/b.ts' }),
        createChange({ path: 'lib/c.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.directories).toContain('src');
      expect(analysis.directories).toContain('lib');
      expect(analysis.directories).toHaveLength(2);
    });

    it('should sort directories', () => {
      const changes = [
        createChange({ path: 'src/a.ts' }),
        createChange({ path: 'lib/b.ts' }),
        createChange({ path: 'app/c.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.directories).toEqual(['app', 'lib', 'src']);
    });

    it('should not flag as too broad for small changes', () => {
      const changes = [
        createChange({ path: 'src/a.ts' }),
        createChange({ path: 'src/b.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.isTooBoard).toBe(false);
    });

    it('should flag as too broad when exceeding max files', () => {
      const changes = Array.from(
        { length: MAX_FILES_PER_FIX + 1 },
        (_, i) => createChange({ path: `src/file${i}.ts` })
      );

      const analysis = analyzeScope(changes);

      expect(analysis.isTooBoard).toBe(true);
    });

    it('should flag as too broad when exceeding max directories', () => {
      const changes = Array.from(
        { length: MAX_DIRECTORIES_PER_FIX + 1 },
        (_, i) => createChange({ path: `dir${i}/file.ts` })
      );

      const analysis = analyzeScope(changes);

      expect(analysis.isTooBoard).toBe(true);
    });

    it('should include warning message when too broad by files', () => {
      const changes = Array.from(
        { length: MAX_FILES_PER_FIX + 1 },
        (_, i) => createChange({ path: `src/file${i}.ts` })
      );

      const analysis = analyzeScope(changes);
      const warning = (analysis as { warning?: string }).warning;

      expect(warning).toBeDefined();
      expect(warning).toContain('Too many files');
      expect(warning).toContain(String(MAX_FILES_PER_FIX));
    });

    it('should include warning message when too broad by directories', () => {
      const changes = Array.from(
        { length: MAX_DIRECTORIES_PER_FIX + 1 },
        (_, i) => createChange({ path: `dir${i}/file.ts` })
      );

      const analysis = analyzeScope(changes);
      const warning = (analysis as { warning?: string }).warning;

      expect(warning).toBeDefined();
      expect(warning).toContain('Too many directories');
      expect(warning).toContain(String(MAX_DIRECTORIES_PER_FIX));
    });

    it('should not include warning when within limits', () => {
      const changes = [createChange({ path: 'src/a.ts' })];

      const analysis = analyzeScope(changes);
      const warning = (analysis as { warning?: string }).warning;

      expect(warning).toBeUndefined();
    });

    it('should extract components from "components" directory', () => {
      const changes = [
        createChange({ path: 'src/components/Button/index.ts' }),
        createChange({ path: 'src/components/Modal/index.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toContain('Button');
      expect(analysis.components).toContain('Modal');
    });

    it('should extract components from "modules" directory', () => {
      const changes = [
        createChange({ path: 'src/modules/billing/invoice.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toContain('billing');
    });

    it('should extract components from "features" directory', () => {
      const changes = [
        createChange({ path: 'src/features/settings/theme.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toContain('settings');
    });

    it('should extract components from "packages" directory', () => {
      const changes = [
        createChange({ path: 'packages/core/index.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toContain('core');
    });

    it('should sort components', () => {
      const changes = [
        createChange({ path: 'src/components/Zebra/index.ts' }),
        createChange({ path: 'src/components/Alpha/index.ts' }),
        createChange({ path: 'src/components/Middle/index.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('should deduplicate components', () => {
      const changes = [
        createChange({ path: 'src/components/Button/index.ts' }),
        createChange({ path: 'src/components/Button/styles.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toHaveLength(1);
      expect(analysis.components[0]).toBe('Button');
    });

    it('should return empty components for non-component paths', () => {
      const changes = [
        createChange({ path: 'src/utils.ts' }),
        createChange({ path: 'lib/helpers.ts' }),
      ];

      const analysis = analyzeScope(changes);

      expect(analysis.components).toHaveLength(0);
    });

    it('should handle empty changes', () => {
      const analysis = analyzeScope([]);

      expect(analysis.totalFiles).toBe(0);
      expect(analysis.directories).toHaveLength(0);
      expect(analysis.components).toHaveLength(0);
      expect(analysis.isTooBoard).toBe(false);
    });

    it('should handle nested directory paths', () => {
      const changes = [
        createChange({ path: 'src/deep/nested/file.ts' }),
      ];

      const analysis = analyzeScope(changes);

      // path.dirname gives "src/deep/nested"
      expect(analysis.directories).toHaveLength(1);
    });
  });

  describe('isWithinAllowedScopes', () => {
    it('should return true when all changes are in allowed scopes', () => {
      const changes = [
        createChange({ path: 'src/app.ts' }),
        createChange({ path: 'src/utils.ts' }),
      ];

      expect(isWithinAllowedScopes(changes, ['src/'])).toBe(true);
    });

    it('should return false when a change is outside allowed scopes', () => {
      const changes = [
        createChange({ path: 'src/app.ts' }),
        createChange({ path: 'config/settings.ts' }),
      ];

      expect(isWithinAllowedScopes(changes, ['src/'])).toBe(false);
    });

    it('should return true when no restrictions (empty allowedScopes)', () => {
      const changes = [
        createChange({ path: 'anywhere/file.ts' }),
      ];

      expect(isWithinAllowedScopes(changes, [])).toBe(true);
    });

    it('should support multiple allowed scopes', () => {
      const changes = [
        createChange({ path: 'src/app.ts' }),
        createChange({ path: 'lib/utils.ts' }),
      ];

      expect(isWithinAllowedScopes(changes, ['src/', 'lib/'])).toBe(true);
    });

    it('should handle empty changes array', () => {
      expect(isWithinAllowedScopes([], ['src/'])).toBe(true);
    });

    it('should be prefix-based matching', () => {
      const changes = [
        createChange({ path: 'src/deep/nested/file.ts' }),
      ];

      expect(isWithinAllowedScopes(changes, ['src/'])).toBe(true);
    });

    it('should reject partial path matches', () => {
      const changes = [
        createChange({ path: 'source/file.ts' }),
      ];

      // "source/" does not start with "src/"
      expect(isWithinAllowedScopes(changes, ['src/'])).toBe(false);
    });
  });

  describe('getFilesOutsideScopes', () => {
    it('should return files outside allowed scopes', () => {
      const changes = [
        createChange({ path: 'src/app.ts' }),
        createChange({ path: 'config/db.ts' }),
        createChange({ path: 'scripts/deploy.ts' }),
      ];

      const outside = getFilesOutsideScopes(changes, ['src/']);

      expect(outside).toHaveLength(2);
      expect(outside).toContain('config/db.ts');
      expect(outside).toContain('scripts/deploy.ts');
    });

    it('should return empty array when all within scopes', () => {
      const changes = [
        createChange({ path: 'src/a.ts' }),
        createChange({ path: 'src/b.ts' }),
      ];

      const outside = getFilesOutsideScopes(changes, ['src/']);

      expect(outside).toHaveLength(0);
    });

    it('should return empty array when no restrictions', () => {
      const changes = [
        createChange({ path: 'anywhere/file.ts' }),
      ];

      const outside = getFilesOutsideScopes(changes, []);

      expect(outside).toHaveLength(0);
    });

    it('should handle multiple allowed scopes', () => {
      const changes = [
        createChange({ path: 'src/a.ts' }),
        createChange({ path: 'lib/b.ts' }),
        createChange({ path: 'config/c.ts' }),
      ];

      const outside = getFilesOutsideScopes(changes, ['src/', 'lib/']);

      expect(outside).toEqual(['config/c.ts']);
    });

    it('should handle empty changes', () => {
      const outside = getFilesOutsideScopes([], ['src/']);

      expect(outside).toHaveLength(0);
    });

    it('should return all files when none match allowed scopes', () => {
      const changes = [
        createChange({ path: 'config/a.ts' }),
        createChange({ path: 'scripts/b.ts' }),
      ];

      const outside = getFilesOutsideScopes(changes, ['src/']);

      expect(outside).toHaveLength(2);
    });
  });
});
