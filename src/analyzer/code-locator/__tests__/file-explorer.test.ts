/**
 * @module analyzer/code-locator/__tests__/file-explorer
 * @description Tests for file exploration utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as glob from 'glob';
import {
  findFiles,
  findFilesByName,
  findFilesByExtension,
  findFilesInDirectory,
  fileExists,
  resolvePartialPath,
  findSourceFiles,
} from '../file-explorer.js';

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('analyzer/code-locator/file-explorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findFiles', () => {
    it('should find files matching pattern', async () => {
      const mockFiles = ['src/foo.ts', 'src/bar.ts', 'lib/baz.ts'];
      vi.mocked(glob.glob).mockResolvedValue(mockFiles as never);

      const result = await findFiles('**/*.ts', '/project');

      expect(glob.glob).toHaveBeenCalledWith(
        '**/*.ts',
        expect.objectContaining({
          cwd: '/project',
          absolute: false,
          nodir: true,
        })
      );
      expect(result).toHaveLength(3);
    });

    it('should return absolute paths', async () => {
      vi.mocked(glob.glob).mockResolvedValue(['src/foo.ts'] as never);

      const result = await findFiles('**/*.ts', '/project');

      expect(result[0]).toMatch(/[/\\]project[/\\]src[/\\]foo\.ts$/);
    });

    it('should ignore node_modules', async () => {
      vi.mocked(glob.glob).mockResolvedValue([] as never);

      await findFiles('**/*.ts');

      expect(glob.glob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignore: expect.arrayContaining(['**/node_modules/**']),
        })
      );
    });

    it('should ignore test files', async () => {
      vi.mocked(glob.glob).mockResolvedValue([] as never);

      await findFiles('**/*.ts');

      expect(glob.glob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignore: expect.arrayContaining([
            '**/*.test.ts',
            '**/*.test.js',
            '**/*.spec.ts',
            '**/*.spec.js',
          ]),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(glob.glob).mockRejectedValue(new Error('Glob error'));

      const result = await findFiles('**/*.ts');

      expect(result).toEqual([]);
    });

    it('should use process.cwd() as default', async () => {
      vi.mocked(glob.glob).mockResolvedValue([] as never);

      await findFiles('**/*.ts');

      expect(glob.glob).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cwd: expect.any(String),
        })
      );
    });
  });

  describe('findFilesByName', () => {
    it('should find files by exact name', async () => {
      vi.mocked(glob.glob).mockResolvedValue(['src/foo.ts', 'lib/foo.ts'] as never);

      const result = await findFilesByName('foo.ts', '/project');

      expect(glob.glob).toHaveBeenCalledWith(
        '**/foo.ts',
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
    });

    it('should use process.cwd() as default', async () => {
      vi.mocked(glob.glob).mockResolvedValue([] as never);

      await findFilesByName('foo.ts');

      expect(glob.glob).toHaveBeenCalled();
    });
  });

  describe('findFilesByExtension', () => {
    it('should find files by extension with dot', async () => {
      vi.mocked(glob.glob).mockResolvedValue(['a.ts', 'b.ts'] as never);

      const result = await findFilesByExtension('.ts', '/project');

      expect(glob.glob).toHaveBeenCalledWith('**/*.ts', expect.any(Object));
      expect(result).toHaveLength(2);
    });

    it('should find files by extension without dot', async () => {
      vi.mocked(glob.glob).mockResolvedValue(['a.js'] as never);

      await findFilesByExtension('js', '/project');

      expect(glob.glob).toHaveBeenCalledWith('**/*.js', expect.any(Object));
    });

    it('should use process.cwd() as default', async () => {
      vi.mocked(glob.glob).mockResolvedValue([] as never);

      await findFilesByExtension('ts');

      expect(glob.glob).toHaveBeenCalled();
    });
  });

  describe('findFilesInDirectory', () => {
    it('should find files in directory', async () => {
      const mockEntries = [
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
        { name: 'file2.ts', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
      ];
      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as never);

      const result = await findFilesInDirectory('/project/src', '/project');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatch(/file1\.ts$/);
      expect(result[1]).toMatch(/file2\.ts$/);
    });

    it('should handle relative paths', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as never);

      await findFilesInDirectory('src', '/project');

      expect(fs.readdir).toHaveBeenCalledWith(
        expect.stringMatching(/project[/\\]src$/),
        expect.any(Object)
      );
    });

    it('should handle absolute paths', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as never);

      await findFilesInDirectory('/absolute/path', '/project');

      expect(fs.readdir).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]absolute[/\\]path$/),
        expect.any(Object)
      );
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Directory not found'));

      const result = await findFilesInDirectory('/nonexistent');

      expect(result).toEqual([]);
    });

    it('should use process.cwd() as default', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([] as never);

      await findFilesInDirectory('src');

      expect(fs.readdir).toHaveBeenCalled();
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
      } as never);

      const result = await fileExists('/path/to/file.ts');

      expect(result).toBe(true);
    });

    it('should return false for directory', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true,
      } as never);

      const result = await fileExists('/path/to/dir');

      expect(result).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await fileExists('/nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('resolvePartialPath', () => {
    it('should return absolute path if it exists', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
      } as never);

      const result = await resolvePartialPath('/absolute/path/file.ts');

      expect(result).toEqual(['/absolute/path/file.ts']);
    });

    it('should find files by name when relative path', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
      } as never);
      vi.mocked(glob.glob).mockResolvedValue([
        '/project/src/components/Button.tsx',
        '/project/lib/components/Button.tsx',
      ] as never);

      const result = await resolvePartialPath('components/Button.tsx', '/project');

      expect(result).toHaveLength(2);
    });

    it('should filter by matching path', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
      } as never);
      vi.mocked(glob.glob).mockResolvedValue([
        '/project/src/components/Button.tsx',
        '/project/lib/ui/Button.tsx',
      ] as never);

      const result = await resolvePartialPath('components/Button.tsx', '/project');

      expect(result.some(p => p.includes('components'))).toBe(true);
    });

    it('should handle Windows backslashes', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
      } as never);
      vi.mocked(glob.glob).mockResolvedValue([
        '/project/src/components/Button.tsx',
      ] as never);

      const result = await resolvePartialPath('src\\components\\Button.tsx', '/project');

      expect(result).toHaveLength(1);
    });

    it('should return all candidates if no exact match', async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => false,
      } as never);
      vi.mocked(glob.glob).mockResolvedValue([
        '/project/src/Button.tsx',
        '/project/lib/Button.tsx',
      ] as never);

      const result = await resolvePartialPath('other/Button.tsx', '/project');

      expect(result).toHaveLength(2);
    });
  });

  describe('findSourceFiles', () => {
    it('should find all source files', async () => {
      vi.mocked(glob.glob).mockImplementation(async (pattern) => {
        if (pattern === '**/*.ts') return ['src/foo.ts'] as never;
        if (pattern === '**/*.js') return ['lib/bar.js'] as never;
        if (pattern === '**/*.py') return ['app/main.py'] as never;
        return [] as never;
      });

      const result = await findSourceFiles('/project');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should include TypeScript files', async () => {
      vi.mocked(glob.glob).mockImplementation(async (pattern) => {
        if (pattern === '**/*.ts') return ['src/foo.ts'] as never;
        return [] as never;
      });

      const result = await findSourceFiles('/project');

      expect(result.some(f => f.endsWith('.ts'))).toBe(true);
    });

    it('should include JavaScript files', async () => {
      vi.mocked(glob.glob).mockImplementation(async (pattern) => {
        if (pattern === '**/*.js') return ['lib/bar.js'] as never;
        return [] as never;
      });

      const result = await findSourceFiles('/project');

      expect(result.some(f => f.endsWith('.js'))).toBe(true);
    });

    it('should include multiple language files', async () => {
      vi.mocked(glob.glob).mockImplementation(async (pattern) => {
        if (pattern === '**/*.ts') return ['src/foo.ts'] as never;
        if (pattern === '**/*.py') return ['app/main.py'] as never;
        if (pattern === '**/*.go') return ['cmd/server.go'] as never;
        return [] as never;
      });

      const result = await findSourceFiles('/project');

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should flatten results', async () => {
      vi.mocked(glob.glob).mockImplementation(async (pattern) => {
        if (pattern === '**/*.ts') return ['a.ts', 'b.ts'] as never;
        if (pattern === '**/*.js') return ['c.js'] as never;
        return [] as never;
      });

      const result = await findSourceFiles('/project');

      expect(Array.isArray(result)).toBe(true);
      expect(result.every(f => typeof f === 'string')).toBe(true);
    });
  });
});
