/**
 * @module github/create-pr/labels
 * @description PR 라벨 자동 생성 유틸리티
 */

import type { Issue, IssueType } from '../../common/types/index.js';
import type { ChangeInfo } from './types.js';

/**
 * 이슈 타입에 따른 라벨 매핑
 */
const TYPE_LABELS: Record<IssueType, string> = {
  bug: 'bug',
  feature: 'enhancement',
  refactor: 'refactor',
  docs: 'documentation',
  test: 'test',
  chore: 'chore',
};

/**
 * 우선순위 라벨 매핑
 */
const PRIORITY_LABELS: Record<string, string> = {
  critical: 'priority: critical',
  high: 'priority: high',
  medium: 'priority: medium',
  low: 'priority: low',
};

/**
 * PR에 적용할 라벨 자동 생성
 *
 * @param issues - PR에 연결될 이슈 목록
 * @param changes - 변경사항 정보 (선택사항)
 * @returns 라벨 목록
 */
export function generateLabels(
  issues: readonly Issue[],
  changes?: readonly ChangeInfo[]
): string[] {
  const labels = new Set<string>();

  // 1. 이슈 타입 기반 라벨
  for (const issue of issues) {
    const typeLabel = TYPE_LABELS[issue.type];
    if (typeLabel) {
      labels.add(typeLabel);
    }

    // 우선순위 라벨 (가장 높은 우선순위만)
    const priorityLabel = PRIORITY_LABELS[issue.context.priority];
    if (priorityLabel) {
      labels.add(priorityLabel);
    }

    // 이슈의 기존 라벨도 포함
    for (const label of issue.labels) {
      labels.add(label);
    }
  }

  // 2. 변경사항 기반 라벨
  if (changes && changes.length > 0) {
    // 큰 PR 라벨
    const totalChanges = changes.reduce(
      (sum, c) => sum + c.additions + c.deletions,
      0
    );
    if (totalChanges > 500) {
      labels.add('size: large');
    } else if (totalChanges > 100) {
      labels.add('size: medium');
    } else {
      labels.add('size: small');
    }

    // 파일 타입 기반 라벨
    const fileExtensions = new Set(
      changes.map((c) => {
        const ext = c.filePath.split('.').pop()?.toLowerCase();
        return ext || '';
      })
    );

    if (fileExtensions.has('test.ts') || fileExtensions.has('spec.ts')) {
      labels.add('test');
    }

    if (fileExtensions.has('md')) {
      labels.add('documentation');
    }

    if (
      changes.some((c) => c.filePath.includes('src/')) &&
      changes.some((c) => c.filePath.includes('test/'))
    ) {
      labels.add('with-tests');
    }
  }

  // 3. 다중 이슈 라벨
  if (issues.length > 1) {
    labels.add('multi-issue');
  }

  // 우선순위가 높은 것만 남기기 (critical > high > medium > low)
  const priorityOrder = ['priority: critical', 'priority: high', 'priority: medium', 'priority: low'];
  const existingPriorities = priorityOrder.filter((p) => labels.has(p));
  if (existingPriorities.length > 1) {
    // 가장 높은 우선순위만 남기고 나머지 제거
    const highestPriority = existingPriorities[0];
    for (const p of existingPriorities.slice(1)) {
      labels.delete(p);
    }
  }

  return Array.from(labels);
}

/**
 * 라벨 유효성 검증
 *
 * @param label - 검증할 라벨
 * @returns 유효 여부
 */
export function isValidLabel(label: string): boolean {
  // GitHub 라벨 규칙:
  // - 50자 이하
  // - 특수문자 허용
  return label.length > 0 && label.length <= 50;
}

/**
 * 라벨 정규화 (GitHub 규칙에 맞게)
 *
 * @param label - 정규화할 라벨
 * @returns 정규화된 라벨
 */
export function normalizeLabel(label: string): string {
  // 앞뒤 공백 제거
  let normalized = label.trim();

  // 연속된 공백을 하나로
  normalized = normalized.replace(/\s+/g, ' ');

  // 50자로 제한
  if (normalized.length > 50) {
    normalized = normalized.substring(0, 50);
  }

  return normalized;
}
