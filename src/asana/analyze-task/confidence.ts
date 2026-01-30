/**
 * @module asana/analyze-task/confidence
 * @description Confidence score calculation for task analysis
 */

import type { HeuristicResult, HeuristicIndicator } from './heuristics.js';
import type { FormattedTaskDetail } from '../get-task/tool.js';

/** Confidence level */
export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

/** Confidence score result */
export interface ConfidenceScore {
  /** Overall score (0-100) */
  readonly overall: number;
  /** Confidence level */
  readonly level: ConfidenceLevel;
  /** Breakdown by category */
  readonly breakdown: ConfidenceBreakdown;
  /** Factors that increased confidence */
  readonly positiveFactors: readonly string[];
  /** Factors that decreased confidence */
  readonly negativeFactors: readonly string[];
  /** Suggestions to improve confidence */
  readonly suggestions: readonly string[];
}

/** Confidence breakdown by category */
export interface ConfidenceBreakdown {
  /** Task clarity (0-25) */
  readonly clarity: number;
  /** Technical detail (0-25) */
  readonly technicalDetail: number;
  /** Scope definition (0-25) */
  readonly scopeDefinition: number;
  /** Acceptance criteria (0-25) */
  readonly acceptanceCriteria: number;
}

/** Weights for different factors */
const WEIGHTS = {
  // Clarity factors
  titleLength: 5,
  descriptionLength: 5,
  hasStructuredFormat: 5,
  noAmbiguousTerms: 5,
  hasConcreteGoal: 5,

  // Technical detail factors
  hasFilePaths: 5,
  hasCodeSnippets: 5,
  hasSymbolReferences: 5,
  hasTechnicalTerms: 5,
  hasErrorMessages: 5,

  // Scope factors
  hasBoundedScope: 5,
  hasEstimate: 5,
  hasNoDependencies: 5,
  hasSingleResponsibility: 5,
  isNotTooLarge: 5,

  // Acceptance criteria factors
  hasChecklistItems: 5,
  hasExpectedBehavior: 5,
  hasTestability: 5,
  hasClearDoneDefinition: 5,
  hasVerificationSteps: 5,
};

/**
 * Calculate confidence score for a task
 *
 * @param task - Task details
 * @param heuristics - Heuristic analysis result
 * @returns Confidence score
 */
export function calculateConfidence(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult
): ConfidenceScore {
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];
  const suggestions: string[] = [];

  // Calculate breakdown scores
  const clarity = calculateClarityScore(
    task,
    positiveFactors,
    negativeFactors,
    suggestions
  );
  const technicalDetail = calculateTechnicalDetailScore(
    task,
    positiveFactors,
    negativeFactors,
    suggestions
  );
  const scopeDefinition = calculateScopeScore(
    task,
    heuristics,
    positiveFactors,
    negativeFactors,
    suggestions
  );
  const acceptanceCriteria = calculateAcceptanceCriteriaScore(
    task,
    heuristics,
    positiveFactors,
    negativeFactors,
    suggestions
  );

  const breakdown: ConfidenceBreakdown = {
    clarity,
    technicalDetail,
    scopeDefinition,
    acceptanceCriteria,
  };

  const overall = clarity + technicalDetail + scopeDefinition + acceptanceCriteria;
  const level = scoreToLevel(overall);

  return {
    overall,
    level,
    breakdown,
    positiveFactors,
    negativeFactors,
    suggestions,
  };
}

/**
 * Calculate clarity score
 */
function calculateClarityScore(
  task: FormattedTaskDetail,
  positiveFactors: string[],
  negativeFactors: string[],
  suggestions: string[]
): number {
  let score = 0;
  const description = task.markdownDescription;

  // Title length (3-50 chars is good)
  if (task.name.length >= 10 && task.name.length <= 80) {
    score += WEIGHTS.titleLength;
    positiveFactors.push('Clear, appropriately sized title');
  } else if (task.name.length < 10) {
    negativeFactors.push('Title is too short');
    suggestions.push('Add more detail to the task title');
  } else {
    negativeFactors.push('Title is too long');
    suggestions.push('Shorten the title and move details to description');
  }

  // Description length
  if (description.length >= 100) {
    score += WEIGHTS.descriptionLength;
    positiveFactors.push('Detailed description provided');
  } else if (description.length < 20) {
    negativeFactors.push('Description is too brief');
    suggestions.push('Add more context and details to the description');
  }

  // Structured format (headings, lists)
  if (/^#+\s+/m.test(description) || /^[-*]\s+/m.test(description)) {
    score += WEIGHTS.hasStructuredFormat;
    positiveFactors.push('Uses structured formatting');
  } else {
    suggestions.push('Consider using headings or bullet points for clarity');
  }

  // No ambiguous terms
  const ambiguousTerms = ['etc', 'maybe', 'possibly', 'probably', 'stuff', 'things'];
  const hasAmbiguous = ambiguousTerms.some((term) =>
    description.toLowerCase().includes(term)
  );
  if (!hasAmbiguous) {
    score += WEIGHTS.noAmbiguousTerms;
    positiveFactors.push('Uses precise language');
  } else {
    negativeFactors.push('Contains ambiguous terms');
    suggestions.push('Replace vague terms with specific details');
  }

  // Has concrete goal
  const goalIndicators = ['goal', 'objective', 'purpose', 'should', 'must', 'needs to'];
  const hasGoal = goalIndicators.some((term) =>
    description.toLowerCase().includes(term)
  );
  if (hasGoal) {
    score += WEIGHTS.hasConcreteGoal;
    positiveFactors.push('States clear goal or objective');
  } else {
    suggestions.push('Add a clear statement of the goal or expected outcome');
  }

  return Math.min(25, score);
}

/**
 * Calculate technical detail score
 */
function calculateTechnicalDetailScore(
  task: FormattedTaskDetail,
  positiveFactors: string[],
  negativeFactors: string[],
  suggestions: string[]
): number {
  let score = 0;
  const description = task.markdownDescription;

  // Has file paths
  if (/[\w./\\-]+\.[a-z]{1,4}/i.test(description)) {
    score += WEIGHTS.hasFilePaths;
    positiveFactors.push('References specific file paths');
  } else {
    suggestions.push('Mention relevant file paths if applicable');
  }

  // Has code snippets
  if (/```[\s\S]*?```/m.test(description) || /`[^`]+`/.test(description)) {
    score += WEIGHTS.hasCodeSnippets;
    positiveFactors.push('Includes code snippets');
  }

  // Has symbol references (function/class names)
  if (/\b[a-z][a-zA-Z0-9]*\(\)/m.test(description)) {
    score += WEIGHTS.hasSymbolReferences;
    positiveFactors.push('References specific functions or methods');
  }

  // Has technical terms
  const technicalTerms = [
    'api', 'endpoint', 'component', 'module', 'service',
    'database', 'query', 'schema', 'interface', 'type',
  ];
  const hasTechnical = technicalTerms.some((term) =>
    description.toLowerCase().includes(term)
  );
  if (hasTechnical) {
    score += WEIGHTS.hasTechnicalTerms;
    positiveFactors.push('Uses technical terminology');
  }

  // Has error messages
  if (/error|exception|stack trace/i.test(description)) {
    score += WEIGHTS.hasErrorMessages;
    positiveFactors.push('Includes error information');
  }

  return Math.min(25, score);
}

/**
 * Calculate scope definition score
 */
function calculateScopeScore(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult,
  positiveFactors: string[],
  negativeFactors: string[],
  suggestions: string[]
): number {
  let score = 0;
  const description = task.markdownDescription;

  // Bounded scope indicators
  const boundedIndicators = [
    'only', 'limited to', 'specifically', 'just', 'single',
  ];
  const hasBounded = boundedIndicators.some((term) =>
    description.toLowerCase().includes(term)
  );
  if (hasBounded) {
    score += WEIGHTS.hasBoundedScope;
    positiveFactors.push('Has clearly bounded scope');
  }

  // Has estimate (custom field or text)
  const estimateField = task.customFields.find(
    (cf) => cf.name.toLowerCase().includes('estimate') || cf.name.toLowerCase().includes('points')
  );
  if (estimateField?.value) {
    score += WEIGHTS.hasEstimate;
    positiveFactors.push('Has effort estimate');
  } else {
    suggestions.push('Add an effort estimate to the task');
  }

  // Not too many dependencies mentioned
  const dependencyIndicators = ['depends on', 'blocked by', 'waiting for', 'after'];
  const depCount = dependencyIndicators.filter((term) =>
    description.toLowerCase().includes(term)
  ).length;
  if (depCount === 0) {
    score += WEIGHTS.hasNoDependencies;
    positiveFactors.push('No blocking dependencies mentioned');
  } else if (depCount > 2) {
    negativeFactors.push('Has multiple dependencies');
    suggestions.push('Consider breaking into smaller tasks with fewer dependencies');
  }

  // Single responsibility check
  if (heuristics.classification !== 'unknown') {
    score += WEIGHTS.hasSingleResponsibility;
    positiveFactors.push('Clear single responsibility');
  }

  // Not too large (based on complexity)
  if (heuristics.estimatedComplexity !== 'high') {
    score += WEIGHTS.isNotTooLarge;
    positiveFactors.push('Appropriate task size');
  } else {
    negativeFactors.push('Task may be too large');
    suggestions.push('Consider breaking this into smaller tasks');
  }

  return Math.min(25, score);
}

/**
 * Calculate acceptance criteria score
 */
function calculateAcceptanceCriteriaScore(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult,
  positiveFactors: string[],
  negativeFactors: string[],
  suggestions: string[]
): number {
  let score = 0;
  const description = task.markdownDescription;

  // Has checklist items
  if (/\[\s*[x ]\s*\]/.test(description)) {
    score += WEIGHTS.hasChecklistItems;
    positiveFactors.push('Has acceptance criteria checklist');
  } else {
    suggestions.push('Add a checklist of acceptance criteria');
  }

  // Has expected behavior
  if (/should|must|expected|will/i.test(description)) {
    score += WEIGHTS.hasExpectedBehavior;
    positiveFactors.push('Describes expected behavior');
  }

  // Testability
  if (heuristics.hasTestingRequirement) {
    score += WEIGHTS.hasTestability;
    positiveFactors.push('Has testing considerations');
  } else {
    suggestions.push('Define how this task should be tested');
  }

  // Clear "done" definition
  const doneIndicators = ['done when', 'complete when', 'finished when', 'acceptance'];
  const hasDoneDef = doneIndicators.some((term) =>
    description.toLowerCase().includes(term)
  );
  if (hasDoneDef) {
    score += WEIGHTS.hasClearDoneDefinition;
    positiveFactors.push('Has clear definition of done');
  } else {
    suggestions.push('Add a clear definition of when this task is complete');
  }

  // Has verification steps
  if (/verify|confirm|check|test|validate/i.test(description)) {
    score += WEIGHTS.hasVerificationSteps;
    positiveFactors.push('Includes verification steps');
  }

  return Math.min(25, score);
}

/**
 * Convert score to confidence level
 */
function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'low';
  return 'very_low';
}

/**
 * Get confidence level description
 *
 * @param level - Confidence level
 * @returns Human-readable description
 */
export function getConfidenceLevelDescription(level: ConfidenceLevel): string {
  const descriptions: Record<ConfidenceLevel, string> = {
    very_high: 'Task is very well-defined and ready for implementation',
    high: 'Task is well-defined with minor areas for clarification',
    medium: 'Task needs some additional detail or clarification',
    low: 'Task has significant gaps in definition',
    very_low: 'Task needs substantial work before implementation',
  };
  return descriptions[level];
}

/**
 * Check if confidence is sufficient for auto-processing
 *
 * @param score - Confidence score
 * @param threshold - Minimum acceptable level
 * @returns True if confidence meets threshold
 */
export function meetsConfidenceThreshold(
  score: ConfidenceScore,
  threshold: ConfidenceLevel = 'medium'
): boolean {
  const levels: ConfidenceLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
  return levels.indexOf(score.level) >= levels.indexOf(threshold);
}
