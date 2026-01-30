/**
 * @module asana/analyze-task/tool
 * @description MCP Tool registration for analyze-task
 */

import { z } from 'zod';
import type { AsanaConfig } from '../../common/types/index.js';
import { ok, err, type Result } from '../../common/types/index.js';
import { getTaskWithCache } from '../get-task/cache.js';
import { analyzeWithHeuristics } from './heuristics.js';
import { calculateConfidence, meetsConfidenceThreshold } from './confidence.js';
import { exploreCodebase } from './codebase.js';
import { generateIssueTemplate, generateIssueContext } from './issue-template.js';
import {
  generateFailureReasons,
  generateSummaryMessage,
  generateAsanaNotification,
  getRecommendation
} from './messages.js';
import type { FormattedTaskDetail } from '../get-task/tool.js';

/** Tool input schema */
export const AnalyzeTaskInputSchema = z.object({
  taskGid: z.string().describe('Asana task GID'),
  exploreCodebase: z.boolean().optional().default(true).describe('Explore codebase for context'),
  generateIssue: z.boolean().optional().default(true).describe('Generate GitHub issue template'),
  confidenceThreshold: z.enum(['very_low', 'low', 'medium', 'high', 'very_high'])
    .optional()
    .default('medium')
    .describe('Minimum confidence level for auto-processing'),
  includeMetadata: z.boolean().optional().default(true).describe('Include analysis metadata in output'),
  format: z.enum(['json', 'markdown']).optional().default('json').describe('Output format'),
});

export type AnalyzeTaskInput = z.infer<typeof AnalyzeTaskInputSchema>;

/** Analysis result type */
export type AnalysisResult =
  | 'success'
  | 'needs-more-info'
  | 'cannot-reproduce'
  | 'unclear-requirement'
  | 'needs-context';

/** Tool output type */
export interface AnalyzeTaskOutput {
  readonly content: string;
  readonly format: 'json' | 'markdown';
  readonly analysis: {
    readonly analysisResult: AnalysisResult;
    readonly confidence: number;
    readonly confidenceLevel: string;
    readonly classification: string;
    readonly complexity: string;
    readonly githubIssue?: {
      readonly title: string;
      readonly body: string;
      readonly labels: readonly string[];
    };
    readonly codeContext?: {
      readonly files: readonly string[];
      readonly component: string;
      readonly functions: readonly string[];
    };
    readonly asanaUpdate: {
      readonly tag: string;
      readonly comment: string;
      readonly section?: string;
    };
    readonly recommendations: readonly string[];
  };
}

/** Tool error type */
export interface AnalyzeTaskError {
  readonly code: string;
  readonly message: string;
}

/**
 * Execute analyze-task tool
 *
 * @param config - Asana configuration
 * @param input - Tool input
 * @returns Tool output or error
 */
export async function executeAnalyzeTask(
  config: AsanaConfig,
  input: AnalyzeTaskInput
): Promise<Result<AnalyzeTaskOutput, AnalyzeTaskError>> {
  try {
    // Fetch task
    const rawTask = await getTaskWithCache(config, input.taskGid);
    const task = await buildFormattedTask(rawTask);

    // Run heuristic analysis
    const heuristics = analyzeWithHeuristics(task);

    // Calculate confidence
    const confidence = calculateConfidence(task, heuristics);

    // Explore codebase if requested
    const codebaseContext = input.exploreCodebase
      ? await exploreCodebase(task)
      : {
          existingFiles: [],
          missingFiles: [],
          foundSymbols: [],
          missingSymbols: [],
          relatedFiles: [],
          testFiles: [],
        };

    // Generate failure reasons and summary
    const failureReasons = generateFailureReasons(heuristics, confidence);
    const summaryMessage = generateSummaryMessage(heuristics, confidence, failureReasons);
    const recommendation = getRecommendation(confidence.level);

    // Determine analysis result
    const analysisResult = determineAnalysisResult(
      confidence.level,
      heuristics.classification,
      heuristics.hasClearAcceptanceCriteria
    );

    // Generate GitHub issue if requested
    let githubIssue: { title: string; body: string; labels: readonly string[] } | undefined;
    if (input.generateIssue) {
      const template = generateIssueTemplate(task, heuristics, confidence, codebaseContext, {
        includeAsanaLink: true,
        includeMetadata: input.includeMetadata,
        includeAcceptanceCriteria: true,
        includeTechnicalContext: true,
      });
      githubIssue = {
        title: template.title,
        body: template.body,
        labels: template.labels,
      };
    }

    // Build code context
    const codeContext = codebaseContext.existingFiles.length > 0
      ? {
          files: codebaseContext.existingFiles.map(f => f.path),
          component: generateIssueContext(task, heuristics, codebaseContext).component,
          functions: codebaseContext.foundSymbols.map(s => s.name),
        }
      : undefined;

    // Generate Asana update
    const asanaComment = generateAsanaNotification(summaryMessage, recommendation);
    const asanaUpdate = {
      tag: determineAsanaTag(analysisResult, confidence.level),
      comment: asanaComment,
      section: determineSectionMove(analysisResult, confidence.level),
    };

    // Build analysis response
    const analysis = {
      analysisResult,
      confidence: confidence.overall,
      confidenceLevel: confidence.level,
      classification: heuristics.classification,
      complexity: heuristics.estimatedComplexity,
      githubIssue,
      codeContext,
      asanaUpdate,
      recommendations: summaryMessage.suggestions,
    };

    // Format output
    const content = input.format === 'markdown'
      ? formatAnalysisAsMarkdown(analysis, task, input.includeMetadata)
      : JSON.stringify(analysis, null, 2);

    return ok({
      content,
      format: input.format ?? 'json',
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('Not Found')) {
      return err({
        code: 'TASK_NOT_FOUND',
        message: `Task ${input.taskGid} not found`,
      });
    }

    return err({
      code: 'ANALYSIS_ERROR',
      message,
    });
  }
}

/**
 * Build formatted task from raw data
 */
async function buildFormattedTask(raw: any): Promise<FormattedTaskDetail> {
  // Import htmlToMarkdown here to avoid circular dependency
  const { htmlToMarkdown } = await import('../get-task/html-to-md.js');
  const { convertCustomFields } = await import('../get-task/custom-fields.js');

  const customFields = convertCustomFields(raw.customFields);
  const markdownDescription = raw.htmlNotes
    ? htmlToMarkdown(raw.htmlNotes, { convertMentions: true })
    : raw.notes;

  return {
    gid: raw.gid,
    name: raw.name,
    description: raw.notes,
    htmlDescription: raw.htmlNotes,
    markdownDescription,
    completed: raw.completed,
    status: raw.completed ? 'completed' : 'incomplete',
    createdAt: raw.createdAt,
    modifiedAt: raw.modifiedAt,
    dueOn: raw.dueOn,
    dueAt: raw.dueAt,
    startOn: raw.startOn,
    assignee: raw.assignee,
    projects: raw.projects,
    tags: raw.tags,
    customFields,
    url: raw.permalink,
    parentTask: raw.parent,
  };
}

/**
 * Determine overall analysis result
 */
function determineAnalysisResult(
  confidenceLevel: string,
  classification: string,
  hasClearAcceptanceCriteria: boolean
): AnalysisResult {
  // Very low confidence or unknown classification
  if (confidenceLevel === 'very_low' || classification === 'unknown') {
    return 'unclear-requirement';
  }

  // Low confidence without acceptance criteria
  if (confidenceLevel === 'low' && !hasClearAcceptanceCriteria) {
    return 'needs-more-info';
  }

  // Bug without clear reproduction steps
  if (classification === 'bug' && !hasClearAcceptanceCriteria) {
    return 'cannot-reproduce';
  }

  // Medium confidence without code context
  if (confidenceLevel === 'medium' && !hasClearAcceptanceCriteria) {
    return 'needs-context';
  }

  // High or very high confidence
  return 'success';
}

/**
 * Determine Asana tag based on analysis result
 */
function determineAsanaTag(
  analysisResult: AnalysisResult,
  confidenceLevel: string
): string {
  const tagMap: Record<AnalysisResult, string> = {
    'success': confidenceLevel === 'very_high' ? 'auto-fix-ready' : 'auto-fix-candidate',
    'needs-more-info': 'needs-info',
    'cannot-reproduce': 'needs-reproduction',
    'unclear-requirement': 'needs-clarification',
    'needs-context': 'needs-details',
  };
  return tagMap[analysisResult];
}

/**
 * Determine section move based on analysis
 */
function determineSectionMove(
  analysisResult: AnalysisResult,
  confidenceLevel: string
): string | undefined {
  if (analysisResult === 'success' && (confidenceLevel === 'high' || confidenceLevel === 'very_high')) {
    return 'Ready for Auto-Fix';
  }
  if (analysisResult !== 'success') {
    return 'Needs Review';
  }
  return undefined;
}

/**
 * Format analysis as Markdown
 */
function formatAnalysisAsMarkdown(
  analysis: AnalyzeTaskOutput['analysis'],
  task: FormattedTaskDetail,
  includeMetadata: boolean
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# Task Analysis: ${task.name}`);
  lines.push('');

  // Result badge
  const resultBadge = analysis.analysisResult === 'success' ? '[READY]' : '[NEEDS REVIEW]';
  lines.push(`**Result:** ${resultBadge} ${analysis.analysisResult}`);
  lines.push('');

  // Confidence
  lines.push(`**Confidence:** ${analysis.confidenceLevel} (${analysis.confidence}/100)`);
  lines.push(`**Classification:** ${analysis.classification}`);
  lines.push(`**Complexity:** ${analysis.complexity}`);
  lines.push('');

  // Code context
  if (analysis.codeContext) {
    lines.push('## Code Context');
    lines.push('');
    lines.push(`**Component:** ${analysis.codeContext.component}`);
    lines.push('');

    if (analysis.codeContext.files.length > 0) {
      lines.push('**Files:**');
      for (const file of analysis.codeContext.files) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    if (analysis.codeContext.functions.length > 0) {
      lines.push('**Functions:**');
      for (const func of analysis.codeContext.functions) {
        lines.push(`- \`${func}\``);
      }
      lines.push('');
    }
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of analysis.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Asana update
  lines.push('## Asana Update');
  lines.push('');
  lines.push(`**Tag:** \`${analysis.asanaUpdate.tag}\``);
  if (analysis.asanaUpdate.section) {
    lines.push(`**Move to:** ${analysis.asanaUpdate.section}`);
  }
  lines.push('');
  lines.push('**Comment:**');
  lines.push('```');
  lines.push(analysis.asanaUpdate.comment);
  lines.push('```');
  lines.push('');

  // GitHub issue
  if (analysis.githubIssue && includeMetadata) {
    lines.push('## GitHub Issue');
    lines.push('');
    lines.push(`**Title:** ${analysis.githubIssue.title}`);
    lines.push(`**Labels:** ${analysis.githubIssue.labels.join(', ')}`);
    lines.push('');
    lines.push('**Body:**');
    lines.push('```markdown');
    lines.push(analysis.githubIssue.body);
    lines.push('```');
  }

  return lines.join('\n');
}

/**
 * Get MCP tool definition
 */
export function getToolDefinition() {
  return {
    name: 'asana_analyze_task',
    description:
      'Analyze an Asana task to determine if it is ready for automated processing. Provides confidence score, classification, code context, and GitHub issue template.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskGid: {
          type: 'string',
          description: 'Asana task GID',
        },
        exploreCodebase: {
          type: 'boolean',
          description: 'Explore codebase for context (default: true)',
        },
        generateIssue: {
          type: 'boolean',
          description: 'Generate GitHub issue template (default: true)',
        },
        confidenceThreshold: {
          type: 'string',
          enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
          description: 'Minimum confidence level for auto-processing (default: medium)',
        },
        includeMetadata: {
          type: 'boolean',
          description: 'Include analysis metadata in output (default: true)',
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          description: 'Output format (default: json)',
        },
      },
      required: ['taskGid'],
    },
  };
}
