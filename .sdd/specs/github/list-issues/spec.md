---
status: draft
created: 2026-01-30
domain: github
feature: list-issues
depends: [common/types]
---

# List Issues

> GitHub 레포지토리에서 라벨 기반으로 이슈 목록을 조회하는 Tool

## Requirement: REQ-001 - 라벨 기반 이슈 조회

시스템은 GitHub 레포지토리에서 지정된 라벨을 포함하거나 제외하는 이슈 목록을 조회해야 한다(SHALL).

### Scenario: 기본 auto-fix 이슈 조회

- **GIVEN** GitHub 레포지토리에 다음 이슈들이 존재
  - Issue #123: 라벨 ["auto-fix", "component:editor"]
  - Issue #124: 라벨 ["auto-fix", "component:canvas-core"]
  - Issue #125: 라벨 ["auto-fix-skip"]
- **WHEN** `list_issues({ labels: ["auto-fix"], exclude_labels: ["auto-fix-skip"] })`를 호출
- **THEN** Issue #123, #124만 반환되어야 함

### Scenario: 상태 필터링

- **GIVEN** 라벨 "auto-fix"를 가진 이슈들 중
  - Issue #123: state "open"
  - Issue #124: state "closed"
- **WHEN** `list_issues({ labels: ["auto-fix"], state: "open" })`를 호출
- **THEN** Issue #123만 반환되어야 함

## Requirement: REQ-002 - 컴포넌트 정보 추출

시스템은 이슈 본문에서 Context.컴포넌트 정보를 자동으로 추출해야 한다(SHALL).

### Scenario: 컴포넌트 정보 파싱

- **GIVEN** Issue #123의 본문이 다음을 포함
  ```markdown
  ### Context
  - **컴포넌트**: canvas-core
  ```
- **WHEN** `list_issues()`를 호출
- **THEN** 반환된 이슈 객체의 `component` 필드가 "canvas-core"여야 함

### Scenario: 컴포넌트 정보 누락

- **GIVEN** Issue #123의 본문에 컴포넌트 정보가 없음
- **WHEN** `list_issues()`를 호출
- **THEN** 반환된 이슈 객체의 `component` 필드가 빈 문자열("")이어야 함

## Requirement: REQ-003 - 우선순위 자동 판단

시스템은 이슈의 우선순위를 라벨 또는 컨텍스트 기반으로 자동 판단해야 한다(SHALL).

### Scenario: 라벨 기반 우선순위

- **GIVEN** Issue #123의 라벨이 ["auto-fix", "priority:high"]
- **WHEN** `list_issues()`를 호출
- **THEN** 반환된 이슈 객체의 `priority` 필드가 "high"여야 함

### Scenario: 기본 우선순위

- **GIVEN** Issue #123에 우선순위 관련 라벨이 없음
- **WHEN** `list_issues()`를 호출
- **THEN** 반환된 이슈 객체의 `priority` 필드가 "medium"이어야 함

## Requirement: REQ-004 - 결과 개수 제한

시스템은 기본적으로 최대 50개까지 이슈를 반환해야 하며(SHALL), limit 파라미터로 조정 가능해야 한다(SHALL).

### Scenario: 기본 제한

- **GIVEN** 라벨 "auto-fix"를 가진 이슈가 100개 존재
- **WHEN** `list_issues({ labels: ["auto-fix"] })`를 호출 (limit 미지정)
- **THEN** 최신 50개 이슈만 반환되어야 함

### Scenario: 커스텀 제한

- **GIVEN** 라벨 "auto-fix"를 가진 이슈가 100개 존재
- **WHEN** `list_issues({ labels: ["auto-fix"], limit: 20 })`를 호출
- **THEN** 최신 20개 이슈만 반환되어야 함

## Interface

### Input Parameters

```typescript
interface ListIssuesParams {
  labels: string[];           // 포함할 라벨 (기본: ["auto-fix"])
  exclude_labels?: string[];  // 제외할 라벨 (기본: ["auto-fix-skip"])
  state?: "open" | "closed" | "all";  // 기본: "open"
  limit?: number;             // 기본: 50
}
```

### Output

```typescript
interface ListIssuesResult {
  issues: {
    number: number;
    title: string;
    labels: string[];
    component: string;        // Context에서 추출
    created_at: string;
    priority: "high" | "medium" | "low";
  }[];
  total: number;
}
```

## Error Handling

### Scenario: GitHub API 인증 실패

- **GIVEN** GitHub PAT가 유효하지 않거나 만료됨
- **WHEN** `list_issues()`를 호출
- **THEN** MCP error code "AUTHENTICATION_FAILED"와 함께 에러를 반환해야 함

### Scenario: Rate Limit 초과

- **GIVEN** GitHub API Rate Limit이 초과됨
- **WHEN** `list_issues()`를 호출
- **THEN** MCP error code "RATE_LIMIT_EXCEEDED"와 reset 시간을 포함한 에러를 반환해야 함

### Scenario: 레포지토리 접근 권한 없음

- **GIVEN** GitHub PAT이 대상 레포지토리 접근 권한 없음
- **WHEN** `list_issues()`를 호출
- **THEN** MCP error code "PERMISSION_DENIED"와 함께 에러를 반환해야 함
