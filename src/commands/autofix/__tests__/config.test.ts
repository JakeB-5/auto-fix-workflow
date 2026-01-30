/**
 * @module commands/autofix/__tests__/config.test
 * @description Unit tests for autofix config parsing
 */

import { describe, it, expect } from 'vitest';
import { parseArgs, AutofixArgsSchema } from '../config.js';
import type { AutofixOptions } from '../types.js';

describe('AutofixArgsSchema', () => {
  describe('--all flag', () => {
    it('should parse --all flag correctly', () => {
      const result = AutofixArgsSchema.parse({ all: true });
      expect(result.all).toBe(true);
    });

    it('should default --all to false', () => {
      const result = AutofixArgsSchema.parse({});
      expect(result.all).toBe(false);
    });

    it('should reject --all with --issues', () => {
      expect(() => {
        AutofixArgsSchema.parse({
          all: true,
          issues: '123,456',
        });
      }).toThrow(/Cannot use --all and --issues together/);
    });

    it('should allow --all with --dry-run', () => {
      const result = AutofixArgsSchema.parse({
        all: true,
        dryRun: true,
      });
      expect(result.all).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should allow --all with other flags', () => {
      const result = AutofixArgsSchema.parse({
        all: true,
        verbose: true,
        maxParallel: 5,
        groupBy: 'file',
      });
      expect(result.all).toBe(true);
      expect(result.verbose).toBe(true);
      expect(result.maxParallel).toBe(5);
      expect(result.groupBy).toBe('file');
    });
  });
});

describe('parseArgs', () => {
  it('should include all flag in options when set', () => {
    const options = parseArgs({ all: true });
    expect(options.all).toBe(true);
  });

  it('should not include all flag when false', () => {
    const options = parseArgs({ all: false });
    expect(options.all).toBeUndefined();
  });

  it('should throw when both --all and --issues are provided', () => {
    expect(() => {
      parseArgs({
        all: true,
        issues: [123, 456],
      });
    }).toThrow(/Cannot use --all and --issues together/);
  });

  it('should allow --all with --dry-run in options', () => {
    const options = parseArgs({
      all: true,
      dryRun: true,
    });
    expect(options.all).toBe(true);
    expect(options.dryRun).toBe(true);
  });

  it('should parse --all with verbose and maxParallel', () => {
    const options = parseArgs({
      all: true,
      verbose: true,
      maxParallel: 5,
    });
    expect(options.all).toBe(true);
    expect(options.verbose).toBe(true);
    expect(options.maxParallel).toBe(5);
  });
});
