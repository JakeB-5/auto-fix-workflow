/**
 * @module asana/analyze-task/llm-analysis
 * @description LLM-based analysis (stub for now)
 */

import type { FormattedTaskDetail } from '../get-task/tool.js';
import type { HeuristicResult } from './heuristics.js';
import type { ConfidenceScore } from './confidence.js';

/** LLM analysis result */
export interface LLMAnalysisResult {
  /** Whether LLM analysis was performed */
  readonly performed: boolean;
  /** Reason if not performed */
  readonly skipReason?: string;
  /** Refined classification */
  readonly refinedClassification?: string;
  /** Implementation approach summary */
  readonly implementationApproach?: string;
  /** Potential risks identified */
  readonly risks?: readonly string[];
  /** Questions for clarification */
  readonly clarificationQuestions?: readonly string[];
  /** Estimated effort */
  readonly effortEstimate?: string;
  /** Related patterns or prior art */
  readonly relatedPatterns?: readonly string[];
  /** Raw LLM response */
  readonly rawResponse?: string;
}

/** LLM analysis options */
export interface LLMAnalysisOptions {
  /** Enable LLM analysis */
  readonly enabled?: boolean;
  /** LLM model to use */
  readonly model?: string;
  /** Custom prompt template */
  readonly promptTemplate?: string;
  /** Maximum tokens for response */
  readonly maxTokens?: number;
  /** Temperature for generation */
  readonly temperature?: number;
}

/**
 * Analyze task with LLM (stub implementation)
 *
 * This is a placeholder for future LLM integration.
 * Currently returns a stub result indicating LLM analysis is not performed.
 *
 * @param _task - Task details
 * @param _heuristics - Heuristic analysis result
 * @param _confidence - Confidence score
 * @param _options - LLM options
 * @returns LLM analysis result
 */
export async function analyzeWithLLM(
  _task: FormattedTaskDetail,
  _heuristics: HeuristicResult,
  _confidence: ConfidenceScore,
  _options: LLMAnalysisOptions = {}
): Promise<LLMAnalysisResult> {
  // Stub implementation - LLM integration to be added later
  return {
    performed: false,
    skipReason: 'LLM analysis not yet implemented',
  };
}

/**
 * Generate LLM prompt for task analysis
 *
 * @param task - Task details
 * @param heuristics - Heuristic analysis result
 * @param confidence - Confidence score
 * @returns Prompt string
 */
export function generateAnalysisPrompt(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult,
  confidence: ConfidenceScore
): string {
  return `
Analyze the following task and provide insights:

## Task: ${task.name}

### Description
${task.markdownDescription}

### Current Analysis
- Classification: ${heuristics.classification}
- Complexity: ${heuristics.estimatedComplexity}
- Confidence: ${confidence.level} (${confidence.overall}/100)

### Tags
${task.tags.map((t) => t.name).join(', ') || 'None'}

### Custom Fields
${task.customFields.map((cf) => `- ${cf.name}: ${cf.displayValue}`).join('\n') || 'None'}

---

Please provide:
1. Refined classification if the heuristic is incorrect
2. Implementation approach (2-3 sentences)
3. Potential risks or blockers
4. Questions that need clarification
5. Effort estimate (small/medium/large)
6. Related patterns or similar past implementations

Respond in JSON format.
`.trim();
}

/**
 * Check if LLM analysis would be beneficial
 *
 * @param confidence - Confidence score
 * @param heuristics - Heuristic result
 * @returns True if LLM analysis would help
 */
export function shouldUseLLM(
  confidence: ConfidenceScore,
  heuristics: HeuristicResult
): boolean {
  // Use LLM when confidence is not high enough
  if (confidence.overall < 70) return true;

  // Use LLM when classification is unknown
  if (heuristics.classification === 'unknown') return true;

  // Use LLM when complexity is high
  if (heuristics.estimatedComplexity === 'high') return true;

  // Use LLM when there are many negative factors
  if (confidence.negativeFactors.length >= 3) return true;

  return false;
}

/**
 * Parse LLM response
 *
 * @param response - Raw LLM response
 * @returns Parsed result or null
 */
export function parseLLMResponse(response: string): Partial<LLMAnalysisResult> | null {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const classification = parsed['classification'];
    const approach = parsed['approach'];
    const risks = parsed['risks'];
    const questions = parsed['questions'];
    const effort = parsed['effort'];
    const patterns = parsed['patterns'];

    return {
      rawResponse: response,
      ...(typeof classification === 'string' && { refinedClassification: classification }),
      ...(typeof approach === 'string' && { implementationApproach: approach }),
      ...(Array.isArray(risks) && { risks: risks as string[] }),
      ...(Array.isArray(questions) && { clarificationQuestions: questions as string[] }),
      ...(typeof effort === 'string' && { effortEstimate: effort }),
      ...(Array.isArray(patterns) && { relatedPatterns: patterns as string[] }),
    };
  } catch {
    return null;
  }
}

/**
 * Create LLM analysis result from parsed response
 *
 * @param parsed - Parsed LLM response
 * @param rawResponse - Original response
 * @returns Full analysis result
 */
export function createLLMResult(
  parsed: Partial<LLMAnalysisResult>,
  rawResponse: string
): LLMAnalysisResult {
  return {
    performed: true,
    risks: parsed.risks ?? [],
    clarificationQuestions: parsed.clarificationQuestions ?? [],
    relatedPatterns: parsed.relatedPatterns ?? [],
    rawResponse,
    ...(parsed.refinedClassification !== undefined && { refinedClassification: parsed.refinedClassification }),
    ...(parsed.implementationApproach !== undefined && { implementationApproach: parsed.implementationApproach }),
    ...(parsed.effortEstimate !== undefined && { effortEstimate: parsed.effortEstimate }),
  };
}
