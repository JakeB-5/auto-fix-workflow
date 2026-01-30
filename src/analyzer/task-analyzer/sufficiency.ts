/**
 * @module analyzer/task-analyzer/sufficiency
 * @description Information sufficiency evaluation
 */

import type { AsanaTask, InformationSufficiency } from './types.js';

/**
 * Critical information elements
 */
interface InformationElements {
  hasDescription: boolean;
  hasSteps: boolean;
  hasExpectedBehavior: boolean;
  hasActualBehavior: boolean;
  hasErrorDetails: boolean;
  hasEnvironment: boolean;
  hasCodeReferences: boolean;
}

/**
 * Extract information elements from task
 */
function extractInformationElements(task: AsanaTask): InformationElements {
  const text = `${task.name} ${task.notes || ''}`.toLowerCase();

  return {
    hasDescription: (task.notes?.length || 0) > 50,
    hasSteps:
      text.includes('step') ||
      text.includes('reproduce') ||
      /\d+\.\s/.test(text),
    hasExpectedBehavior:
      text.includes('expected') ||
      text.includes('should') ||
      text.includes('supposed to'),
    hasActualBehavior:
      text.includes('actual') ||
      text.includes('instead') ||
      text.includes('but'),
    hasErrorDetails:
      text.includes('error') ||
      text.includes('exception') ||
      text.includes('stack trace') ||
      text.includes('traceback'),
    hasEnvironment:
      text.includes('version') ||
      text.includes('browser') ||
      text.includes('os') ||
      text.includes('environment'),
    hasCodeReferences:
      text.includes('function') ||
      text.includes('method') ||
      text.includes('class') ||
      text.includes('file') ||
      /\w+\.\w+/.test(text) ||
      /\w+\(.*\)/.test(text),
  };
}

/**
 * Calculate sufficiency score (0-1)
 */
function calculateSufficiencyScore(elements: InformationElements): number {
  const weights = {
    hasDescription: 0.2,
    hasSteps: 0.2,
    hasExpectedBehavior: 0.15,
    hasActualBehavior: 0.15,
    hasErrorDetails: 0.15,
    hasEnvironment: 0.05,
    hasCodeReferences: 0.1,
  };

  let score = 0;
  for (const [key, value] of Object.entries(elements)) {
    if (value) {
      score += weights[key as keyof InformationElements];
    }
  }

  return score;
}

/**
 * Evaluate information sufficiency of a task
 */
export function evaluateSufficiency(task: AsanaTask): InformationSufficiency {
  const elements = extractInformationElements(task);
  const score = calculateSufficiencyScore(elements);

  // Thresholds
  if (score >= 0.7) {
    return 'sufficient';
  } else if (score >= 0.4) {
    return 'partial';
  } else {
    return 'insufficient';
  }
}

/**
 * Get missing information elements
 */
export function getMissingElements(task: AsanaTask): string[] {
  const elements = extractInformationElements(task);
  const missing: string[] = [];

  const labels: Record<keyof InformationElements, string> = {
    hasDescription: 'detailed description',
    hasSteps: 'reproduction steps',
    hasExpectedBehavior: 'expected behavior',
    hasActualBehavior: 'actual behavior',
    hasErrorDetails: 'error details',
    hasEnvironment: 'environment information',
    hasCodeReferences: 'code references',
  };

  for (const [key, value] of Object.entries(elements)) {
    if (!value) {
      missing.push(labels[key as keyof InformationElements]);
    }
  }

  return missing;
}
