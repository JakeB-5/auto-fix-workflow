/**
 * @module workflow/group-issues/group-issues
 * @description 메인 그룹화 함수
 */

import type { Result } from '../../common/types/index.js';
import type {
  GroupIssuesParams,
  GroupIssuesResult,
} from '../../common/types/index.js';
import type { GroupError } from './types.js';
import { ok, err } from '../../common/types/index.js';
import { fetchIssues } from './github-api.js';
import { groupByComponent, groupByFile, groupByLabel } from './grouper.js';

/**
 * 이슈 그룹화 메인 함수
 *
 * @param params - 그룹화 파라미터
 * @returns 그룹화 결과 또는 에러
 */
export async function groupIssues(
  params: GroupIssuesParams
): Promise<Result<GroupIssuesResult, GroupError>> {
  // 1. 파라미터 검증
  const validationError = validateParams(params);
  if (validationError) {
    return err(validationError);
  }

  try {
    // 2. GitHub에서 이슈 정보 가져오기
    const issues = await fetchIssues(params.issueNumbers);

    if (issues.length === 0) {
      return err({
        code: 'EMPTY_ISSUES',
        message: 'No issues found',
      });
    }

    // 3. 라벨 필터링
    let filteredIssues = issues;
    if (params.labels && params.labels.length > 0) {
      filteredIssues = issues.filter(issue =>
        params.labels!.some(label => issue.labels.includes(label))
      );
    }

    if (params.excludeLabels && params.excludeLabels.length > 0) {
      filteredIssues = filteredIssues.filter(issue =>
        !params.excludeLabels!.some(label => issue.labels.includes(label))
      );
    }

    // 4. 그룹화 수행
    let groups = performGrouping(filteredIssues, params.groupBy);

    // 5. 그룹 크기 검증 및 조정
    const { validGroups, ungroupedIssueNumbers } = validateGroupSizes(
      groups,
      params.maxGroupSize ?? 5,
      params.minGroupSize ?? 1
    );

    // 6. 결과 반환
    const result: GroupIssuesResult = {
      groups: validGroups,
      ungroupedIssues: ungroupedIssueNumbers,
      totalIssues: params.issueNumbers.length,
      totalGroups: validGroups.length,
    };

    return ok(result);
  } catch (error) {
    return err({
      code: 'GROUPING_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    });
  }
}

/**
 * 파라미터 검증
 */
function validateParams(params: GroupIssuesParams): GroupError | null {
  if (!params.issueNumbers || params.issueNumbers.length === 0) {
    return {
      code: 'INVALID_PARAMS',
      message: 'issueNumbers is required and must not be empty',
    };
  }

  if (!params.groupBy) {
    return {
      code: 'INVALID_PARAMS',
      message: 'groupBy is required',
    };
  }

  const maxGroupSize = params.maxGroupSize ?? 5;
  const minGroupSize = params.minGroupSize ?? 1;

  if (minGroupSize < 1) {
    return {
      code: 'INVALID_GROUP_SIZE',
      message: 'minGroupSize must be at least 1',
    };
  }

  if (maxGroupSize < minGroupSize) {
    return {
      code: 'INVALID_GROUP_SIZE',
      message: 'maxGroupSize must be greater than or equal to minGroupSize',
    };
  }

  return null;
}

/**
 * 그룹화 수행
 */
function performGrouping(
  issues: any[],
  groupBy: GroupIssuesParams['groupBy']
): any[] {
  switch (groupBy) {
    case 'component':
      return groupByComponent(issues);
    case 'file':
      return groupByFile(issues);
    case 'label':
      return groupByLabel(issues);
    case 'type':
      // type별 그룹화 (간단한 구현)
      return groupByProperty(issues, 'type');
    case 'priority':
      // priority별 그룹화
      return groupByProperty(issues, issue => issue.context.priority);
    default:
      return groupByComponent(issues);
  }
}

/**
 * 속성별 그룹화 헬퍼
 */
function groupByProperty(
  issues: any[],
  propertyOrGetter: string | ((issue: any) => string)
): any[] {
  const groups = new Map<string, any[]>();

  for (const issue of issues) {
    const key =
      typeof propertyOrGetter === 'function'
        ? propertyOrGetter(issue)
        : issue[propertyOrGetter];

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(issue);
  }

  return Array.from(groups.entries()).map(([key, groupIssues]) => ({
    id: `group-${key}`,
    name: key,
    groupBy: 'type' as const,
    key,
    issues: groupIssues,
    branchName: `fix/${key}`,
    relatedFiles: [],
    components: [],
    priority: 'medium' as const,
  }));
}

/**
 * 그룹 크기 검증 및 필터링
 */
function validateGroupSizes(
  groups: any[],
  maxGroupSize: number,
  minGroupSize: number
): {
  validGroups: any[];
  ungroupedIssueNumbers: number[];
} {
  const validGroups: any[] = [];
  const ungroupedIssueNumbers: number[] = [];

  for (const group of groups) {
    const size = group.issues.length;

    if (size < minGroupSize) {
      // 최소 크기 미달 -> ungrouped에 추가
      ungroupedIssueNumbers.push(...group.issues.map((i: any) => i.number));
    } else if (size > maxGroupSize) {
      // 최대 크기 초과 -> 분할
      const splitGroups = splitGroup(group, maxGroupSize);
      validGroups.push(...splitGroups);
    } else {
      // 정상 크기
      validGroups.push(group);
    }
  }

  return { validGroups, ungroupedIssueNumbers };
}

/**
 * 큰 그룹을 여러 개로 분할
 */
function splitGroup(group: any, maxSize: number): any[] {
  const result: any[] = [];
  const issues = group.issues;

  for (let i = 0; i < issues.length; i += maxSize) {
    const chunk = issues.slice(i, i + maxSize);
    const partNumber = Math.floor(i / maxSize) + 1;
    const subGroup = {
      ...group,
      id: `${group.id}-${partNumber}`,
      name: `${group.name} (Part ${partNumber})`,
      issues: chunk,
    };

    // Append part number to make branch name unique
    const originalBranchName = group.branchName || `fix/${group.key}`;
    subGroup.branchName = `${originalBranchName}-part${partNumber}`;

    result.push(subGroup);
  }

  return result;
}
