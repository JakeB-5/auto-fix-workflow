/**
 * @module commands/autofix/__tests__/prompts.test
 * @description Prompts module unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildAnalysisPrompt,
  buildFixPrompt,
  buildRetryPrompt,
  renderTemplate,
  ANALYSIS_PROMPT_TEMPLATE,
  FIX_PROMPT_TEMPLATE,
  RETRY_PROMPT_TEMPLATE,
  ANALYSIS_RESULT_SCHEMA,
  FIX_RESULT_SCHEMA,
} from '../prompts.js';
import type { IssueGroup } from '../../../common/types/index.js';
import type { AIAnalysisResult } from '../types.js';

// Mock data
const mockIssue = {
  number: 123,
  title: 'Test Bug',
  body: 'This is a test bug description',
  state: 'open' as const,
  type: 'bug' as const,
  labels: ['bug'],
  assignees: [],
  context: {
    component: 'test-component',
    priority: 'high' as const,
    relatedFiles: [],
    relatedSymbols: [],
    source: 'github' as const,
  },
  acceptanceCriteria: [],
  relatedIssues: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  url: 'https://github.com/test/repo/issues/123',
};

const mockIssueGroup: IssueGroup = {
  id: 'grp-1',
  issues: [mockIssue],
  component: 'test-component',
  branchName: 'fix/issue-123',
  prTitle: 'Fix: Test Bug',
  prBody: 'Fixes #123',
  status: 'pending',
  createdAt: new Date(),
};

const mockAnalysisResult: AIAnalysisResult = {
  issues: [mockIssue],
  filesToModify: ['src/test.ts'],
  rootCause: 'Null pointer exception when input is undefined',
  suggestedFix: 'Add null check to prevent error',
  confidence: 0.9,
  complexity: 'low',
};

describe('Prompt Templates', () => {
  it('should export template constants', () => {
    expect(ANALYSIS_PROMPT_TEMPLATE).toBeDefined();
    expect(typeof ANALYSIS_PROMPT_TEMPLATE).toBe('string');
    expect(ANALYSIS_PROMPT_TEMPLATE).toContain('{{#each issues}}');

    expect(FIX_PROMPT_TEMPLATE).toBeDefined();
    expect(typeof FIX_PROMPT_TEMPLATE).toBe('string');
    expect(FIX_PROMPT_TEMPLATE).toContain('{{analysis.rootCause}}');

    expect(RETRY_PROMPT_TEMPLATE).toBeDefined();
    expect(typeof RETRY_PROMPT_TEMPLATE).toBe('string');
    expect(RETRY_PROMPT_TEMPLATE).toContain('{{testError}}');
  });

  it('should export schema constants', () => {
    expect(ANALYSIS_RESULT_SCHEMA).toBeDefined();
    expect(ANALYSIS_RESULT_SCHEMA.type).toBe('object');
    expect(ANALYSIS_RESULT_SCHEMA.required).toContain('confidence');
    expect(ANALYSIS_RESULT_SCHEMA.required).toContain('rootCause');

    expect(FIX_RESULT_SCHEMA).toBeDefined();
    expect(FIX_RESULT_SCHEMA.type).toBe('object');
    expect(FIX_RESULT_SCHEMA.required).toContain('success');
    expect(FIX_RESULT_SCHEMA.required).toContain('summary');
  });
});

describe('renderTemplate', () => {
  it('should replace simple variables', () => {
    const template = 'Hello {{name}}!';
    const result = renderTemplate(template, { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should replace object properties', () => {
    const template = 'User: {{user.name}}, Age: {{user.age}}';
    const result = renderTemplate(template, {
      user: { name: 'Alice', age: 30 },
    });
    expect(result).toBe('User: Alice, Age: 30');
  });

  it('should handle {{#each}} blocks', () => {
    const template = '{{#each items}}Item: {{this.name}}\n{{/each}}';
    const result = renderTemplate(template, {
      items: [{ name: 'A' }, { name: 'B' }],
    });
    expect(result).toContain('Item: A');
    expect(result).toContain('Item: B');
  });

  it('should handle empty arrays', () => {
    const template = '{{#each items}}Item: {{this.name}}{{/each}}';
    const result = renderTemplate(template, { items: [] });
    expect(result).toBe('');
  });

  it('should handle missing properties gracefully', () => {
    const template = 'Value: {{missing}}';
    const result = renderTemplate(template, {});
    expect(result).toBe('Value: {{missing}}');
  });

  it('should handle null/undefined in object properties', () => {
    const template = '{{obj.prop}}';
    const result = renderTemplate(template, {
      obj: { prop: null },
    });
    expect(result).toBe('');
  });
});

describe('buildAnalysisPrompt', () => {
  it('should generate analysis prompt for single issue', () => {
    const prompt = buildAnalysisPrompt(mockIssueGroup);

    expect(prompt).toContain('Issue #123');
    expect(prompt).toContain('Test Bug');
    expect(prompt).toContain('This is a test bug description');
    expect(prompt).toContain('Output Format');
    expect(prompt).toContain('"confidence"');
  });

  it('should generate analysis prompt for multiple issues', () => {
    const multiIssueGroup: IssueGroup = {
      ...mockIssueGroup,
      issues: [
        mockIssue,
        { ...mockIssue, number: 124, title: 'Another Bug' },
      ],
    };

    const prompt = buildAnalysisPrompt(multiIssueGroup);

    expect(prompt).toContain('Issue #123');
    expect(prompt).toContain('Issue #124');
    expect(prompt).toContain('Test Bug');
    expect(prompt).toContain('Another Bug');
  });

  it('should include JSON schema in prompt', () => {
    const prompt = buildAnalysisPrompt(mockIssueGroup);

    expect(prompt).toContain('rootCause');
    expect(prompt).toContain('suggestedFix');
    expect(prompt).toContain('affectedFiles');
    expect(prompt).toContain('complexity');
  });
});

describe('buildFixPrompt', () => {
  it('should generate fix prompt with analysis results', () => {
    const prompt = buildFixPrompt(mockIssueGroup, mockAnalysisResult);

    expect(prompt).toContain('Issue #123');
    expect(prompt).toContain('Test Bug');
    expect(prompt).toContain('Add null check to prevent error');
    expect(prompt).toContain('src/test.ts');
  });

  it('should include safety guidelines', () => {
    const prompt = buildFixPrompt(mockIssueGroup, mockAnalysisResult);

    expect(prompt).toContain('Do NOT add unnecessary comments');
    expect(prompt).toContain('Do NOT refactor unrelated code');
    expect(prompt).toContain('minimum necessary changes');
  });

  it('should include constraints', () => {
    const prompt = buildFixPrompt(mockIssueGroup, mockAnalysisResult);

    expect(prompt).toContain('Maximum 3 files');
    expect(prompt).toContain('Maintain existing code style');
  });
});

describe('buildRetryPrompt', () => {
  it('should generate retry prompt with error details', () => {
    const testError = 'Test failed: Expected 1 but got 2';
    const previousSummary = 'Added null check to src/test.ts';

    const prompt = buildRetryPrompt(
      mockIssueGroup,
      mockAnalysisResult,
      testError,
      2,
      previousSummary
    );

    expect(prompt).toContain('previous fix attempt failed');
    expect(prompt).toContain(previousSummary);
    expect(prompt).toContain(testError);
    expect(prompt).toContain('Attempt 2 of 3');
  });

  it('should truncate long error messages', () => {
    const longError = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    const prompt = buildRetryPrompt(
      mockIssueGroup,
      mockAnalysisResult,
      longError,
      1,
      'Previous attempt'
    );

    const lines = prompt.split('\n');
    const errorLines = lines.filter((line) => line.match(/^Line \d+$/));

    // Should be truncated to 50 lines
    expect(errorLines.length).toBeLessThanOrEqual(50);
    expect(prompt).toContain('more lines omitted');
  });

  it('should not truncate short error messages', () => {
    const shortError = 'Short error message';
    const prompt = buildRetryPrompt(
      mockIssueGroup,
      mockAnalysisResult,
      shortError,
      1,
      'Previous attempt'
    );

    expect(prompt).toContain(shortError);
    expect(prompt).not.toContain('more lines omitted');
  });
});
