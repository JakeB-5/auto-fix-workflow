/**
 * @module github/create-pr/body-generator
 * @description PR 본문 자동 생성 유틸리티
 */

import type { Issue } from '../../common/types/index.js';
import type { ChangeInfo } from './types.js';

/**
 * PR 본문 생성
 *
 * @param issues - PR에 연결될 이슈 목록
 * @param changes - 변경사항 정보 (선택사항)
 * @returns 생성된 PR 본문 (Markdown)
 *
 * @example
 * ```typescript
 * const body = generatePRBody(issues, changes);
 * ```
 */
export function generatePRBody(
  issues: readonly Issue[],
  changes?: readonly ChangeInfo[]
): string {
  const sections: string[] = [];

  // 1. 개요 섹션
  sections.push(generateOverviewSection(issues));

  // 2. 변경사항 섹션
  if (changes && changes.length > 0) {
    sections.push(generateChangesSection(changes));
  }

  // 3. 연결된 이슈 섹션
  sections.push(generateLinkedIssuesSection(issues));

  // 4. 테스트 정보 섹션
  sections.push(generateTestInfoSection(issues));

  // 5. 체크리스트 섹션
  sections.push(generateChecklistSection());

  return sections.join('\n\n');
}

/**
 * 개요 섹션 생성
 */
function generateOverviewSection(issues: readonly Issue[]): string {
  const lines: string[] = ['## Overview'];

  if (issues.length === 0) {
    lines.push('This PR contains updates.');
    return lines.join('\n');
  }

  if (issues.length === 1) {
    const issue = issues[0]!;
    lines.push(`This PR resolves #${issue.number}: ${issue.title}`);
    if (issue.body) {
      lines.push('');
      lines.push(issue.body.split('\n').slice(0, 3).join('\n')); // 첫 3줄만
    }
  } else {
    lines.push(`This PR resolves ${issues.length} issues:`);
    for (const issue of issues) {
      lines.push(`- #${issue.number}: ${issue.title}`);
    }
  }

  return lines.join('\n');
}

/**
 * 변경사항 섹션 생성
 */
function generateChangesSection(changes: readonly ChangeInfo[]): string {
  const lines: string[] = ['## Changes'];

  // 변경 유형별로 그룹화
  const grouped = {
    added: changes.filter((c) => c.changeType === 'added'),
    modified: changes.filter((c) => c.changeType === 'modified'),
    deleted: changes.filter((c) => c.changeType === 'deleted'),
    renamed: changes.filter((c) => c.changeType === 'renamed'),
  };

  if (grouped.added.length > 0) {
    lines.push('### Added');
    for (const change of grouped.added) {
      lines.push(`- ${change.filePath} (+${change.additions})`);
    }
    lines.push('');
  }

  if (grouped.modified.length > 0) {
    lines.push('### Modified');
    for (const change of grouped.modified) {
      const stats = `(+${change.additions}/-${change.deletions})`;
      lines.push(`- ${change.filePath} ${stats}`);
    }
    lines.push('');
  }

  if (grouped.deleted.length > 0) {
    lines.push('### Deleted');
    for (const change of grouped.deleted) {
      lines.push(`- ${change.filePath}`);
    }
    lines.push('');
  }

  if (grouped.renamed.length > 0) {
    lines.push('### Renamed');
    for (const change of grouped.renamed) {
      lines.push(`- ${change.filePath}`);
    }
    lines.push('');
  }

  // 통계 요약
  const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);
  lines.push(`**Total:** ${changes.length} files changed, +${totalAdditions}/-${totalDeletions} lines`);

  return lines.join('\n');
}

/**
 * 연결된 이슈 섹션 생성
 */
function generateLinkedIssuesSection(issues: readonly Issue[]): string {
  const lines: string[] = ['## Linked Issues'];

  if (issues.length === 0) {
    lines.push('None');
    return lines.join('\n');
  }

  for (const issue of issues) {
    lines.push(`- Closes #${issue.number}`);
  }

  return lines.join('\n');
}

/**
 * 테스트 정보 섹션 생성
 */
function generateTestInfoSection(issues: readonly Issue[]): string {
  const lines: string[] = ['## Testing'];

  // 이슈에서 테스트 관련 정보 추출
  const hasTestInfo = issues.some(
    (issue) =>
      issue.acceptanceCriteria.length > 0 ||
      issue.suggestedFix?.steps.some((step) =>
        step.toLowerCase().includes('test')
      )
  );

  if (hasTestInfo) {
    lines.push('### Test Plan');
    for (const issue of issues) {
      if (issue.acceptanceCriteria.length > 0) {
        lines.push(`**#${issue.number}:**`);
        for (const criteria of issue.acceptanceCriteria) {
          const checked = criteria.completed ? 'x' : ' ';
          lines.push(`- [${checked}] ${criteria.description}`);
        }
      }
    }
  } else {
    lines.push('- [ ] Manual testing completed');
    lines.push('- [ ] Unit tests added/updated');
    lines.push('- [ ] Integration tests pass');
  }

  return lines.join('\n');
}

/**
 * 체크리스트 섹션 생성
 */
function generateChecklistSection(): string {
  return [
    '## Checklist',
    '- [ ] Code follows project style guidelines',
    '- [ ] Self-review completed',
    '- [ ] Comments added for complex logic',
    '- [ ] Documentation updated',
    '- [ ] No new warnings generated',
    '- [ ] Tests added/updated and passing',
  ].join('\n');
}
