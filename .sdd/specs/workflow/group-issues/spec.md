---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: workflow
feature: group-issues
depends: "common/types"
---

# Group Issues

> 유사한 이슈를 그룹화하여 효율적인 일괄 처리 지원

## Requirement: REQ-WF-001 - 컴포넌트 기반 그룹화

같은 컴포넌트에 속한 이슈들을 그룹화해야 한다.

### Scenario: 동일 컴포넌트 이슈 그룹화

- **GIVEN** 여러 이슈가 동일한 `component` 라벨을 가지고
- **WHEN** `group_by: "component"`로 `group_issues`를 호출하면
- **THEN** 같은 컴포넌트의 이슈들이 하나의 그룹으로 묶여야 한다
- **AND** 그룹 키는 컴포넌트명이어야 한다

### Scenario: 여러 컴포넌트 그룹화

- **GIVEN** 여러 컴포넌트에 속한 이슈들이 주어지고
- **WHEN** `group_by: "component"`로 `group_issues`를 호출하면
- **THEN** 컴포넌트별로 분리된 그룹들이 반환되어야 한다
- **AND** 각 그룹은 해당 컴포넌트의 이슈만 포함해야 한다

### Scenario: 컴포넌트 정보 없는 이슈

- **GIVEN** 일부 이슈에 컴포넌트 정보가 없고
- **WHEN** `group_by: "component"`로 `group_issues`를 호출하면
- **THEN** 해당 이슈들은 "unknown" 그룹에 포함되어야 한다

## Requirement: REQ-WF-002 - 파일 기반 그룹화

같은 파일을 수정하는 이슈들을 그룹화해야 한다.

### Scenario: 동일 파일 이슈 그룹화

- **GIVEN** 여러 이슈가 동일한 파일을 참조하고
- **WHEN** `group_by: "file"`로 `group_issues`를 호출하면
- **THEN** 같은 파일의 이슈들이 하나의 그룹으로 묶여야 한다
- **AND** 그룹 키는 파일 경로여야 한다

### Scenario: 여러 파일 참조 이슈

- **GIVEN** 하나의 이슈가 여러 파일을 참조하고
- **WHEN** `group_by: "file"`로 `group_issues`를 호출하면
- **THEN** 해당 이슈는 참조하는 모든 파일 그룹에 포함되어야 한다

## Requirement: REQ-WF-003 - 라벨 기반 그룹화

같은 라벨을 가진 이슈들을 그룹화해야 한다.

### Scenario: 동일 라벨 이슈 그룹화

- **GIVEN** 여러 이슈가 공통 라벨을 가지고
- **WHEN** `group_by: "label"`로 `group_issues`를 호출하면
- **THEN** 같은 라벨의 이슈들이 하나의 그룹으로 묶여야 한다
- **AND** 그룹 키는 라벨명이어야 한다

### Scenario: 여러 라벨 보유 이슈

- **GIVEN** 하나의 이슈가 여러 라벨을 가지고
- **WHEN** `group_by: "label"`로 `group_issues`를 호출하면
- **THEN** 해당 이슈는 각 라벨 그룹에 포함되어야 한다

## Requirement: REQ-WF-004 - 브랜치명 제안

그룹화된 이슈에 적합한 브랜치명을 제안해야 한다.

### Scenario: 단일 이슈 브랜치명

- **GIVEN** 하나의 이슈만 포함된 그룹이 있고
- **WHEN** 그룹화 결과를 반환할 때
- **THEN** `suggested_branch`는 `fix/issue-{number}` 형식이어야 한다

### Scenario: 다중 이슈 브랜치명

- **GIVEN** 여러 이슈가 포함된 그룹이 있고
- **WHEN** 그룹화 결과를 반환할 때
- **THEN** `suggested_branch`는 `fix/issue-{number1}-{number2}-{number3}` 형식이어야 한다
- **AND** 이슈 번호는 오름차순으로 정렬되어야 한다

### Scenario: 컴포넌트 기반 브랜치명

- **GIVEN** 컴포넌트로 그룹화된 결과가 있고
- **WHEN** 브랜치명을 제안할 때
- **THEN** `suggested_branch`는 `fix/{component}-issues` 형식을 포함할 수 있다

## Requirement: REQ-WF-005 - 빈 그룹 제외

이슈가 없는 그룹은 결과에서 제외해야 한다.

### Scenario: 빈 그룹 필터링

- **GIVEN** 일부 그룹에 이슈가 없고
- **WHEN** 그룹화 결과를 반환할 때
- **THEN** 빈 그룹은 포함되지 않아야 한다
- **AND** 최소 1개 이상의 이슈를 가진 그룹만 반환되어야 한다

## Requirement: REQ-WF-006 - 그룹 크기 제한

하나의 그룹에 포함될 수 있는 이슈 수를 제한할 수 있어야 한다.

### Scenario: 최대 그룹 크기 초과

- **GIVEN** 하나의 그룹에 5개 이상의 이슈가 포함되고
- **WHEN** 그룹화를 수행하면
- **THEN** 그룹이 분할되어야 한다 (선택적 기능)
- **OR** 경고 메시지와 함께 전체 그룹이 반환되어야 한다

## Data Types

### GroupIssuesParams

```typescript
interface GroupIssuesParams {
  issues: number[];           // 이슈 번호 목록
  group_by: "component" | "file" | "label";
  max_group_size?: number;    // 선택적, 기본값: 5
}
```

**Constraints:**
- `issues`는 MUST contain at least one issue number
- `issues`의 각 요소는 MUST be a positive integer
- `group_by`는 MUST be one of: "component", "file", "label"
- `max_group_size`는 SHOULD be between 1 and 10

### GroupIssuesResult

```typescript
interface GroupIssuesResult {
  groups: IssueGroup[];
}

interface IssueGroup {
  key: string;              // 그룹 키 (컴포넌트명, 파일명, 라벨명)
  issues: number[];         // 해당 그룹의 이슈 번호들
  suggested_branch: string; // 제안 브랜치명
}
```

**Constraints:**
- `groups`는 MUST NOT contain empty groups
- `IssueGroup.key`는 MUST be a non-empty string
- `IssueGroup.issues`는 MUST contain at least one issue number
- `IssueGroup.suggested_branch`은 MUST match pattern: `^fix/[a-z0-9-]+$`
- `groups`는 SHOULD be sorted by group size (descending)

## Implementation Notes

### 그룹화 전략

1. **컴포넌트 기반**: Issue 템플릿의 "Context.컴포넌트" 필드 파싱
2. **파일 기반**: Issue 본문의 파일 경로 추출 (정규식 활용)
3. **라벨 기반**: GitHub Labels API 활용

### 우선순위 규칙

같은 이슈가 여러 그룹에 속할 수 있는 경우:
- 파일 기반: 첫 번째 언급된 파일을 우선
- 라벨 기반: 모든 라벨 그룹에 포함
- 컴포넌트 기반: 단일 컴포넌트만 지정 가능

### 브랜치명 생성 규칙

```typescript
function generateBranchName(group: IssueGroup): string {
  const issueNumbers = group.issues.sort((a, b) => a - b);

  if (issueNumbers.length === 1) {
    return `fix/issue-${issueNumbers[0]}`;
  }

  if (issueNumbers.length <= 3) {
    return `fix/issue-${issueNumbers.join("-")}`;
  }

  // 4개 이상일 때는 그룹 키 활용
  return `fix/${sanitize(group.key)}-issues`;
}
```

### 성능 고려사항

- 최대 50개 이슈까지 그룹화 권장
- 이슈 상세 정보는 캐싱하여 중복 API 호출 방지
- 비동기 병렬 처리로 성능 최적화
