/**
 * @module analyzer/issue-generator/template
 * @description Markdown template system for GitHub Issues
 */

import type { IssueType, IssueSource } from '../../common/types/index.js';
import type { CodeLocation } from '../code-locator/types.js';

/**
 * Template data for issue generation
 */
export interface TemplateData {
  readonly type: IssueType;
  readonly source: IssueSource;
  readonly sourceUrl?: string | undefined;
  readonly component?: string | undefined;
  readonly files?: readonly string[] | undefined;
  readonly locations?: readonly CodeLocation[] | undefined;
  readonly description: string;
  readonly errorMessage?: string | undefined;
  readonly stackTrace?: string | undefined;
  readonly codeSnippet?: string | undefined;
  readonly suggestedFix?: readonly string[] | undefined;
  readonly acceptanceCriteria?: readonly string[] | undefined;
}

/**
 * Render type section with checkbox
 */
export function renderTypeSection(type: IssueType, source: IssueSource): string {
  const typeLabels: Record<IssueType, string> = {
    bug: '🐛 Bug Report',
    feature: '✨ Feature Request',
    refactor: '♻️ Refactor',
    docs: '📝 Documentation',
    test: '🧪 Test',
    chore: '🔧 Chore',
  };

  const sourceLabels: Record<IssueSource, string> = {
    sentry: '🔴 Sentry Error',
    asana: '📋 Asana Task',
    github: '💬 GitHub Issue',
    manual: '✍️ Manual',
  };

  return `### Type
- [x] ${typeLabels[type] || '🐛 Bug Report'}

### Source
- **Origin**: ${sourceLabels[source] || source}`;
}

/**
 * Render source section with reference link
 */
export function renderSourceSection(
  source: IssueSource,
  sourceUrl: string | undefined
): string {
  if (!sourceUrl) {
    return `- **Origin**: ${source}`;
  }
  return `- **Origin**: ${source}
- **Reference**: [View Source](${sourceUrl})`;
}

/**
 * Render context section with file and location info
 */
export function renderContextSection(data: {
  readonly component?: string | undefined;
  readonly locations?: readonly CodeLocation[] | undefined;
  readonly files?: readonly string[] | undefined;
}): string {
  const parts: string[] = [];

  if (data.component) {
    parts.push(`- **컴포넌트**: ${data.component}`);
  }

  if (data.locations && data.locations.length > 0) {
    const primary = data.locations[0];
    if (primary) {
      parts.push(`- **파일**: \`${primary.filePath}\``);

      if (primary.functionName) {
        parts.push(`- **함수/클래스**: \`${primary.functionName}\``);
      } else if (primary.className) {
        parts.push(`- **클래스**: \`${primary.className}\``);
      }

      if (primary.lineNumber) {
        parts.push(`- **라인**: ${primary.lineNumber}`);
      }

      // List additional related files
      if (data.locations.length > 1) {
        const otherFiles = data.locations
          .slice(1)
          .map((loc) => `\`${loc.filePath}\``)
          .join(', ');
        parts.push(`- **관련 파일**: ${otherFiles}`);
      }
    }
  } else if (data.files && data.files.length > 0) {
    parts.push(`- **관련 파일**: ${data.files.map((f) => `\`${f}\``).join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '- **파일**: (미확인)';
}

/**
 * Render code analysis section with snippet
 */
export function renderCodeAnalysisSection(data: {
  readonly codeSnippet?: string | undefined;
  readonly errorMessage?: string | undefined;
}): string {
  if (!data.codeSnippet && !data.errorMessage) {
    return '';
  }

  const parts: string[] = ['### Code Analysis'];

  if (data.codeSnippet) {
    parts.push('```typescript');
    parts.push(data.codeSnippet);
    parts.push('```');
  }

  if (data.errorMessage) {
    parts.push('');
    parts.push('**에러 메시지:**');
    parts.push('```');
    parts.push(data.errorMessage);
    parts.push('```');
  }

  return parts.join('\n');
}

/**
 * Render suggested fix section
 */
export function renderSuggestedFixSection(
  suggestions: readonly string[] | undefined
): string {
  if (!suggestions || suggestions.length === 0) {
    return '';
  }

  const parts: string[] = ['### Suggested Fix Direction'];
  suggestions.forEach((suggestion) => {
    parts.push(`- ${suggestion}`);
  });

  return parts.join('\n');
}

/**
 * Render acceptance criteria section
 */
export function renderAcceptanceCriteriaSection(
  criteria: readonly string[] | undefined
): string {
  if (!criteria || criteria.length === 0) {
    // Default criteria
    return `### Acceptance Criteria
- [ ] 에러가 더 이상 발생하지 않음
- [ ] 기존 테스트 모두 통과
- [ ] 새로운 테스트 추가 (필요시)`;
  }

  const parts: string[] = ['### Acceptance Criteria'];
  criteria.forEach((criterion) => {
    parts.push(`- [ ] ${criterion}`);
  });

  return parts.join('\n');
}

/**
 * Generate complete issue body from template data
 */
export function generateIssueBody(data: TemplateData): string {
  const sections: string[] = [
    '## 🤖 Auto-Fix Issue',
    '',
    renderTypeSection(data.type, data.source),
  ];

  if (data.sourceUrl) {
    sections.push('');
    sections.push(renderSourceSection(data.source, data.sourceUrl));
  }

  sections.push('');
  sections.push('### Context');
  sections.push(
    renderContextSection({
      component: data.component,
      locations: data.locations,
      files: data.files,
    })
  );

  if (data.description) {
    sections.push('');
    sections.push('### Problem Description');
    sections.push(data.description);
  }

  if (data.stackTrace) {
    sections.push('');
    sections.push('### Stack Trace');
    sections.push('```');
    sections.push(data.stackTrace);
    sections.push('```');
  }

  const codeAnalysis = renderCodeAnalysisSection({
    codeSnippet: data.codeSnippet,
    errorMessage: data.errorMessage,
  });
  if (codeAnalysis) {
    sections.push('');
    sections.push(codeAnalysis);
  }

  const suggestedFix = renderSuggestedFixSection(data.suggestedFix);
  if (suggestedFix) {
    sections.push('');
    sections.push(suggestedFix);
  }

  sections.push('');
  sections.push(
    renderAcceptanceCriteriaSection(data.acceptanceCriteria)
  );

  sections.push('');
  sections.push('---');
  sections.push('> This issue was automatically generated for auto-fix workflow.');

  return sections.join('\n');
}
