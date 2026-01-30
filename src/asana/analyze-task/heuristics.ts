/**
 * @module asana/analyze-task/heuristics
 * @description Heuristic analysis module for Asana tasks
 */

import type { FormattedTaskDetail } from '../get-task/tool.js';

/** Task classification from heuristics */
export type TaskClassification =
  | 'bug'
  | 'feature'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'chore'
  | 'unknown';

/** Heuristic analysis result */
export interface HeuristicResult {
  readonly classification: TaskClassification;
  readonly indicators: readonly HeuristicIndicator[];
  readonly suggestedLabels: readonly string[];
  readonly estimatedComplexity: 'low' | 'medium' | 'high';
  readonly requiresCodeChange: boolean;
  readonly hasTestingRequirement: boolean;
  readonly hasClearAcceptanceCriteria: boolean;
}

/** Individual heuristic indicator */
export interface HeuristicIndicator {
  readonly name: string;
  readonly matched: boolean;
  readonly weight: number;
  readonly evidence?: string;
}

/** Keywords for classification */
const CLASSIFICATION_KEYWORDS: Record<TaskClassification, readonly string[]> = {
  bug: ['bug', 'fix', 'error', 'issue', 'broken', 'crash', 'fail', 'wrong', 'incorrect', 'exception'],
  feature: ['add', 'new', 'implement', 'create', 'feature', 'enhancement', 'support'],
  refactor: ['refactor', 'clean', 'improve', 'optimize', 'restructure', 'simplify', 'extract'],
  docs: ['document', 'docs', 'readme', 'comment', 'jsdoc', 'api docs'],
  test: ['test', 'spec', 'coverage', 'unit test', 'integration test', 'e2e'],
  chore: ['chore', 'update', 'upgrade', 'dependency', 'deps', 'config', 'ci', 'build'],
  unknown: [],
};

/** Complexity indicators */
const COMPLEXITY_INDICATORS = {
  high: [
    'multiple files', 'refactor', 'architecture', 'migration',
    'breaking change', 'security', 'performance', 'database schema',
  ],
  medium: [
    'api', 'endpoint', 'component', 'service', 'integration',
    'validation', 'authentication', 'error handling',
  ],
  low: [
    'typo', 'text', 'label', 'style', 'css', 'config',
    'readme', 'comment', 'rename',
  ],
};

/**
 * Analyze task using heuristics
 *
 * @param task - Task details
 * @returns Heuristic analysis result
 */
export function analyzeWithHeuristics(task: FormattedTaskDetail): HeuristicResult {
  const text = `${task.name} ${task.markdownDescription}`.toLowerCase();
  const indicators: HeuristicIndicator[] = [];

  // Classify task type
  const classification = classifyTask(text, indicators);

  // Determine complexity
  const estimatedComplexity = estimateComplexity(text, indicators);

  // Check for code change requirement
  const requiresCodeChange = checkCodeChangeRequirement(text, indicators);

  // Check for testing requirement
  const hasTestingRequirement = checkTestingRequirement(text, indicators);

  // Check for acceptance criteria
  const hasClearAcceptanceCriteria = checkAcceptanceCriteria(
    task.markdownDescription,
    indicators
  );

  // Suggest labels
  const suggestedLabels = generateSuggestedLabels(
    classification,
    estimatedComplexity,
    hasTestingRequirement
  );

  return {
    classification,
    indicators,
    suggestedLabels,
    estimatedComplexity,
    requiresCodeChange,
    hasTestingRequirement,
    hasClearAcceptanceCriteria,
  };
}

/**
 * Classify task based on keywords
 */
function classifyTask(
  text: string,
  indicators: HeuristicIndicator[]
): TaskClassification {
  const scores: Record<TaskClassification, number> = {
    bug: 0,
    feature: 0,
    refactor: 0,
    docs: 0,
    test: 0,
    chore: 0,
    unknown: 0,
  };

  for (const [type, keywords] of Object.entries(CLASSIFICATION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scores[type as TaskClassification] += 1;
        indicators.push({
          name: `keyword_${type}_${keyword}`,
          matched: true,
          weight: 1,
          evidence: keyword,
        });
      }
    }
  }

  // Find highest score
  let maxScore = 0;
  let classification: TaskClassification = 'unknown';

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      classification = type as TaskClassification;
    }
  }

  return classification;
}

/**
 * Estimate task complexity
 */
function estimateComplexity(
  text: string,
  indicators: HeuristicIndicator[]
): 'low' | 'medium' | 'high' {
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const indicator of COMPLEXITY_INDICATORS.high) {
    if (text.includes(indicator)) {
      highCount++;
      indicators.push({
        name: `complexity_high_${indicator.replace(/\s+/g, '_')}`,
        matched: true,
        weight: 3,
        evidence: indicator,
      });
    }
  }

  for (const indicator of COMPLEXITY_INDICATORS.medium) {
    if (text.includes(indicator)) {
      mediumCount++;
      indicators.push({
        name: `complexity_medium_${indicator.replace(/\s+/g, '_')}`,
        matched: true,
        weight: 2,
        evidence: indicator,
      });
    }
  }

  for (const indicator of COMPLEXITY_INDICATORS.low) {
    if (text.includes(indicator)) {
      lowCount++;
      indicators.push({
        name: `complexity_low_${indicator.replace(/\s+/g, '_')}`,
        matched: true,
        weight: 1,
        evidence: indicator,
      });
    }
  }

  // Text length as indicator
  if (text.length > 1000) {
    indicators.push({
      name: 'complexity_long_description',
      matched: true,
      weight: 1,
    });
    mediumCount++;
  }

  if (highCount >= 2) return 'high';
  if (highCount >= 1 || mediumCount >= 3) return 'medium';
  return 'low';
}

/**
 * Check if task requires code change
 */
function checkCodeChangeRequirement(
  text: string,
  indicators: HeuristicIndicator[]
): boolean {
  const codeIndicators = [
    'implement', 'fix', 'add', 'change', 'update', 'refactor',
    'modify', 'create', 'remove', 'delete', 'code', 'function',
    'method', 'class', 'component', 'api', 'endpoint',
  ];

  for (const indicator of codeIndicators) {
    if (text.includes(indicator)) {
      indicators.push({
        name: `code_change_${indicator}`,
        matched: true,
        weight: 1,
        evidence: indicator,
      });
      return true;
    }
  }

  return false;
}

/**
 * Check if task has testing requirement
 */
function checkTestingRequirement(
  text: string,
  indicators: HeuristicIndicator[]
): boolean {
  const testIndicators = [
    'test', 'spec', 'coverage', 'unit', 'integration',
    'e2e', 'verify', 'validate', 'assert',
  ];

  for (const indicator of testIndicators) {
    if (text.includes(indicator)) {
      indicators.push({
        name: `testing_${indicator}`,
        matched: true,
        weight: 1,
        evidence: indicator,
      });
      return true;
    }
  }

  return false;
}

/**
 * Check if task has clear acceptance criteria
 */
function checkAcceptanceCriteria(
  description: string,
  indicators: HeuristicIndicator[]
): boolean {
  const criteriaIndicators = [
    /acceptance criteria/i,
    /\[\s*[x ]\s*\]/g, // Checklist items
    /given.+when.+then/is, // BDD format
    /expected.+actual/i,
    /should\s+\w+/g,
    /must\s+\w+/g,
  ];

  for (const pattern of criteriaIndicators) {
    if (pattern.test(description)) {
      indicators.push({
        name: 'acceptance_criteria_pattern',
        matched: true,
        weight: 2,
      });
      return true;
    }
  }

  // Check for numbered list (potential acceptance criteria)
  if (/^\d+\.\s+/m.test(description)) {
    indicators.push({
      name: 'numbered_list',
      matched: true,
      weight: 1,
    });
    return true;
  }

  return false;
}

/**
 * Generate suggested labels
 */
function generateSuggestedLabels(
  classification: TaskClassification,
  complexity: 'low' | 'medium' | 'high',
  hasTestingRequirement: boolean
): string[] {
  const labels: string[] = [];

  // Type label
  if (classification !== 'unknown') {
    labels.push(`type:${classification}`);
  }

  // Complexity label
  labels.push(`complexity:${complexity}`);

  // Testing label
  if (hasTestingRequirement) {
    labels.push('needs-tests');
  }

  return labels;
}

/**
 * Extract file paths mentioned in task
 *
 * @param description - Task description
 * @returns Array of file paths
 */
export function extractFilePaths(description: string): string[] {
  const patterns = [
    /(?:^|\s)([\w./\\-]+\.[a-z]{1,4})(?:\s|$|:|,)/gim, // Generic file paths
    /`([\w./\\-]+\.[a-z]{1,4})`/g, // Backtick-wrapped paths
    /src\/[\w./\\-]+/g, // src/ paths
    /lib\/[\w./\\-]+/g, // lib/ paths
    /packages\/[\w./\\-]+/g, // monorepo paths
  ];

  const paths = new Set<string>();

  for (const pattern of patterns) {
    const matches = description.matchAll(pattern);
    for (const match of matches) {
      const path = match[1] || match[0];
      if (path && isLikelyFilePath(path)) {
        paths.add(path.trim());
      }
    }
  }

  return Array.from(paths);
}

/**
 * Check if string looks like a file path
 */
function isLikelyFilePath(str: string): boolean {
  // Must have extension
  if (!/\.[a-z]{1,4}$/i.test(str)) return false;

  // Common code file extensions
  const codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.svelte', '.py', '.rb', '.go', '.rs',
    '.java', '.kt', '.swift', '.cs', '.php',
    '.json', '.yaml', '.yml', '.toml', '.md',
  ];

  return codeExtensions.some((ext) => str.endsWith(ext));
}

/**
 * Extract function/class names mentioned in task
 *
 * @param description - Task description
 * @returns Array of symbol names
 */
export function extractSymbols(description: string): string[] {
  const patterns = [
    /`(\w+(?:\.prototype)?\.\w+)`/g, // Method references
    /`(\w+)`/g, // Backtick-wrapped identifiers
    /(?:function|class|const|let|var)\s+(\w+)/g, // Declarations
    /(\w+)\(\)/g, // Function calls
  ];

  const symbols = new Set<string>();

  for (const pattern of patterns) {
    const matches = description.matchAll(pattern);
    for (const match of matches) {
      const symbol = match[1];
      if (symbol && isLikelySymbol(symbol)) {
        symbols.add(symbol);
      }
    }
  }

  return Array.from(symbols);
}

/**
 * Check if string looks like a code symbol
 */
function isLikelySymbol(str: string): boolean {
  // Too short
  if (str.length < 2) return false;

  // Common words to exclude
  const excludeWords = [
    'the', 'and', 'for', 'with', 'this', 'that', 'from',
    'into', 'when', 'then', 'should', 'must', 'will',
  ];

  if (excludeWords.includes(str.toLowerCase())) return false;

  // Should contain letters
  if (!/[a-zA-Z]/.test(str)) return false;

  return true;
}
