/**
 * @module commands/triage/__tests__/cli.test
 * @description CLI parameter parsing tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  getHelpMessage,
  HelpRequestedError,
  VersionRequestedError,
  formatOptions,
} from '../cli.js';
import type { TriageOptions } from '../types.js';

describe('parseArgs', () => {
  describe('default options', () => {
    it('should return default options with no arguments', () => {
      const result = parseArgs([]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('interactive');
        expect(result.data.dryRun).toBe(false);
        expect(result.data.verbose).toBe(false);
        expect(result.data.skipConfirmation).toBe(false);
      }
    });
  });

  describe('mode flag', () => {
    it('should parse --mode interactive', () => {
      const result = parseArgs(['--mode', 'interactive']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('interactive');
      }
    });

    it('should parse --mode batch', () => {
      const result = parseArgs(['--mode', 'batch']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('batch');
      }
    });

    it('should parse --mode single', () => {
      const result = parseArgs(['--mode', 'single']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('single');
      }
    });

    it('should parse short flag -m', () => {
      const result = parseArgs(['-m', 'batch']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('batch');
      }
    });

    it('should parse --mode=value format', () => {
      const result = parseArgs(['--mode=batch']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('batch');
      }
    });

    it('should reject invalid mode', () => {
      const result = parseArgs(['--mode', 'invalid']);

      expect(result.success).toBe(false);
    });
  });

  describe('dry-run flag', () => {
    it('should parse --dry-run', () => {
      const result = parseArgs(['--dry-run']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(true);
      }
    });

    it('should parse -d', () => {
      const result = parseArgs(['-d']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(true);
      }
    });
  });

  describe('project flag', () => {
    it('should parse --project', () => {
      const result = parseArgs(['--project', '123456']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe('123456');
      }
    });

    it('should parse -p', () => {
      const result = parseArgs(['-p', '123456']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe('123456');
      }
    });
  });

  describe('section flag', () => {
    it('should parse --section', () => {
      const result = parseArgs(['--section', '789012']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sectionId).toBe('789012');
      }
    });

    it('should parse -s', () => {
      const result = parseArgs(['-s', '789012']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sectionId).toBe('789012');
      }
    });
  });

  describe('priority flag', () => {
    it('should parse --priority critical', () => {
      const result = parseArgs(['--priority', 'critical']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('critical');
      }
    });

    it('should parse --priority high', () => {
      const result = parseArgs(['--priority', 'high']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('high');
      }
    });

    it('should parse --priority medium', () => {
      const result = parseArgs(['--priority', 'medium']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('medium');
      }
    });

    it('should parse --priority low', () => {
      const result = parseArgs(['--priority', 'low']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('low');
      }
    });

    it('should parse -P', () => {
      const result = parseArgs(['-P', 'high']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('high');
      }
    });

    it('should reject invalid priority', () => {
      const result = parseArgs(['--priority', 'invalid']);

      expect(result.success).toBe(false);
    });
  });

  describe('limit flag', () => {
    it('should parse --limit', () => {
      const result = parseArgs(['--limit', '10']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should parse -l', () => {
      const result = parseArgs(['-l', '5']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(5);
      }
    });

    it('should reject non-numeric limit', () => {
      const result = parseArgs(['--limit', 'abc']);

      expect(result.success).toBe(false);
    });

    it('should reject zero limit', () => {
      const result = parseArgs(['--limit', '0']);

      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const result = parseArgs(['--limit', '-5']);

      expect(result.success).toBe(false);
    });
  });

  describe('yes flag', () => {
    it('should parse --yes', () => {
      const result = parseArgs(['--yes']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skipConfirmation).toBe(true);
      }
    });

    it('should parse -y', () => {
      const result = parseArgs(['-y']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skipConfirmation).toBe(true);
      }
    });
  });

  describe('verbose flag', () => {
    it('should parse --verbose', () => {
      const result = parseArgs(['--verbose']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verbose).toBe(true);
      }
    });

    it('should parse -v', () => {
      const result = parseArgs(['-v']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verbose).toBe(true);
      }
    });
  });

  describe('combined flags', () => {
    it('should parse multiple flags', () => {
      const result = parseArgs([
        '--mode', 'batch',
        '--dry-run',
        '--project', '123456',
        '--priority', 'high',
        '--limit', '10',
        '--yes',
        '--verbose',
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('batch');
        expect(result.data.dryRun).toBe(true);
        expect(result.data.projectId).toBe('123456');
        expect(result.data.priority).toBe('high');
        expect(result.data.limit).toBe(10);
        expect(result.data.skipConfirmation).toBe(true);
        expect(result.data.verbose).toBe(true);
      }
    });

    it('should parse combined short flags', () => {
      const result = parseArgs(['-dvy']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(true);
        expect(result.data.verbose).toBe(true);
        expect(result.data.skipConfirmation).toBe(true);
      }
    });
  });

  describe('help flag', () => {
    it('should return HelpRequestedError for --help', () => {
      const result = parseArgs(['--help']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(HelpRequestedError);
      }
    });

    it('should return HelpRequestedError for -h', () => {
      const result = parseArgs(['-h']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(HelpRequestedError);
      }
    });
  });

  describe('version flag', () => {
    it('should return VersionRequestedError for --version', () => {
      const result = parseArgs(['--version']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(VersionRequestedError);
      }
    });
  });

  describe('unknown flags', () => {
    it('should report unknown flag', () => {
      const result = parseArgs(['--unknown']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unknown flag');
      }
    });
  });

  describe('positional arguments', () => {
    it('should parse numeric positional as project ID', () => {
      const result = parseArgs(['123456']);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectId).toBe('123456');
      }
    });
  });
});

describe('getHelpMessage', () => {
  it('should include usage', () => {
    const help = getHelpMessage();
    expect(help).toContain('Usage:');
  });

  it('should include options', () => {
    const help = getHelpMessage();
    expect(help).toContain('Options:');
    expect(help).toContain('--mode');
    expect(help).toContain('--dry-run');
    expect(help).toContain('--project');
  });

  it('should include modes description', () => {
    const help = getHelpMessage();
    expect(help).toContain('Modes:');
    expect(help).toContain('interactive');
    expect(help).toContain('batch');
    expect(help).toContain('single');
  });

  it('should include examples', () => {
    const help = getHelpMessage();
    expect(help).toContain('Examples:');
  });
});

describe('formatOptions', () => {
  it('should format basic options', () => {
    const options: TriageOptions = {
      mode: 'interactive',
      dryRun: false,
    };

    const formatted = formatOptions(options);

    expect(formatted).toContain('Mode: interactive');
    expect(formatted).toContain('Dry Run: no');
  });

  it('should format all options', () => {
    const options: TriageOptions = {
      mode: 'batch',
      dryRun: true,
      projectId: '123456',
      sectionId: '789012',
      priority: 'high',
      limit: 10,
      skipConfirmation: true,
      verbose: true,
    };

    const formatted = formatOptions(options);

    expect(formatted).toContain('Mode: batch');
    expect(formatted).toContain('Dry Run: yes');
    expect(formatted).toContain('Project ID: 123456');
    expect(formatted).toContain('Section ID: 789012');
    expect(formatted).toContain('Priority Filter: high');
    expect(formatted).toContain('Limit: 10');
    expect(formatted).toContain('Skip Confirmation: yes');
    expect(formatted).toContain('Verbose: yes');
  });
});
