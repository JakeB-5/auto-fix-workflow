/**
 * @module analyzer/task-analyzer/__tests__/task-analyzer
 * @description Unit tests for task analyzer
 */

import { describe, it, expect } from 'vitest';
import { analyzeReproducibility } from '../reproducibility.js';
import { evaluateSufficiency, getMissingElements } from '../sufficiency.js';
import { extractCodeHints } from '../code-hints.js';
import { generateActions } from '../actions.js';
import type { AsanaTask, TaskAnalysis } from '../types.js';

describe('analyzeReproducibility', () => {
  it('should identify reproducible task', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Error always occurs',
      notes: 'Steps to reproduce:\n1. Click button\n2. Error appears\nError: TypeError at line 42',
      completed: false,
    };

    const result = analyzeReproducibility(task);

    expect(result.isReproducible).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.reason).toContain('reproducibility indicators');
  });

  it('should identify non-reproducible task', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Intermittent error',
      notes: 'Sometimes the page crashes randomly. Cannot reproduce consistently.',
      completed: false,
    };

    const result = analyzeReproducibility(task);

    expect(result.isReproducible).toBe(false);
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.reason).toContain('intermittent');
  });

  it('should handle task with error details', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Crash in handleClick',
      notes: 'Stack trace:\n  at handleClick (App.tsx:42)\n  TypeError: Cannot read property',
      completed: false,
    };

    const result = analyzeReproducibility(task);

    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('evaluateSufficiency', () => {
  it('should return sufficient for complete task', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Button click error',
      notes: `
Description: Button click throws error

Steps to reproduce:
1. Navigate to dashboard
2. Click "Submit" button

Expected behavior: Form should submit
Actual behavior: Error thrown

Error: TypeError at line 42 in submitForm function
Environment: Chrome 120, Windows 11
`,
      completed: false,
    };

    const result = evaluateSufficiency(task);

    expect(result).toBe('sufficient');
  });

  it('should return insufficient for minimal task', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Fix bug',
      notes: 'Something is broken',
      completed: false,
    };

    const result = evaluateSufficiency(task);

    expect(result).toBe('insufficient');
  });

  it('should return partial for incomplete task', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Button error',
      notes: 'When clicking the button, an error occurs. Should work without error.',
      completed: false,
    };

    const result = evaluateSufficiency(task);

    expect(result).toBe('partial');
  });
});

describe('getMissingElements', () => {
  it('should identify missing elements', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Bug',
      notes: 'It is broken',
      completed: false,
    };

    const missing = getMissingElements(task);

    expect(missing).toContain('reproduction steps');
    expect(missing).toContain('expected behavior');
    expect(missing).toContain('error details');
  });

  it('should return empty for complete task', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Error in function',
      notes: `
Detailed description of the issue that happens in the application.

Steps:
1. Do this
2. Do that

Expected: Should work
Actual: Error thrown

Error: TypeError at line 42
Environment: Chrome 120
Function: processData in data.ts
`,
      completed: false,
    };

    const missing = getMissingElements(task);

    expect(missing.length).toBe(0);
  });
});

describe('extractCodeHints', () => {
  it('should extract file paths', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Error in App.tsx',
      notes: 'Error occurs in src/components/App.tsx at line 42',
      completed: false,
    };

    const hints = extractCodeHints(task);

    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].file).toContain('App.tsx');
    expect(hints[0].line).toBe(42);
  });

  it('should extract function names', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Error in handleClick',
      notes: 'The handleClick() function throws an error',
      completed: false,
    };

    const hints = extractCodeHints(task);

    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.function === 'handleClick')).toBe(true);
  });

  it('should combine file and function', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Error',
      notes: 'Error in processData function in utils.ts at line 100',
      completed: false,
    };

    const hints = extractCodeHints(task);

    expect(hints.length).toBeGreaterThan(0);
    const topHint = hints[0];
    expect(topHint.file).toBe('utils.ts');
    expect(topHint.function).toBe('processData');
    expect(topHint.line).toBe(100);
  });

  it('should calculate confidence', () => {
    const task: AsanaTask = {
      gid: '123',
      name: 'Error',
      notes: 'Error in function processData at utils.ts:42 with stack trace',
      completed: false,
    };

    const hints = extractCodeHints(task);

    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].confidence).toBeGreaterThan(0.5);
  });
});

describe('generateActions', () => {
  it('should generate comment action', () => {
    const analysis: TaskAnalysis = {
      taskId: '123',
      isReproducible: true,
      confidence: 0.8,
      codeHints: [],
      suggestedActions: [],
      informationSufficiency: 'sufficient',
    };

    const actions = generateActions(analysis, {
      name: 'Test task',
      notes: 'Notes',
    });

    expect(actions.some((a) => a.type === 'add_comment')).toBe(true);
  });

  it('should request information for insufficient task', () => {
    const analysis: TaskAnalysis = {
      taskId: '123',
      isReproducible: false,
      confidence: 0.3,
      codeHints: [],
      suggestedActions: [],
      informationSufficiency: 'insufficient',
    };

    const actions = generateActions(analysis, {
      name: 'Test',
      notes: 'Minimal',
    });

    expect(actions.some((a) => a.type === 'request_information')).toBe(true);
  });

  it('should add reproducible tag', () => {
    const analysis: TaskAnalysis = {
      taskId: '123',
      isReproducible: true,
      confidence: 0.8,
      codeHints: [],
      suggestedActions: [],
      informationSufficiency: 'sufficient',
    };

    const actions = generateActions(analysis, {
      name: 'Test',
      notes: 'Notes',
    });

    expect(
      actions.some(
        (a) => a.type === 'add_tag' && a.payload.tagName === 'reproducible'
      )
    ).toBe(true);
  });

  it('should mark as blocked for very low confidence', () => {
    const analysis: TaskAnalysis = {
      taskId: '123',
      isReproducible: false,
      confidence: 0.2,
      codeHints: [],
      suggestedActions: [],
      informationSufficiency: 'insufficient',
    };

    const actions = generateActions(analysis, {
      name: 'Test',
      notes: 'Minimal',
    });

    expect(actions.some((a) => a.type === 'mark_blocked')).toBe(true);
  });
});
