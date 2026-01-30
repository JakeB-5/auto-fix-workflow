/**
 * @module common/issue-parser/__tests__/parser.test
 * @description Unit tests for issue parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseIssueBody,
  quickParse,
  strictParse,
  parseMarkdownToAst,
  parseSource,
  parseType,
  parseContext,
  parseCodeAnalysis,
  parseProblemDescription,
  parseSuggestedFix,
  parseAcceptanceCriteria,
  validateParsedIssue,
  createFallbackIssue,
  isValidIssueType,
  isValidSuggestedFix,
  areAllCriteriaCompleted,
  countCriteria,
} from '../index.js';
import { isSuccess, isFailure } from '../../types/index.js';
import {
  COMPLETE_ISSUE,
  MINIMAL_ISSUE,
  SENTRY_ISSUE,
  ASANA_ISSUE,
  GWT_ISSUE,
  EMPTY_ISSUE,
  WHITESPACE_ISSUE,
  UNSTRUCTURED_ISSUE,
} from './fixtures/sample-issues.js';

describe('issue-parser', () => {
  describe('parseIssueBody', () => {
    it('should parse a complete issue with all sections', async () => {
      const result = await parseIssueBody(COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const { issue, validation, usedFallback } = result.data;

      expect(usedFallback).toBe(false);
      expect(issue.source).toBe('sentry');
      // Source ID extracts the project-specific ID format
      expect(issue.sourceId).toBe('PROJ-12345');
      expect(issue.type).toBe('bug');
      expect(issue.context.component).toBe('AuthService');
      expect(issue.context.priority).toBe('critical');
      expect(issue.problemDescription).toContain('random logouts');
      expect(issue.codeAnalysis).toBeDefined();
      expect(issue.suggestedFix).toBeDefined();
      expect(issue.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(validation.valid).toBe(true);
    });

    it('should parse a minimal issue with fallback values', async () => {
      const result = await parseIssueBody(MINIMAL_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const { issue } = result.data;

      expect(issue.source).toBe('manual');
      expect(issue.type).toBe('bug');
      expect(issue.problemDescription).toContain('login button');
    });

    it('should handle empty body with fallback', async () => {
      const result = await parseIssueBody(EMPTY_ISSUE, { enableFallback: true });

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.usedFallback).toBe(true);
    });

    it('should fail on empty body without fallback', async () => {
      const result = await parseIssueBody(EMPTY_ISSUE, { enableFallback: false });

      expect(isFailure(result)).toBe(true);
    });

    it('should handle whitespace-only body with fallback', async () => {
      const result = await parseIssueBody(WHITESPACE_ISSUE, { enableFallback: true });

      expect(isSuccess(result)).toBe(true);
    });

    it('should parse unstructured issues with inference', async () => {
      const result = await parseIssueBody(UNSTRUCTURED_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const { issue } = result.data;
      expect(issue.problemDescription).toBeTruthy();
      expect(issue.context.relatedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('parseMarkdownToAst', () => {
    it('should parse valid markdown', async () => {
      const result = await parseMarkdownToAst('# Heading\n\nParagraph');

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.type).toBe('root');
      expect(result.data.children.length).toBeGreaterThan(0);
    });

    it('should handle empty string', async () => {
      const result = await parseMarkdownToAst('');

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('parseSource', () => {
    it('should detect Sentry source', async () => {
      const ast = await parseMarkdownToAst(SENTRY_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseSource(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.source).toBe('sentry');
    });

    it('should detect Asana source', async () => {
      const ast = await parseMarkdownToAst(ASANA_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseSource(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.source).toBe('asana');
    });

    it('should default to manual source', async () => {
      const ast = await parseMarkdownToAst(MINIMAL_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseSource(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.source).toBe('manual');
    });
  });

  describe('parseType', () => {
    it('should detect bug type', async () => {
      const ast = await parseMarkdownToAst(SENTRY_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseType(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data).toBe('bug');
    });

    it('should detect feature type', async () => {
      const ast = await parseMarkdownToAst(ASANA_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseType(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data).toBe('feature');
    });
  });

  describe('parseContext', () => {
    it('should extract component and priority', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseContext(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.component).toBe('AuthService');
      expect(result.data.priority).toBe('critical');
    });

    it('should extract related files', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseContext(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.relatedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('parseCodeAnalysis', () => {
    it('should extract stack trace', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseCodeAnalysis(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const analysis = result.data;
      expect(analysis).not.toBeNull();
      expect(analysis?.stackTrace).toBeDefined();
      expect(analysis?.stackTrace?.length).toBeGreaterThan(0);
    });

    it('should extract error message', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseCodeAnalysis(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data?.errorMessage).toContain('Cannot read property');
    });

    it('should return null for issues without code analysis', async () => {
      const ast = await parseMarkdownToAst(MINIMAL_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseCodeAnalysis(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data).toBeNull();
    });
  });

  describe('parseProblemDescription', () => {
    it('should extract problem description', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data).toContain('random logouts');
      expect(result.data).toContain('dashboard');
    });
  });

  describe('parseSuggestedFix', () => {
    it('should extract suggested fix with steps', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const fix = result.data;
      expect(fix).not.toBeNull();
      expect(fix?.description).toBeTruthy();
      expect(fix?.steps.length).toBeGreaterThan(0);
      expect(fix?.confidence).toBeGreaterThan(0);
    });

    it('should return null when no fix section exists', async () => {
      const ast = await parseMarkdownToAst(MINIMAL_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data).toBeNull();
    });
  });

  describe('parseAcceptanceCriteria', () => {
    it('should extract checkbox criteria', async () => {
      const ast = await parseMarkdownToAst(COMPLETE_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const criteria = result.data;
      expect(criteria.length).toBeGreaterThan(0);

      // Check that completed status is parsed
      const completed = criteria.filter((c) => c.completed);
      const incomplete = criteria.filter((c) => !c.completed);
      expect(completed.length).toBeGreaterThan(0);
      expect(incomplete.length).toBeGreaterThan(0);
    });

    it('should parse GIVEN-WHEN-THEN scenarios', async () => {
      const ast = await parseMarkdownToAst(GWT_ISSUE);
      if (!isSuccess(ast)) return;

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const criteria = result.data;
      const withScenario = criteria.filter((c) => c.scenario);
      expect(withScenario.length).toBeGreaterThan(0);

      const firstScenario = withScenario[0]?.scenario;
      expect(firstScenario?.given).toBeTruthy();
      expect(firstScenario?.when).toBeTruthy();
      expect(firstScenario?.then).toBeTruthy();
    });
  });

  describe('validateParsedIssue', () => {
    it('should validate a complete issue without errors', async () => {
      const result = await parseIssueBody(COMPLETE_ISSUE);
      if (!isSuccess(result)) return;

      const validation = validateParsedIssue(result.data.issue);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should return warnings for missing optional fields', async () => {
      const result = await parseIssueBody(MINIMAL_ISSUE);
      if (!isSuccess(result)) return;

      const validation = validateParsedIssue(result.data.issue);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('quickParse', () => {
    it('should parse without validation', async () => {
      const result = await quickParse(COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.source).toBe('sentry');
    });
  });

  describe('strictParse', () => {
    it('should fail on validation errors', async () => {
      // Create an issue that will have validation warnings
      const result = await strictParse('');

      expect(isFailure(result)).toBe(true);
    });
  });

  describe('createFallbackIssue', () => {
    it('should create a minimal valid issue', () => {
      const issue = createFallbackIssue('Some error occurred in auth.ts');

      expect(issue.source).toBe('manual');
      expect(issue.type).toBe('bug');
      expect(issue.problemDescription).toBeTruthy();
    });

    it('should infer source from text', () => {
      const issue = createFallbackIssue('Sentry reported this error');

      expect(issue.source).toBe('sentry');
    });

    it('should extract file paths from text', () => {
      const issue = createFallbackIssue('Error in src/components/Button.tsx line 45');

      expect(issue.context.relatedFiles).toContain('src/components/Button.tsx');
    });
  });

  describe('utility functions', () => {
    describe('isValidIssueType', () => {
      it('should return true for valid types', () => {
        expect(isValidIssueType('bug')).toBe(true);
        expect(isValidIssueType('feature')).toBe(true);
        expect(isValidIssueType('refactor')).toBe(true);
      });

      it('should return false for invalid types', () => {
        expect(isValidIssueType('invalid')).toBe(false);
        expect(isValidIssueType('')).toBe(false);
      });
    });

    describe('isValidSuggestedFix', () => {
      it('should validate fix structure', () => {
        expect(isValidSuggestedFix({
          description: 'Fix it',
          steps: ['Step 1'],
          confidence: 0.8,
        })).toBe(true);

        expect(isValidSuggestedFix({
          description: '',
          steps: [],
          confidence: 0.5,
        })).toBe(false);
      });
    });

    describe('areAllCriteriaCompleted', () => {
      it('should check completion status', () => {
        expect(areAllCriteriaCompleted([
          { description: 'A', completed: true },
          { description: 'B', completed: true },
        ])).toBe(true);

        expect(areAllCriteriaCompleted([
          { description: 'A', completed: true },
          { description: 'B', completed: false },
        ])).toBe(false);
      });
    });

    describe('countCriteria', () => {
      it('should count completed and total', () => {
        const result = countCriteria([
          { description: 'A', completed: true },
          { description: 'B', completed: false },
          { description: 'C', completed: true },
        ]);

        expect(result.completed).toBe(2);
        expect(result.total).toBe(3);
      });
    });
  });
});
