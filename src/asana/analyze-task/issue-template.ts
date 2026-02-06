/**
 * @module asana/analyze-task/issue-template
 * @description GitHub Issue template generation
 */

import type { FormattedTaskDetail } from '../get-task/tool.js';
import type { HeuristicResult, TaskClassification } from './heuristics.js';
import type { ConfidenceScore } from './confidence.js';
import type { CodebaseContext } from './codebase.js';
import type { IssueType, IssueContext, AcceptanceCriteria } from '../../common/types/index.js';

/** Generated issue template */
export interface IssueTemplate {
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
}

/** Issue template options */
export interface IssueTemplateOptions {
  /** Include Asana link */
  readonly includeAsanaLink?: boolean;
  /** Include analysis metadata */
  readonly includeMetadata?: boolean;
  /** Include acceptance criteria section */
  readonly includeAcceptanceCriteria?: boolean;
  /** Include technical context */
  readonly includeTechnicalContext?: boolean;
  /** Custom label prefix */
  readonly labelPrefix?: string;
  /** Repository owner for cross-references */
  readonly repoOwner?: string;
  /** Repository name for cross-references */
  readonly repoName?: string;
}

/**
 * Generate GitHub Issue template from task analysis
 *
 * @param task - Task details
 * @param heuristics - Heuristic analysis result
 * @param confidence - Confidence score
 * @param codebaseContext - Codebase exploration result
 * @param options - Template options
 * @returns Issue template
 */
export function generateIssueTemplate(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult,
  confidence: ConfidenceScore,
  codebaseContext: CodebaseContext,
  options: IssueTemplateOptions = {}
): IssueTemplate {
  const {
    includeAsanaLink = true,
    includeMetadata = true,
    includeAcceptanceCriteria = true,
    includeTechnicalContext = true,
    labelPrefix = '',
  } = options;

  // Generate title
  const title = generateTitle(task, heuristics);

  // Generate body sections
  const sections: string[] = [];

  // Source link
  if (includeAsanaLink) {
    sections.push(`> **Source:** [Asana Task](${task.url})`);
    sections.push('');
  }

  // Description
  sections.push('## Description');
  sections.push('');
  sections.push(task.markdownDescription || '_No description provided_');
  sections.push('');

  // Technical context
  if (includeTechnicalContext && codebaseContext.existingFiles.length > 0) {
    sections.push('## Technical Context');
    sections.push('');
    sections.push('### Affected Files');
    for (const file of codebaseContext.existingFiles) {
      sections.push(`- \`${file.path}\``);
    }
    sections.push('');

    if (codebaseContext.foundSymbols.length > 0) {
      sections.push('### Related Symbols');
      for (const symbol of codebaseContext.foundSymbols) {
        sections.push(`- \`${symbol.name}\` (${symbol.type})`);
      }
      sections.push('');
    }

    if (codebaseContext.testFiles.length > 0) {
      sections.push('### Test Files');
      for (const file of codebaseContext.testFiles) {
        sections.push(`- \`${file.path}\``);
      }
      sections.push('');
    }
  }

  // Acceptance criteria
  if (includeAcceptanceCriteria) {
    sections.push('## Acceptance Criteria');
    sections.push('');
    const criteria = extractAcceptanceCriteria(task.markdownDescription);
    if (criteria.length > 0) {
      for (const criterion of criteria) {
        const checkbox = criterion.completed ? '[x]' : '[ ]';
        sections.push(`- ${checkbox} ${criterion.description}`);
      }
    } else {
      sections.push('- [ ] Implementation complete');
      sections.push('- [ ] Tests pass');
      if (heuristics.hasTestingRequirement) {
        sections.push('- [ ] New tests added');
      }
      sections.push('- [ ] Documentation updated (if applicable)');
    }
    sections.push('');
  }

  // Analysis metadata
  if (includeMetadata) {
    sections.push('## Analysis');
    sections.push('');
    sections.push(`- **Classification:** ${heuristics.classification}`);
    sections.push(`- **Complexity:** ${heuristics.estimatedComplexity}`);
    sections.push(`- **Confidence:** ${confidence.level} (${confidence.overall}/100)`);
    sections.push('');

    if (confidence.suggestions.length > 0) {
      sections.push('### Suggestions for Improvement');
      for (const suggestion of confidence.suggestions) {
        sections.push(`- ${suggestion}`);
      }
      sections.push('');
    }
  }

  // Labels
  const labels = generateLabels(heuristics, confidence, labelPrefix);

  // Assignees (empty by default)
  const assignees: string[] = [];

  return {
    title,
    body: sections.join('\n'),
    labels,
    assignees,
  };
}

/**
 * Generate issue title from task
 */
function generateTitle(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult
): string {
  let title = task.name;

  // Add prefix based on classification
  const prefixes: Record<TaskClassification, string> = {
    bug: '[Bug]',
    feature: '[Feature]',
    refactor: '[Refactor]',
    docs: '[Docs]',
    test: '[Test]',
    chore: '[Chore]',
    unknown: '',
  };

  const prefix = prefixes[heuristics.classification];
  if (prefix && !title.toLowerCase().startsWith(prefix.toLowerCase().slice(1, -1))) {
    title = `${prefix} ${title}`;
  }

  // Truncate if too long
  if (title.length > 100) {
    title = title.slice(0, 97) + '...';
  }

  return title;
}

/**
 * Generate labels from analysis
 */
function generateLabels(
  heuristics: HeuristicResult,
  confidence: ConfidenceScore,
  prefix: string
): string[] {
  const labels: string[] = [];

  // Type label
  const typeMap: Record<TaskClassification, string> = {
    bug: 'bug',
    feature: 'enhancement',
    refactor: 'refactor',
    docs: 'documentation',
    test: 'testing',
    chore: 'chore',
    unknown: '',
  };

  const typeLabel = typeMap[heuristics.classification];
  if (typeLabel) {
    labels.push(prefix ? `${prefix}${typeLabel}` : typeLabel);
  }

  // Complexity label
  labels.push(
    prefix
      ? `${prefix}complexity:${heuristics.estimatedComplexity}`
      : `complexity:${heuristics.estimatedComplexity}`
  );

  // Auto-fix label if high confidence
  if (confidence.level === 'high' || confidence.level === 'very_high') {
    labels.push(prefix ? `${prefix}auto-fix` : 'auto-fix');
  }

  // Needs review if low confidence
  if (confidence.level === 'low' || confidence.level === 'very_low') {
    labels.push(prefix ? `${prefix}needs-review` : 'needs-review');
  }

  return labels;
}

/**
 * Extract acceptance criteria from description
 */
function extractAcceptanceCriteria(description: string): AcceptanceCriteria[] {
  const criteria: AcceptanceCriteria[] = [];

  // Look for checklist items
  const checklistRegex = /^\s*[-*]\s*\[([ x])\]\s*(.+)$/gm;
  let match;
  while ((match = checklistRegex.exec(description)) !== null) {
    const descText = match[2];
    const checkMark = match[1];
    if (descText !== undefined && checkMark !== undefined) {
      criteria.push({
        description: descText.trim(),
        completed: checkMark.toLowerCase() === 'x',
      });
    }
  }

  // Look for numbered list items
  if (criteria.length === 0) {
    const numberedRegex = /^\s*\d+\.\s+(.+)$/gm;
    while ((match = numberedRegex.exec(description)) !== null) {
      const descText = match[1];
      if (descText !== undefined) {
        criteria.push({
          description: descText.trim(),
          completed: false,
        });
      }
    }
  }

  return criteria;
}

/**
 * Generate issue context from task
 *
 * @param task - Task details
 * @param heuristics - Heuristic result
 * @param codebaseContext - Codebase context
 * @returns Issue context
 */
export function generateIssueContext(
  task: FormattedTaskDetail,
  heuristics: HeuristicResult,
  codebaseContext: CodebaseContext
): IssueContext {
  // Map classification to priority
  const priorityMap: Record<TaskClassification, 'critical' | 'high' | 'medium' | 'low'> = {
    bug: 'high',
    feature: 'medium',
    refactor: 'low',
    docs: 'low',
    test: 'medium',
    chore: 'low',
    unknown: 'medium',
  };

  return {
    component: deriveComponent(task, codebaseContext),
    priority: priorityMap[heuristics.classification],
    relatedFiles: codebaseContext.existingFiles.map((f) => f.path),
    relatedSymbols: codebaseContext.foundSymbols.map((s) => s.name),
    source: 'asana',
    sourceId: task.gid,
    sourceUrl: task.url,
  };
}

/**
 * Derive component name from task and context
 */
function deriveComponent(
  task: FormattedTaskDetail,
  codebaseContext: CodebaseContext
): string {
  // Try to derive from file paths
  for (const file of codebaseContext.existingFiles) {
    const parts = file.path.split('/');
    if (parts.includes('src')) {
      const srcIndex = parts.indexOf('src');
      const componentPart = parts[srcIndex + 1];
      if (componentPart !== undefined) {
        return componentPart;
      }
    }
  }

  // Try to derive from task tags
  for (const tag of task.tags) {
    const lower = tag.name.toLowerCase();
    if (
      !['bug', 'feature', 'urgent', 'priority'].some((t) => lower.includes(t))
    ) {
      return tag.name;
    }
  }

  // Default
  return 'general';
}

/**
 * Map task classification to issue type
 *
 * @param classification - Task classification
 * @returns Issue type
 */
export function classificationToIssueType(
  classification: TaskClassification
): IssueType {
  const map: Record<TaskClassification, IssueType> = {
    bug: 'bug',
    feature: 'feature',
    refactor: 'refactor',
    docs: 'docs',
    test: 'test',
    chore: 'chore',
    unknown: 'chore',
  };
  return map[classification];
}
