/**
 * @module analyzer/task-analyzer/actions
 * @description Asana action generation
 */

import type { TaskAnalysis, AsanaAction } from './types.js';
import { getMissingElements } from './sufficiency.js';

/**
 * Generate Asana actions based on analysis
 */
export function generateActions(
  analysis: TaskAnalysis,
  task: { name: string; notes?: string }
): AsanaAction[] {
  const actions: AsanaAction[] = [];

  // Action 1: Add analysis comment
  actions.push({
    type: 'add_comment',
    payload: {
      text: generateAnalysisComment(analysis),
    },
  });

  // Action 2: Request missing information if insufficient
  if (analysis.informationSufficiency === 'insufficient') {
    const taskForAnalysis: { gid: string; name: string; notes?: string; completed: boolean } = {
      gid: analysis.taskId,
      name: task.name,
      ...(task.notes && { notes: task.notes }),
      completed: false,
    };

    actions.push({
      type: 'request_information',
      payload: {
        missingElements: getMissingElements(taskForAnalysis as any),
      },
    });
  }

  // Action 3: Add reproducibility tag
  if (analysis.isReproducible) {
    actions.push({
      type: 'add_tag',
      payload: {
        tagName: 'reproducible',
      },
    });
  } else {
    actions.push({
      type: 'add_tag',
      payload: {
        tagName: 'needs-investigation',
      },
    });
  }

  // Action 4: Add code hints to description if found
  if (analysis.codeHints.length > 0) {
    actions.push({
      type: 'update_description',
      payload: {
        section: 'Code Hints',
        content: generateCodeHintsSection(analysis.codeHints),
      },
    });
  }

  // Action 5: Mark as blocked if insufficient information
  if (
    analysis.informationSufficiency === 'insufficient' &&
    analysis.confidence < 0.4
  ) {
    actions.push({
      type: 'mark_blocked',
      payload: {
        reason: 'Insufficient information to proceed',
      },
    });
  }

  return actions;
}

/**
 * Generate analysis comment text
 */
function generateAnalysisComment(analysis: TaskAnalysis): string {
  const lines: string[] = [
    '🤖 **Automated Task Analysis**',
    '',
    `**Reproducibility**: ${analysis.isReproducible ? '✅ Reproducible' : '❌ Not Reproducible'}`,
    `**Confidence**: ${(analysis.confidence * 100).toFixed(0)}%`,
    `**Information Sufficiency**: ${formatSufficiency(analysis.informationSufficiency)}`,
    '',
  ];

  if (analysis.codeHints.length > 0) {
    lines.push('**Potential Code Locations**:');
    for (const hint of analysis.codeHints.slice(0, 5)) {
      const parts: string[] = [];
      if (hint.file) parts.push(hint.file);
      if (hint.function) parts.push(hint.function);
      if (hint.line) parts.push(`line ${hint.line}`);

      const location = parts.join(' > ');
      const confidence = (hint.confidence * 100).toFixed(0);
      lines.push(`- ${location} (${confidence}% confidence)`);
    }
    lines.push('');
  }

  if (!analysis.isReproducible) {
    lines.push(
      '⚠️ **Action Required**: This issue may require additional investigation or debugging to reproduce.'
    );
  }

  if (analysis.informationSufficiency !== 'sufficient') {
    lines.push(
      '📝 **Note**: Additional information would improve analysis accuracy.'
    );
  }

  return lines.join('\n');
}

/**
 * Format sufficiency level
 */
function formatSufficiency(level: string): string {
  switch (level) {
    case 'sufficient':
      return '✅ Sufficient';
    case 'partial':
      return '⚠️ Partial';
    case 'insufficient':
      return '❌ Insufficient';
    default:
      return level;
  }
}

/**
 * Generate code hints section
 */
function generateCodeHintsSection(
  hints: readonly { file?: string; function?: string; line?: number; confidence: number }[]
): string {
  const lines: string[] = ['### Potential Code Locations', ''];

  for (const hint of hints) {
    const parts: string[] = [];
    if (hint.file) parts.push(`**File**: \`${hint.file}\``);
    if (hint.function) parts.push(`**Function**: \`${hint.function}\``);
    if (hint.line) parts.push(`**Line**: ${hint.line}`);

    const confidence = (hint.confidence * 100).toFixed(0);
    lines.push(`- ${parts.join(', ')} (${confidence}% confidence)`);
  }

  return lines.join('\n');
}
