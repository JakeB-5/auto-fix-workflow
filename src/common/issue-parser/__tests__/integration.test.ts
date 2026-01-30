/**
 * @module common/issue-parser/__tests__/integration.test
 * @description Integration tests for issue parser
 */

import { describe, it, expect } from 'vitest';
import { parseIssueBody } from '../index.js';
import { isSuccess, isFailure } from '../../types/index.js';
import { ALL_FIXTURES } from './fixtures/sample-issues.js';

describe('issue-parser integration', () => {
  describe('all fixtures parse without errors', () => {
    for (const [name, fixture] of Object.entries(ALL_FIXTURES)) {
      it(`should parse ${name}`, async () => {
        const result = await parseIssueBody(fixture, { enableFallback: true });

        expect(isSuccess(result)).toBe(true);
        if (!isSuccess(result)) {
          console.error(`Failed to parse ${name}:`, result.error);
          return;
        }

        expect(result.data.issue).toBeDefined();
        expect(result.data.issue.source).toBeDefined();
        expect(result.data.issue.type).toBeDefined();
      });
    }
  });

  describe('source detection', () => {
    it('should correctly identify all source types', async () => {
      const testCases = [
        { fixture: ALL_FIXTURES.SENTRY_ISSUE, expected: 'sentry' },
        { fixture: ALL_FIXTURES.ASANA_ISSUE, expected: 'asana' },
        { fixture: ALL_FIXTURES.MANUAL_ISSUE, expected: 'manual' },
        { fixture: ALL_FIXTURES.MINIMAL_ISSUE, expected: 'manual' },
      ];

      for (const { fixture, expected } of testCases) {
        const result = await parseIssueBody(fixture);
        if (isSuccess(result)) {
          expect(result.data.issue.source).toBe(expected);
        }
      }
    });
  });

  describe('type detection', () => {
    it('should correctly identify all issue types', async () => {
      const testCases = [
        { fixture: ALL_FIXTURES.SENTRY_ISSUE, expected: 'bug' },
        { fixture: ALL_FIXTURES.ASANA_ISSUE, expected: 'feature' },
        { fixture: ALL_FIXTURES.REFACTOR_ISSUE, expected: 'refactor' },
        { fixture: ALL_FIXTURES.DOCS_ISSUE, expected: 'docs' },
        { fixture: ALL_FIXTURES.MANUAL_ISSUE, expected: 'chore' },
      ];

      for (const { fixture, expected } of testCases) {
        const result = await parseIssueBody(fixture);
        if (isSuccess(result)) {
          expect(result.data.issue.type).toBe(expected);
        }
      }
    });
  });

  describe('code analysis extraction', () => {
    it('should extract JavaScript/TypeScript stack traces', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const analysis = result.data.issue.codeAnalysis;
      expect(analysis).toBeDefined();
      expect(analysis?.stackTrace?.length).toBeGreaterThan(0);

      const firstFrame = analysis?.stackTrace?.[0];
      expect(firstFrame?.file).toContain('.ts');
      expect(firstFrame?.line).toBeDefined();
    });

    it('should extract Python stack traces', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.PYTHON_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const analysis = result.data.issue.codeAnalysis;
      expect(analysis).toBeDefined();
      expect(analysis?.stackTrace?.length).toBeGreaterThan(0);

      const frame = analysis?.stackTrace?.find((f) => f.file.endsWith('.py'));
      expect(frame).toBeDefined();
    });
  });

  describe('acceptance criteria extraction', () => {
    it('should extract and parse GIVEN-WHEN-THEN scenarios', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.GWT_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const criteria = result.data.issue.acceptanceCriteria;
      expect(criteria.length).toBeGreaterThan(0);

      const withScenario = criteria.filter((c) => c.scenario !== undefined);
      expect(withScenario.length).toBeGreaterThan(0);

      for (const criterion of withScenario) {
        const { scenario } = criterion;
        if (scenario) {
          expect(scenario.given).toBeTruthy();
          expect(scenario.when).toBeTruthy();
          expect(scenario.then).toBeTruthy();
        }
      }
    });

    it('should parse checkbox completion status', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const criteria = result.data.issue.acceptanceCriteria;
      const completed = criteria.filter((c) => c.completed);
      const incomplete = criteria.filter((c) => !c.completed);

      expect(completed.length).toBeGreaterThan(0);
      expect(incomplete.length).toBeGreaterThan(0);
    });
  });

  describe('suggested fix extraction', () => {
    it('should extract fix description and steps', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const fix = result.data.issue.suggestedFix;
      expect(fix).toBeDefined();
      expect(fix?.description).toBeTruthy();
      expect(fix?.steps.length).toBeGreaterThan(0);
      expect(fix?.confidence).toBeGreaterThan(0);
      expect(fix?.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('context extraction', () => {
    it('should extract component and priority', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const context = result.data.issue.context;
      expect(context.component).toBe('AuthService');
      expect(context.priority).toBe('critical');
    });

    it('should extract related files', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const files = result.data.issue.context.relatedFiles;
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.includes('.ts'))).toBe(true);
    });

    it('should extract related symbols', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      const symbols = result.data.issue.context.relatedSymbols;
      expect(symbols.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate complete issues without errors', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.validation.valid).toBe(true);
      expect(result.data.validation.errors.length).toBe(0);
    });

    it('should generate warnings for minimal issues', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.MINIMAL_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('fallback behavior', () => {
    it('should use fallback for unstructured issues', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.UNSTRUCTURED_ISSUE);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      // Should still extract useful information
      expect(result.data.issue.problemDescription).toBeTruthy();
      expect(result.data.issue.context.relatedFiles.length).toBeGreaterThan(0);
    });

    it('should handle empty issues with fallback', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.EMPTY_ISSUE, {
        enableFallback: true,
      });

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.usedFallback).toBe(true);
    });

    it('should fail on empty issues without fallback', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.EMPTY_ISSUE, {
        enableFallback: false,
      });

      expect(isFailure(result)).toBe(true);
    });
  });

  describe('parser options', () => {
    it('should respect strict mode', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.MINIMAL_ISSUE, {
        strict: true,
        enableFallback: false,
      });

      // Strict mode should fail on warnings
      expect(isFailure(result)).toBe(true);
    });

    it('should skip validation when requested', async () => {
      const result = await parseIssueBody(ALL_FIXTURES.COMPLETE_ISSUE, {
        skipValidation: true,
      });

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.validation.errors.length).toBe(0);
      expect(result.data.validation.warnings.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle issues with only code blocks', async () => {
      const codeOnly = `
\`\`\`typescript
const x = 1;
\`\`\`
`;
      const result = await parseIssueBody(codeOnly);

      expect(isSuccess(result)).toBe(true);
    });

    it('should handle issues with special characters', async () => {
      const special = `## Problem Description

Error: <script>alert('xss')</script> found in input

File: src/utils/[id].ts
`;
      const result = await parseIssueBody(special);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.issue.problemDescription).toContain('script');
    });

    it('should handle very long issues', async () => {
      const longText = 'A'.repeat(10001); // Over MAX_PROBLEM_DESCRIPTION_LENGTH
      const longIssue = `## Problem Description\n\n${longText}`;

      const result = await parseIssueBody(longIssue);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      // Long description should trigger a warning
      const hasLongWarning = result.data.validation.warnings.some((w) =>
        w.code === 'LONG_DESCRIPTION'
      );
      expect(hasLongWarning).toBe(true);
    });

    it('should handle unicode content', async () => {
      const unicode = `## Problem Description

에러가 발생했습니다. Error in 文件.ts

日本語のコメント
`;
      const result = await parseIssueBody(unicode);

      expect(isSuccess(result)).toBe(true);
    });

    it('should handle nested markdown structures', async () => {
      const nested = `## Problem Description

### Details

#### Sub-details

- Item 1
  - Nested item
    - Deep nested
`;
      const result = await parseIssueBody(nested);

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle a typical Sentry error report', async () => {
      const sentryReport = `## Source

Sentry Issue: FRONTEND-12345
https://sentry.io/organizations/mycompany/issues/12345/

## Type

Bug

## Context

**Component:** PaymentForm
**Environment:** production
**Priority:** critical

## Problem Description

Users are getting a blank screen after submitting payment. The error is occurring for approximately 5% of transactions.

## Code Analysis

\`\`\`
TypeError: Cannot read property 'status' of undefined
    at PaymentForm.handleResponse (webpack:///./src/components/PaymentForm.tsx:89:23)
    at async PaymentService.submitPayment (webpack:///./src/services/payment.ts:45:12)
\`\`\`

## Suggested Fix

1. Add null check for response object
2. Add error boundary to catch rendering errors
3. Add retry logic for failed payments

## Acceptance Criteria

- [ ] Payment errors show user-friendly message
- [ ] Failed payments can be retried
- [ ] Error is logged to monitoring
`;

      const result = await parseIssueBody(sentryReport);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.issue.source).toBe('sentry');
      expect(result.data.issue.type).toBe('bug');
      expect(result.data.issue.context.priority).toBe('critical');
      expect(result.data.issue.codeAnalysis?.stackTrace?.length).toBeGreaterThan(0);
    });

    it('should handle a typical feature request', async () => {
      const featureRequest = `## Source

Asana Task: 9876543210

## Type

Feature

## Context

**Component:** Dashboard
**Priority:** medium

## Problem Description

Users have requested the ability to export dashboard data to CSV format for reporting purposes.

## Suggested Fix Direction

1. Add export button to dashboard header
2. Implement CSV generation service
3. Add download functionality
4. Support filtering exported data

## Acceptance Criteria

- [ ] Export button is visible on dashboard
- [ ] CSV includes all visible columns
- [ ] Large datasets are handled without timeout
- [ ] Export respects current filters
`;

      const result = await parseIssueBody(featureRequest);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;

      expect(result.data.issue.source).toBe('asana');
      expect(result.data.issue.type).toBe('feature');
      expect(result.data.issue.acceptanceCriteria.length).toBe(4);
    });
  });
});
