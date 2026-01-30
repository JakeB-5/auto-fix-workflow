/**
 * @module analyzer/issue-generator/acceptance-generator
 * @description Generate Acceptance Criteria in GIVEN-WHEN-THEN format
 */

import type { IssueType } from '../../common/types/index.js';

/**
 * Acceptance criteria data
 */
export interface AcceptanceCriteriaData {
  readonly type: IssueType;
  readonly scenarios?: readonly string[] | undefined;
  readonly hasTests?: boolean | undefined;
}

/**
 * Generate acceptance criteria for bugs
 */
function generateBugCriteria(scenarios: readonly string[] | undefined): string[] {
  const criteria = [
    'GIVEN 재현 시나리오를 실행할 때',
    'WHEN 수정된 코드가 적용되면',
    'THEN 에러가 더 이상 발생하지 않아야 함',
    '',
    'AND 기존 테스트가 모두 통과해야 함',
    'AND 새로운 테스트 케이스가 추가되어야 함',
  ];

  // Add scenario-specific criteria
  if (scenarios && scenarios.length > 0) {
    criteria.push('');
    criteria.push('**재현 시나리오 검증:**');
    scenarios.forEach((scenario, index) => {
      criteria.push(`${index + 1}. ${scenario}`);
    });
  }

  return criteria;
}

/**
 * Generate acceptance criteria for features
 */
function generateFeatureCriteria(): string[] {
  return [
    'GIVEN 기능 구현이 완료되었을 때',
    'WHEN 사용자가 새 기능을 사용하면',
    'THEN 예상대로 동작해야 함',
    '',
    'AND 기존 기능에 영향을 주지 않아야 함',
    'AND 새로운 테스트가 추가되어야 함',
    'AND 문서가 업데이트되어야 함',
  ];
}

/**
 * Generate acceptance criteria for refactoring
 */
function generateRefactorCriteria(): string[] {
  return [
    'GIVEN 리팩토링이 완료되었을 때',
    'WHEN 기존 기능을 테스트하면',
    'THEN 동작이 변경되지 않아야 함',
    '',
    'AND 모든 테스트가 통과해야 함',
    'AND 코드 품질이 개선되어야 함',
  ];
}

/**
 * Generate acceptance criteria for documentation
 */
function generateDocsCriteria(): string[] {
  return [
    'GIVEN 문서 작성이 완료되었을 때',
    'WHEN 개발자가 문서를 읽으면',
    'THEN 명확하게 이해할 수 있어야 함',
    '',
    'AND 예제 코드가 포함되어야 함',
    'AND 최신 정보를 반영해야 함',
  ];
}

/**
 * Generate acceptance criteria for tests
 */
function generateTestCriteria(): string[] {
  return [
    'GIVEN 테스트가 작성되었을 때',
    'WHEN 테스트를 실행하면',
    'THEN 모든 테스트가 통과해야 함',
    '',
    'AND 엣지 케이스가 커버되어야 함',
    'AND 코드 커버리지가 증가해야 함',
  ];
}

/**
 * Generate acceptance criteria for chores
 */
function generateChoreCriteria(): string[] {
  return [
    'GIVEN 작업이 완료되었을 때',
    'WHEN 변경사항을 확인하면',
    'THEN 의도한 대로 동작해야 함',
    '',
    'AND 기존 기능에 영향을 주지 않아야 함',
  ];
}

/**
 * Generate acceptance criteria based on issue type
 *
 * @param data - Acceptance criteria data
 * @returns Array of criteria strings
 */
export function generateAcceptanceCriteria(
  data: AcceptanceCriteriaData
): readonly string[] {
  switch (data.type) {
    case 'bug':
      return generateBugCriteria(data.scenarios);
    case 'feature':
      return generateFeatureCriteria();
    case 'refactor':
      return generateRefactorCriteria();
    case 'docs':
      return generateDocsCriteria();
    case 'test':
      return generateTestCriteria();
    case 'chore':
      return generateChoreCriteria();
    default:
      return generateBugCriteria(undefined);
  }
}

/**
 * Generate acceptance criteria section
 *
 * @param data - Acceptance criteria data
 * @returns Markdown section lines
 */
export function generateAcceptanceCriteriaSection(
  data: AcceptanceCriteriaData
): string[] {
  const criteria = generateAcceptanceCriteria(data);
  const lines: string[] = ['### Acceptance Criteria'];

  criteria.forEach((criterion) => {
    if (criterion === '') {
      lines.push('');
    } else if (criterion.startsWith('**')) {
      lines.push(criterion);
    } else if (/^\d+\./.test(criterion)) {
      lines.push(`   ${criterion}`);
    } else {
      lines.push(`- [ ] ${criterion}`);
    }
  });

  return lines;
}
