/**
 * @module workflow/group-issues/branch-name
 * @description 브랜치명 생성
 */

import type { IssueGroup, BranchNameOptions } from '../../common/types/index.js';

/**
 * 기본 브랜치명 옵션
 */
const DEFAULT_OPTIONS: Required<BranchNameOptions> = {
  prefix: 'fix',
  maxLength: 50,
  separator: '-',
  includeIssueNumbers: true,
};

/**
 * 이슈 그룹의 브랜치명 생성
 *
 * 형식: {prefix}/{component}-issue-{numbers}
 * 예: fix/button-issue-123-456
 *
 * @param group - 이슈 그룹
 * @param options - 브랜치명 옵션
 * @returns 브랜치명
 */
export function generateBranchName(
  group: IssueGroup,
  options?: BranchNameOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const parts: string[] = [];

  // 1. prefix
  if (opts.prefix) {
    parts.push(opts.prefix);
  }

  // 2. 컴포넌트 또는 키
  const identifier = generateIdentifier(group);
  parts.push(identifier);

  // 3. 이슈 번호들
  if (opts.includeIssueNumbers && group.issues.length > 0) {
    const numbers = group.issues
      .map(issue => issue.number)
      .sort((a, b) => a - b)
      .join(opts.separator);
    parts.push(`issue${opts.separator}${numbers}`);
  }

  // 조합
  const branchName = parts.join('/');

  // 길이 제한
  if (branchName.length > opts.maxLength) {
    return truncateBranchName(branchName, opts.maxLength, opts.separator);
  }

  return branchName;
}

/**
 * 그룹에서 식별자 생성
 *
 * @param group - 이슈 그룹
 * @returns 식별자 문자열
 */
function generateIdentifier(group: IssueGroup): string {
  // 컴포넌트가 있으면 우선 사용
  if (group.components.length > 0) {
    return sanitize(group.components[0]);
  }

  // groupBy에 따라 key 사용
  switch (group.groupBy) {
    case 'component':
      return sanitize(group.key);
    case 'file':
      return sanitize(group.key.replace(/\//g, '-'));
    case 'label':
      return sanitize(group.key);
    case 'type':
      return sanitize(group.key);
    case 'priority':
      return sanitize(group.key);
    default:
      return 'misc';
  }
}

/**
 * 문자열 sanitize (브랜치명으로 사용 가능하게)
 *
 * - 소문자 변환
 * - 공백/특수문자를 하이픈으로 변환
 * - 연속 하이픈 제거
 *
 * @param str - 원본 문자열
 * @returns sanitize된 문자열
 */
function sanitize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 브랜치명 잘라내기
 *
 * 이슈 번호는 최대한 보존하면서 다른 부분을 줄임
 *
 * @param branchName - 원본 브랜치명
 * @param maxLength - 최대 길이
 * @param separator - 구분자
 * @returns 잘라낸 브랜치명
 */
function truncateBranchName(
  branchName: string,
  maxLength: number,
  separator: string
): string {
  if (branchName.length <= maxLength) {
    return branchName;
  }

  // prefix/identifier/issue-123-456 형식 파싱
  const parts = branchName.split('/');

  if (parts.length === 1) {
    // / 가 없으면 단순 자르기
    return branchName.substring(0, maxLength);
  }

  const prefix = parts[0];
  const rest = parts.slice(1).join('/');

  // issue- 부분 찾기
  const issueMatch = rest.match(/(issue-[\d-]+)$/);

  if (issueMatch) {
    const issuePart = issueMatch[1];
    const identifierPart = rest.substring(0, rest.length - issuePart.length - 1);

    // prefix + identifier + issue 길이 계산
    const requiredLength = prefix.length + 1 + issuePart.length + 1; // +1 for slashes
    const availableForIdentifier = maxLength - requiredLength;

    if (availableForIdentifier > 0) {
      const truncatedIdentifier = identifierPart.substring(0, availableForIdentifier);
      return `${prefix}/${truncatedIdentifier}/${issuePart}`;
    } else {
      // identifier를 완전히 생략
      return `${prefix}/${issuePart}`;
    }
  }

  // issue 부분이 없으면 단순 자르기
  return branchName.substring(0, maxLength);
}
