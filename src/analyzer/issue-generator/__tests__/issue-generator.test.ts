/**
 * @module analyzer/issue-generator/__tests__
 * @description Unit tests for issue generator
 */

import { describe, it, expect } from 'vitest';
import { IssueGenerator } from '../generator.js';
import { detectIssueType } from '../type-detector.js';
import { generateTitle } from '../title-generator.js';
import { inferLabels, normalizeComponentLabel } from '../labels-system.js';
import { generateFixSuggestions } from '../suggested-fix-generator.js';
import type { IssueGenerationInput } from '../generator.js';

describe('IssueGenerator', () => {
  const generator = new IssueGenerator();

  const mockTask = {
    id: 'task-123',
    name: 'TypeError in handleSave function',
    notes: 'Error occurs when saving a new document',
  };

  const mockAnalysisHigh = {
    task_id: 'task-123',
    confidence: 'high' as const,
    can_auto_convert: true,
    reproducibility: 'clear' as const,
    has_sufficient_info: true,
    missing_info: [],
    identified_files: ['src/components/Editor.tsx'],
    estimated_component: 'editor',
    error_message: 'Cannot read property "id" of undefined',
    stack_trace: 'at handleSave (Editor.tsx:142)',
    locations: [
      {
        filePath: 'src/components/Editor.tsx',
        lineNumber: 142,
        functionName: 'handleSave',
        confidence: 0.9,
      },
    ],
    analyzed_at: '2026-01-30T00:00:00Z',
  };

  describe('generate', () => {
    it('should generate issue with high confidence analysis', async () => {
      const input: IssueGenerationInput = {
        task: mockTask,
        analysis: mockAnalysisHigh,
        source: 'asana',
        priority: 'high',
      };

      const result = await generator.generate(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toContain('[Asana]');
        expect(result.data.body).toContain('Auto-Fix Issue');
        expect(result.data.labels).toContain('auto-fix');
        expect(result.data.labels).toContain('asana');
        expect(result.data.type).toBe('bug');
      }
    });

    it('should fail with low confidence analysis', async () => {
      const lowConfidenceAnalysis = {
        ...mockAnalysisHigh,
        confidence: 'low' as const,
        can_auto_convert: false,
        missing_info: ['error-message', 'reproduction-steps'],
      };

      const input: IssueGenerationInput = {
        task: mockTask,
        analysis: lowConfidenceAnalysis,
        source: 'asana',
      };

      const result = await generator.generate(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INSUFFICIENT_DATA');
      }
    });

    it('should include component label in generated labels', async () => {
      const input: IssueGenerationInput = {
        task: mockTask,
        analysis: mockAnalysisHigh,
        source: 'asana',
      };

      const result = await generator.generate(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.labels).toContain('component:editor');
      }
    });
  });
});

describe('detectIssueType', () => {
  it('should detect bug from error message', () => {
    const type = detectIssueType({
      source: 'asana',
      description: 'App crashes when clicking save',
      errorMessage: 'TypeError: Cannot read property',
    });

    expect(type).toBe('bug');
  });

  it('should detect feature from description', () => {
    const type = detectIssueType({
      source: 'asana',
      description: 'Add new export feature',
    });

    expect(type).toBe('feature');
  });

  it('should detect Sentry as bug', () => {
    const type = detectIssueType({
      source: 'sentry',
      description: 'Any description',
    });

    expect(type).toBe('bug');
  });
});

describe('generateTitle', () => {
  it('should generate Sentry title with error type', () => {
    const title = generateTitle({
      type: 'bug',
      source: 'sentry',
      errorMessage: 'TypeError: Cannot read property "id" of undefined',
      fileName: 'src/components/Editor.tsx',
    });

    expect(title).toContain('[Sentry]');
    expect(title).toContain('TypeError');
    expect(title).toContain('Editor.tsx');
  });

  it('should generate Asana title from task name', () => {
    const title = generateTitle({
      type: 'bug',
      source: 'asana',
      taskTitle: 'Fix save button not working',
    });

    expect(title).toContain('[Asana]');
    expect(title).toContain('Fix save button not working');
  });

  it('should truncate long titles', () => {
    const longTitle = 'A'.repeat(300);
    const title = generateTitle({
      type: 'bug',
      source: 'asana',
      taskTitle: longTitle,
    });

    expect(title.length).toBeLessThanOrEqual(256);
    expect(title).toContain('...');
  });
});

describe('inferLabels', () => {
  it('should include auto-fix and source labels', () => {
    const labels = inferLabels({
      type: 'bug',
      source: 'asana',
    });

    expect(labels).toContain('auto-fix');
    expect(labels).toContain('asana');
    expect(labels).toContain('bug');
  });

  it('should include priority label when provided', () => {
    const labels = inferLabels({
      type: 'bug',
      source: 'sentry',
      priority: 'high',
    });

    expect(labels).toContain('priority:high');
  });

  it('should include normalized component label', () => {
    const labels = inferLabels({
      type: 'bug',
      source: 'asana',
      component: 'canvas core',
    });

    expect(labels).toContain('component:canvas-core');
  });

  it('should remove duplicate labels', () => {
    const labels = inferLabels({
      type: 'bug',
      source: 'asana',
      customLabels: ['bug', 'auto-fix'],
    });

    const bugCount = labels.filter((l) => l === 'bug').length;
    expect(bugCount).toBe(1);
  });
});

describe('normalizeComponentLabel', () => {
  it('should convert spaces to hyphens', () => {
    expect(normalizeComponentLabel('canvas core')).toBe('component:canvas-core');
  });

  it('should handle slashes', () => {
    expect(normalizeComponentLabel('analyzer/code-locator')).toBe(
      'component:analyzer-code-locator'
    );
  });

  it('should remove special characters', () => {
    expect(normalizeComponentLabel('ui@utils')).toBe('component:uiutils');
  });

  it('should truncate long names', () => {
    const longName = 'a'.repeat(60);
    const label = normalizeComponentLabel(longName);
    expect(label.length).toBeLessThanOrEqual(50);
  });
});

describe('generateFixSuggestions', () => {
  it('should suggest optional chaining for property access error', () => {
    const suggestions = generateFixSuggestions(
      'Cannot read property "id" of undefined'
    );

    expect(suggestions).toContain('Optional chaining 사용 검토 (?.)');
    expect(suggestions).toContain('Null/undefined 체크 추가');
  });

  it('should suggest function check for "not a function" error', () => {
    const suggestions = generateFixSuggestions('callback is not a function');

    expect(suggestions).toContain('함수 존재 여부 확인');
  });

  it('should return common patterns for unknown errors', () => {
    const suggestions = generateFixSuggestions('Unknown error occurred');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain('에러 핸들링 추가 (try-catch)');
  });

  it('should return empty array when no error message', () => {
    const suggestions = generateFixSuggestions(undefined);

    expect(suggestions).toEqual([]);
  });
});
