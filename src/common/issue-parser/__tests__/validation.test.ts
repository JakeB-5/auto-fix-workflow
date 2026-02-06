/**
 * @module common/issue-parser/__tests__/validation.test
 * @description Tests for parsed issue validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateParsedIssue,
  hasCriticalErrors,
  getValidationSummary,
  mergeValidationResults,
  createValidationError,
  createValidationWarning,
} from '../validation.js';
import type { ParsedIssue } from '../types.js';

describe('validation', () => {
  const validIssue: ParsedIssue = {
    source: 'github',
    type: 'bug',
    problemDescription: 'This is a valid problem description with enough characters',
    context: {
      priority: 'high',
      relatedFiles: ['src/file.ts'],
      relatedSymbols: ['myFunction'],
    },
    acceptanceCriteria: [
      {
        description: 'Fix should work',
        completed: false,
      },
    ],
    rawSections: {
      body: 'test',
    },
  };

  describe('validateParsedIssue', () => {
    it('should validate a correct issue', () => {
      const result = validateParsedIssue(validIssue);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid source', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        source: 'invalid' as any,
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.code).toBe('INVALID_SOURCE');
    });

    it('should reject invalid type', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        type: 'invalid' as any,
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_TYPE');
    });

    it('should reject missing problem description', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        problemDescription: '',
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('MISSING_DESCRIPTION');
    });

    it('should warn on short description', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        problemDescription: 'Short',
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.code).toBe('SHORT_DESCRIPTION');
    });

    it('should warn on long description', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        problemDescription: 'A'.repeat(15000),
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.code).toBe('LONG_DESCRIPTION');
    });

    it('should reject invalid priority', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        context: {
          ...validIssue.context,
          priority: 'invalid' as any,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_PRIORITY');
    });

    it('should warn on invalid file path', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        context: {
          ...validIssue.context,
          relatedFiles: ['not a valid path!!!'],
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.code).toBe('INVALID_FILE_PATH');
    });

    it('should validate correct file paths', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        context: {
          ...validIssue.context,
          relatedFiles: [
            'src/file.ts',
            './relative/path.js',
            'path/to/file.tsx',
            'file.py',
          ],
        },
      };

      const result = validateParsedIssue(issue);

      const filePathWarnings = result.warnings.filter(w => w.code === 'INVALID_FILE_PATH');
      expect(filePathWarnings.length).toBe(0);
    });

    it('should reject invalid line range in code analysis', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        codeAnalysis: {
          startLine: 10,
          endLine: 5,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_LINE_RANGE');
    });

    it('should reject negative line numbers', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        codeAnalysis: {
          startLine: -1,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_LINE_NUMBER');
    });

    it('should reject zero line numbers', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        codeAnalysis: {
          startLine: 0,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_LINE_NUMBER');
    });

    it('should validate correct line range', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        codeAnalysis: {
          startLine: 5,
          endLine: 10,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid confidence', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        suggestedFix: {
          description: 'Fix it',
          steps: ['Step 1'],
          confidence: 1.5,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_CONFIDENCE');
    });

    it('should reject negative confidence', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        suggestedFix: {
          description: 'Fix it',
          steps: ['Step 1'],
          confidence: -0.1,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_CONFIDENCE');
    });

    it('should warn on empty suggested fix steps', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        suggestedFix: {
          description: 'Fix it',
          steps: [],
          confidence: 0.8,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.code).toBe('EMPTY_STEPS');
    });

    it('should validate correct suggested fix', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        suggestedFix: {
          description: 'Fix the bug',
          steps: ['Step 1', 'Step 2'],
          confidence: 0.9,
        },
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(true);
    });

    it('should warn on no acceptance criteria', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        acceptanceCriteria: [],
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.code).toBe('NO_ACCEPTANCE_CRITERIA');
    });

    it('should reject empty acceptance criterion description', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        acceptanceCriteria: [
          {
            description: '',
            completed: false,
          },
        ],
      };

      const result = validateParsedIssue(issue);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('EMPTY_CRITERION');
    });

    it('should warn on missing Sentry ID', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        source: 'sentry',
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.some(w => w.code === 'MISSING_SENTRY_ID')).toBe(true);
    });

    it('should not warn when Sentry ID is present', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        source: 'sentry',
        sourceId: 'SENTRY-123',
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.some(w => w.code === 'MISSING_SENTRY_ID')).toBe(false);
    });

    it('should warn on missing Asana ID', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        source: 'asana',
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.some(w => w.code === 'MISSING_ASANA_ID')).toBe(true);
    });

    it('should not warn when Asana ID is present', () => {
      const issue: ParsedIssue = {
        ...validIssue,
        source: 'asana',
        sourceId: 'ASANA-456',
      };

      const result = validateParsedIssue(issue);

      expect(result.warnings.some(w => w.code === 'MISSING_ASANA_ID')).toBe(false);
    });

    it('should allow valid priorities', () => {
      const priorities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];

      for (const priority of priorities) {
        const issue: ParsedIssue = {
          ...validIssue,
          context: {
            ...validIssue.context,
            priority,
          },
        };

        const result = validateParsedIssue(issue);

        expect(result.errors.some(e => e.code === 'INVALID_PRIORITY')).toBe(false);
      }
    });

    it('should allow valid issue types', () => {
      const types: Array<'bug' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore'> =
        ['bug', 'feature', 'refactor', 'docs', 'test', 'chore'];

      for (const type of types) {
        const issue: ParsedIssue = {
          ...validIssue,
          type,
        };

        const result = validateParsedIssue(issue);

        expect(result.errors.some(e => e.code === 'INVALID_TYPE')).toBe(false);
      }
    });

    it('should allow valid sources', () => {
      const sources: Array<'asana' | 'sentry' | 'manual' | 'github'> =
        ['asana', 'sentry', 'manual', 'github'];

      for (const source of sources) {
        const issue: ParsedIssue = {
          ...validIssue,
          source,
        };

        const result = validateParsedIssue(issue);

        expect(result.errors.some(e => e.code === 'INVALID_SOURCE')).toBe(false);
      }
    });
  });

  describe('hasCriticalErrors', () => {
    it('should return true for INVALID_SOURCE', () => {
      const result = {
        valid: false,
        errors: [{ field: 'source', message: 'Invalid', code: 'INVALID_SOURCE' }],
        warnings: [],
      };

      expect(hasCriticalErrors(result)).toBe(true);
    });

    it('should return true for INVALID_TYPE', () => {
      const result = {
        valid: false,
        errors: [{ field: 'type', message: 'Invalid', code: 'INVALID_TYPE' }],
        warnings: [],
      };

      expect(hasCriticalErrors(result)).toBe(true);
    });

    it('should return true for MISSING_DESCRIPTION', () => {
      const result = {
        valid: false,
        errors: [{ field: 'problemDescription', message: 'Missing', code: 'MISSING_DESCRIPTION' }],
        warnings: [],
      };

      expect(hasCriticalErrors(result)).toBe(true);
    });

    it('should return false for non-critical errors', () => {
      const result = {
        valid: false,
        errors: [{ field: 'other', message: 'Error', code: 'INVALID_LINE_RANGE' }],
        warnings: [],
      };

      expect(hasCriticalErrors(result)).toBe(false);
    });

    it('should return false for no errors', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };

      expect(hasCriticalErrors(result)).toBe(false);
    });
  });

  describe('getValidationSummary', () => {
    it('should return success message for valid result', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const summary = getValidationSummary(result);

      expect(summary).toContain('passed');
      expect(summary).toContain('no issues');
    });

    it('should return error count for invalid result', () => {
      const result = {
        valid: false,
        errors: [
          { field: 'source', message: 'Invalid', code: 'INVALID_SOURCE' },
          { field: 'type', message: 'Invalid', code: 'INVALID_TYPE' },
        ],
        warnings: [],
      };

      const summary = getValidationSummary(result);

      expect(summary).toContain('failed');
      expect(summary).toContain('2 error(s)');
    });

    it('should return warning count for valid result with warnings', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [
          { field: 'description', message: 'Short', code: 'SHORT_DESCRIPTION' },
        ],
      };

      const summary = getValidationSummary(result);

      expect(summary).toContain('passed');
      expect(summary).toContain('1 warning(s)');
    });

    it('should return both counts for invalid result with warnings', () => {
      const result = {
        valid: false,
        errors: [
          { field: 'source', message: 'Invalid', code: 'INVALID_SOURCE' },
        ],
        warnings: [
          { field: 'description', message: 'Short', code: 'SHORT_DESCRIPTION' },
          { field: 'file', message: 'Invalid', code: 'INVALID_FILE_PATH' },
        ],
      };

      const summary = getValidationSummary(result);

      expect(summary).toContain('failed');
      expect(summary).toContain('1 error(s)');
      expect(summary).toContain('2 warning(s)');
    });
  });

  describe('mergeValidationResults', () => {
    it('should merge multiple results', () => {
      const results = [
        {
          valid: false,
          errors: [{ field: 'source', message: 'Error1', code: 'ERROR1' }],
          warnings: [{ field: 'warn1', message: 'Warning1', code: 'WARN1' }],
        },
        {
          valid: true,
          errors: [],
          warnings: [{ field: 'warn2', message: 'Warning2', code: 'WARN2' }],
        },
      ];

      const merged = mergeValidationResults(results);

      expect(merged.errors.length).toBe(1);
      expect(merged.warnings.length).toBe(2);
      expect(merged.valid).toBe(false);
    });

    it('should be valid when all results are valid', () => {
      const results = [
        { valid: true, errors: [], warnings: [] },
        { valid: true, errors: [], warnings: [] },
      ];

      const merged = mergeValidationResults(results);

      expect(merged.valid).toBe(true);
      expect(merged.errors.length).toBe(0);
    });

    it('should be invalid when any result has errors', () => {
      const results = [
        { valid: true, errors: [], warnings: [] },
        { valid: false, errors: [{ field: 'f', message: 'm', code: 'c' }], warnings: [] },
      ];

      const merged = mergeValidationResults(results);

      expect(merged.valid).toBe(false);
    });

    it('should handle empty results array', () => {
      const merged = mergeValidationResults([]);

      expect(merged.valid).toBe(true);
      expect(merged.errors).toEqual([]);
      expect(merged.warnings).toEqual([]);
    });
  });

  describe('createValidationError', () => {
    it('should create error object', () => {
      const error = createValidationError('field', 'message', 'CODE');

      expect(error.field).toBe('field');
      expect(error.message).toBe('message');
      expect(error.code).toBe('CODE');
    });
  });

  describe('createValidationWarning', () => {
    it('should create warning object', () => {
      const warning = createValidationWarning('field', 'message', 'CODE');

      expect(warning.field).toBe('field');
      expect(warning.message).toBe('message');
      expect(warning.code).toBe('CODE');
    });
  });
});
