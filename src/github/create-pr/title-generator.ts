/**
 * @module github/create-pr/title-generator
 * @description PR 제목 자동 생성 유틸리티
 */

import type { Issue } from '../../common/types/index.js';

/**
 * 이슈 타입에 따른 접두사 매핑
 */
const TYPE_PREFIXES: Record<string, string> = {
  bug: 'fix',
  feature: 'feat',
  refactor: 'refactor',
  docs: 'docs',
  test: 'test',
  chore: 'chore',
};

/**
 * 이슈 목록으로부터 PR 제목 생성
 *
 * @param issues - PR에 연결될 이슈 목록
 * @returns 생성된 PR 제목
 *
 * @example
 * ```typescript
 * const issues = [
 *   { number: 123, type: 'bug', title: 'Fix login error' },
 *   { number: 124, type: 'bug', title: 'Fix validation' }
 * ];
 * const title = generatePRTitle(issues);
 * // "fix: resolve #123, #124 - Fix login error and validation issues"
 * ```
 */
export function generatePRTitle(issues: readonly Issue[]): string {
  if (issues.length === 0) {
    return 'chore: update';
  }

  // 단일 이슈인 경우
  if (issues.length === 1) {
    const issue = issues[0]!;
    const prefix = TYPE_PREFIXES[issue.type] || 'chore';
    const issueRef = `#${issue.number}`;
    const title = cleanTitle(issue.title);
    return `${prefix}: ${title} (${issueRef})`;
  }

  // 다중 이슈인 경우
  const firstIssue = issues[0]!;
  const prefix = TYPE_PREFIXES[firstIssue.type] || 'chore';
  const issueRefs = issues.map((i) => `#${i.number}`).join(', ');

  // 공통 키워드 추출 시도
  const commonKeywords = extractCommonKeywords(issues);
  const description = commonKeywords || 'multiple issues';

  return `${prefix}: resolve ${issueRefs} - ${description}`;
}

/**
 * 제목 정리 (특수 문자 제거, 길이 제한)
 */
function cleanTitle(title: string): string {
  // 이슈 번호 패턴 제거
  let cleaned = title.replace(/#\d+/g, '').trim();

  // 앞뒤 특수 문자 제거
  cleaned = cleaned.replace(/^[:\-\s]+|[:\-\s]+$/g, '');

  // 길이 제한 (60자)
  if (cleaned.length > 60) {
    cleaned = cleaned.substring(0, 57) + '...';
  }

  return cleaned;
}

/**
 * 여러 이슈에서 공통 키워드 추출
 */
function extractCommonKeywords(issues: readonly Issue[]): string | null {
  if (issues.length === 0) {
    return null;
  }

  // 모든 제목을 소문자로 변환하고 단어로 분리
  const allWords = issues.flatMap((issue) =>
    issue.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3) // 3글자 이상만
  );

  // 단어 빈도 계산
  const wordFrequency = new Map<string, number>();
  for (const word of allWords) {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
  }

  // 가장 빈번한 단어 찾기 (최소 2회 이상)
  const commonWords = Array.from(wordFrequency.entries())
    .filter(([_, count]) => count >= Math.min(2, issues.length))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word]) => word);

  if (commonWords.length === 0) {
    return null;
  }

  return commonWords.join(' and ');
}
