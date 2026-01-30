/**
 * @fileoverview Unit tests for CLI parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  getHelpMessage,
  HelpRequestedError,
  VersionRequestedError,
  formatOptions,
} from '../cli.js';
import type { InitOptions } from '../types.js';

describe('CLI Parser', () => {
  describe('parseArgs', () => {
    describe('default behavior', () => {
      it('should return default options when no args provided', () => {
        const result = parseArgs([]);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({
            nonInteractive: false,
            force: false,
            skipValidation: false,
          });
        }
      });
    });

    describe('long flags', () => {
      it('should parse --non-interactive flag', () => {
        const result = parseArgs(['--non-interactive']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(false);
          expect(result.data.skipValidation).toBe(false);
        }
      });

      it('should parse --force flag', () => {
        const result = parseArgs(['--force']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.force).toBe(true);
          expect(result.data.nonInteractive).toBe(false);
          expect(result.data.skipValidation).toBe(false);
        }
      });

      it('should parse --skip-validation flag', () => {
        const result = parseArgs(['--skip-validation']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.skipValidation).toBe(true);
          expect(result.data.nonInteractive).toBe(false);
          expect(result.data.force).toBe(false);
        }
      });

      it('should parse multiple long flags', () => {
        const result = parseArgs(['--non-interactive', '--force', '--skip-validation']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
        }
      });

      it('should handle flags in any order', () => {
        const result = parseArgs(['--skip-validation', '--non-interactive', '--force']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
        }
      });
    });

    describe('short flags', () => {
      it('should parse -n flag (non-interactive)', () => {
        const result = parseArgs(['-n']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(false);
          expect(result.data.skipValidation).toBe(false);
        }
      });

      it('should parse -f flag (force)', () => {
        const result = parseArgs(['-f']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.force).toBe(true);
          expect(result.data.nonInteractive).toBe(false);
          expect(result.data.skipValidation).toBe(false);
        }
      });

      it('should parse -s flag (skip-validation)', () => {
        const result = parseArgs(['-s']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.skipValidation).toBe(true);
          expect(result.data.nonInteractive).toBe(false);
          expect(result.data.force).toBe(false);
        }
      });

      it('should parse multiple short flags separately', () => {
        const result = parseArgs(['-n', '-f', '-s']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
        }
      });
    });

    describe('combined short flags', () => {
      it('should parse -nf (non-interactive + force)', () => {
        const result = parseArgs(['-nf']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(false);
        }
      });

      it('should parse -ns (non-interactive + skip-validation)', () => {
        const result = parseArgs(['-ns']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.skipValidation).toBe(true);
          expect(result.data.force).toBe(false);
        }
      });

      it('should parse -fs (force + skip-validation)', () => {
        const result = parseArgs(['-fs']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
          expect(result.data.nonInteractive).toBe(false);
        }
      });

      it('should parse -nfs (all three flags combined)', () => {
        const result = parseArgs(['-nfs']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
        }
      });

      it('should parse -sfn (flags in different order)', () => {
        const result = parseArgs(['-sfn']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
        }
      });
    });

    describe('mixed short and long flags', () => {
      it('should parse mix of short and long flags', () => {
        const result = parseArgs(['-n', '--force']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(false);
        }
      });

      it('should parse long flag first then short', () => {
        const result = parseArgs(['--skip-validation', '-nf']);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.nonInteractive).toBe(true);
          expect(result.data.force).toBe(true);
          expect(result.data.skipValidation).toBe(true);
        }
      });
    });

    describe('help flag', () => {
      it('should throw HelpRequestedError for --help', () => {
        const result = parseArgs(['--help']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error).toBeInstanceOf(HelpRequestedError);
          expect(result.error.name).toBe('HelpRequestedError');
          if (result.error instanceof HelpRequestedError) {
            expect(result.error.helpText).toContain('Usage: auto-fix-workflow init');
          }
        }
      });

      it('should throw HelpRequestedError for -h', () => {
        const result = parseArgs(['-h']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error).toBeInstanceOf(HelpRequestedError);
        }
      });

      it('should throw help before processing other flags', () => {
        const result = parseArgs(['--force', '--help', '--non-interactive']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error).toBeInstanceOf(HelpRequestedError);
        }
      });
    });

    describe('version flag', () => {
      it('should throw VersionRequestedError for --version', () => {
        const result = parseArgs(['--version']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error).toBeInstanceOf(VersionRequestedError);
          expect(result.error.name).toBe('VersionRequestedError');
          if (result.error instanceof VersionRequestedError) {
            expect(result.error.version).toContain('auto-fix-workflow init');
          }
        }
      });
    });

    describe('error handling', () => {
      it('should error on unknown long flag', () => {
        const result = parseArgs(['--unknown-flag']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unknown flag: --unknown-flag');
        }
      });

      it('should error on unknown short flag', () => {
        const result = parseArgs(['-x']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unknown flag: -x');
        }
      });

      it('should error on unknown flag in combined short flags', () => {
        const result = parseArgs(['-nfx']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unknown flag: -x');
        }
      });

      it('should error on unexpected positional argument', () => {
        const result = parseArgs(['some-arg']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unexpected argument: some-arg');
        }
      });

      it('should collect multiple errors', () => {
        const result = parseArgs(['--unknown1', 'positional', '--unknown2']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('unknown1');
          expect(result.error.message).toContain('positional');
          expect(result.error.message).toContain('unknown2');
        }
      });
    });

    describe('edge cases', () => {
      it('should handle empty string argument', () => {
        const result = parseArgs(['']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unexpected argument');
        }
      });

      it('should handle flag-like positional argument', () => {
        const result = parseArgs(['--', '--force']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          // First -- is treated as unknown flag
          expect(result.error.message).toContain('Unknown flag: --');
        }
      });

      it('should handle single dash', () => {
        const result = parseArgs(['-']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unexpected argument: -');
        }
      });

      it('should handle double dash alone', () => {
        const result = parseArgs(['--']);

        expect(result.success).toBe(false);
        if (result.success === false) {
          expect(result.error.message).toContain('Unknown flag: --');
        }
      });
    });
  });

  describe('getHelpMessage', () => {
    it('should return help message with usage', () => {
      const help = getHelpMessage();

      expect(help).toContain('Usage: auto-fix-workflow init');
      expect(help).toContain('Options:');
    });

    it('should include all flag descriptions', () => {
      const help = getHelpMessage();

      expect(help).toContain('-n, --non-interactive');
      expect(help).toContain('-f, --force');
      expect(help).toContain('-s, --skip-validation');
      expect(help).toContain('-h, --help');
    });

    it('should have proper formatting', () => {
      const help = getHelpMessage();
      const lines = help.split('\n');

      // Should have multiple lines
      expect(lines.length).toBeGreaterThan(3);

      // Should have consistent indentation for options
      const optionLines = lines.filter(
        (line) => line.trim().startsWith('-') && line.includes('--')
      );
      expect(optionLines.length).toBeGreaterThan(0);

      // Each option line should have description
      for (const line of optionLines) {
        expect(line.length).toBeGreaterThan(20);
      }
    });
  });

  describe('HelpRequestedError', () => {
    it('should create error with help text', () => {
      const helpText = 'Test help text';
      const error = new HelpRequestedError(helpText);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HelpRequestedError');
      expect(error.message).toBe('Help requested');
      expect(error.helpText).toBe(helpText);
    });

    it('should preserve help text in error instance', () => {
      const help = getHelpMessage();
      const error = new HelpRequestedError(help);

      expect(error.helpText).toBe(help);
      expect(error.helpText).toContain('Usage:');
    });
  });

  describe('VersionRequestedError', () => {
    it('should create error with version string', () => {
      const version = 'v1.2.3';
      const error = new VersionRequestedError(version);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('VersionRequestedError');
      expect(error.message).toBe('Version requested');
      expect(error.version).toBe(version);
    });
  });

  describe('formatOptions', () => {
    it('should format default options', () => {
      const options: InitOptions = {
        nonInteractive: false,
        force: false,
        skipValidation: false,
      };

      const formatted = formatOptions(options);

      expect(formatted).toContain('Init Options:');
      expect(formatted).toContain('Non-Interactive: no');
      expect(formatted).toContain('Force Overwrite: no');
      expect(formatted).toContain('Skip Validation: no');
    });

    it('should format options with all flags enabled', () => {
      const options: InitOptions = {
        nonInteractive: true,
        force: true,
        skipValidation: true,
      };

      const formatted = formatOptions(options);

      expect(formatted).toContain('Non-Interactive: yes');
      expect(formatted).toContain('Force Overwrite: yes');
      expect(formatted).toContain('Skip Validation: yes');
    });

    it('should format options with mixed flags', () => {
      const options: InitOptions = {
        nonInteractive: true,
        force: false,
        skipValidation: true,
      };

      const formatted = formatOptions(options);

      expect(formatted).toContain('Non-Interactive: yes');
      expect(formatted).toContain('Force Overwrite: no');
      expect(formatted).toContain('Skip Validation: yes');
    });

    it('should have consistent formatting', () => {
      const options: InitOptions = {
        nonInteractive: true,
        force: true,
        skipValidation: true,
      };

      const formatted = formatOptions(options);
      const lines = formatted.split('\n');

      // Should have header + 3 option lines
      expect(lines.length).toBe(4);

      // All option lines should be indented
      expect(lines[1]).toMatch(/^\s{2}/);
      expect(lines[2]).toMatch(/^\s{2}/);
      expect(lines[3]).toMatch(/^\s{2}/);
    });
  });
});
