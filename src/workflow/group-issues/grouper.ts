/**
 * @module workflow/group-issues/grouper
 * @description 이슈 그룹핑 알고리즘
 */

import type { Issue, IssueGroup } from '../../common/types/index.js';
import { extractComponent } from './component-extractor.js';
import { extractFilePaths } from './file-extractor.js';
import { generateBranchName } from './branch-name.js';

/**
 * 컴포넌트별로 이슈 그룹화
 *
 * @param issues - 이슈 목록
 * @returns 그룹 목록
 */
export function groupByComponent(issues: readonly Issue[]): IssueGroup[] {
  const groups = new Map<string, Issue[]>();

  for (const issue of issues) {
    const component = extractComponent(issue);
    const key = component || 'uncategorized';

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(issue);
  }

  return Array.from(groups.entries()).map(([key, groupIssues]) =>
    createIssueGroup(key, 'component', groupIssues)
  );
}

/**
 * 파일별로 이슈 그룹화
 *
 * @param issues - 이슈 목록
 * @returns 그룹 목록
 */
export function groupByFile(issues: readonly Issue[]): IssueGroup[] {
  const groups = new Map<string, Issue[]>();

  for (const issue of issues) {
    const files = extractFilePaths(issue);

    if (files.length === 0) {
      // 파일 정보 없으면 uncategorized
      if (!groups.has('uncategorized')) {
        groups.set('uncategorized', []);
      }
      groups.get('uncategorized')!.push(issue);
    } else {
      // 주요 파일 (첫 번째)로 그룹화
      const primaryFile = files[0];
      const key = getFileKey(primaryFile);

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(issue);
    }
  }

  return Array.from(groups.entries()).map(([key, groupIssues]) =>
    createIssueGroup(key, 'file', groupIssues)
  );
}

/**
 * 라벨별로 이슈 그룹화
 *
 * @param issues - 이슈 목록
 * @returns 그룹 목록
 */
export function groupByLabel(issues: readonly Issue[]): IssueGroup[] {
  const groups = new Map<string, Issue[]>();

  for (const issue of issues) {
    if (issue.labels.length === 0) {
      // 라벨 없으면 uncategorized
      if (!groups.has('uncategorized')) {
        groups.set('uncategorized', []);
      }
      groups.get('uncategorized')!.push(issue);
    } else {
      // 주요 라벨 (첫 번째)로 그룹화
      const primaryLabel = issue.labels[0];

      if (!groups.has(primaryLabel)) {
        groups.set(primaryLabel, []);
      }
      groups.get(primaryLabel)!.push(issue);
    }
  }

  return Array.from(groups.entries()).map(([key, groupIssues]) =>
    createIssueGroup(key, 'label', groupIssues)
  );
}

/**
 * 파일 경로에서 그룹 키 추출
 *
 * src/components/Button/Button.tsx -> components/Button
 *
 * @param filePath - 파일 경로
 * @returns 그룹 키
 */
function getFileKey(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  // 확장자 제거
  const fileName = parts[parts.length - 1];
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

  // 디렉토리 구조 보존
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${nameWithoutExt}`;
  }

  return nameWithoutExt;
}

/**
 * IssueGroup 객체 생성
 *
 * @param key - 그룹 키
 * @param groupBy - 그룹화 기준
 * @param issues - 이슈 목록
 * @returns IssueGroup
 */
function createIssueGroup(
  key: string,
  groupBy: 'component' | 'file' | 'label',
  issues: Issue[]
): IssueGroup {
  const allFiles = new Set<string>();
  const allComponents = new Set<string>();
  let highestPriority: 'critical' | 'high' | 'medium' | 'low' = 'low';

  for (const issue of issues) {
    // 파일 수집
    const files = extractFilePaths(issue);
    files.forEach(f => allFiles.add(f));

    // 컴포넌트 수집
    const component = extractComponent(issue);
    if (component) {
      allComponents.add(component);
    }

    // 최고 우선순위 결정
    if (comparePriority(issue.context.priority, highestPriority) > 0) {
      highestPriority = issue.context.priority;
    }
  }

  // Create temporary group for branch name generation
  const tempGroup: IssueGroup = {
    id: generateGroupId(key, groupBy),
    name: formatGroupName(key, groupBy),
    groupBy,
    key,
    issues,
    branchName: '', // Will be set below
    relatedFiles: Array.from(allFiles),
    components: Array.from(allComponents),
    priority: highestPriority,
  };

  // Generate branch name
  const branchName = generateBranchName(tempGroup);

  // Create final group with branch name
  const group: IssueGroup = {
    ...tempGroup,
    branchName,
  };

  return group;
}

/**
 * 그룹 ID 생성
 */
function generateGroupId(key: string, groupBy: string): string {
  const sanitized = key.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${groupBy}-${sanitized}`;
}

/**
 * 그룹 이름 포맷팅
 */
function formatGroupName(key: string, groupBy: string): string {
  if (key === 'uncategorized') {
    return 'Uncategorized';
  }

  switch (groupBy) {
    case 'component':
      return `Component: ${key}`;
    case 'file':
      return `File: ${key}`;
    case 'label':
      return `Label: ${key}`;
    default:
      return key;
  }
}

/**
 * 우선순위 비교
 *
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
function comparePriority(
  a: 'critical' | 'high' | 'medium' | 'low',
  b: 'critical' | 'high' | 'medium' | 'low'
): number {
  const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
  return priorities[a] - priorities[b];
}
