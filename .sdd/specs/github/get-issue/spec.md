---
status: draft
created: 2026-01-30
domain: github
feature: get-issue
depends: [common/types]
---

# Get Issue

> 특정 GitHub Issue의 상세 정보를 조회하는 Tool

## Requirement: REQ-001 - 이슈 상세 정보 조회

시스템은 이슈 번호를 입력받아 해당 이슈의 상세 정보를 반환해야 한다(SHALL).

### Scenario: 정상적인 이슈 조회

- **GIVEN** GitHub 레포지토리에 Issue #123이 존재
- **WHEN** `get_issue({ issue_number: 123 })`를 호출
- **THEN** Issue #123의 전체 정보(제목, 본문, 라벨, 상태, 작성자, 코멘트 등)를 반환해야 함

### Scenario: 존재하지 않는 이슈 조회

- **GIVEN** GitHub 레포지토리에 Issue #999가 존재하지 않음
- **WHEN** `get_issue({ issue_number: 999 })`를 호출
- **THEN** MCP error code "NOT_FOUND"와 함께 에러를 반환해야 함

## Requirement: REQ-002 - 구조화된 컨텍스트 파싱

시스템은 이슈 본문의 템플릿 구조를 파싱하여 구조화된 데이터로 반환해야 한다(SHALL).

### Scenario: Auto-Fix Issue 템플릿 파싱

- **GIVEN** Issue #123의 본문이 Auto-Fix Issue 템플릿을 따름
  ```markdown
  ### Type
  - [x] 🐛 Bug Report

  ### Context
  - **파일**: `src/components/Editor.tsx`
  - **함수/클래스**: `handleSave()`
  - **라인**: 142-156
  - **컴포넌트**: editor

  ### Problem Description
  새 문서 저장 시 에러 발생
  ```
- **WHEN** `get_issue({ issue_number: 123 })`를 호출
- **THEN** 다음 구조의 `parsed_context` 객체를 반환해야 함
  ```typescript
  {
    type: "bug",
    file: "src/components/Editor.tsx",
    function: "handleSave()",
    lines: "142-156",
    component: "editor",
    description: "새 문서 저장 시 에러 발생"
  }
  ```

### Scenario: Sentry Issue 템플릿 파싱

- **GIVEN** Issue #124가 Sentry에서 자동 생성됨
  ```markdown
  ### Type
  - [x] 🔴 Sentry Error

  ### Source
  - **Reference**: https://sentry.io/...
  - **Event Count**: 15

  ### Stack Trace
  \```
  TypeError: Cannot read property 'id' of undefined
      at handleSave (Editor.tsx:145)
  \```
  ```
- **WHEN** `get_issue({ issue_number: 124 })`를 호출
- **THEN** `parsed_context.source`가 "sentry"이고 `event_count`, `sentry_link`, `stack_trace`를 포함해야 함

## Requirement: REQ-003 - 관련 이슈 추출

시스템은 이슈 본문의 "Related Issues" 섹션에서 관련 이슈 번호를 추출해야 한다(SHALL).

### Scenario: 관련 이슈 파싱

- **GIVEN** Issue #123의 본문이 다음을 포함
  ```markdown
  ### Related Issues
  - #120 - 유사한 null 체크 이슈
  - #118 - 같은 컴포넌트 관련
  ```
- **WHEN** `get_issue({ issue_number: 123 })`를 호출
- **THEN** 반환된 객체의 `related_issues` 필드가 `[120, 118]`이어야 함

### Scenario: 관련 이슈 없음

- **GIVEN** Issue #123에 "Related Issues" 섹션이 없거나 비어있음
- **WHEN** `get_issue({ issue_number: 123 })`를 호출
- **THEN** 반환된 객체의 `related_issues` 필드가 빈 배열(`[]`)이어야 함

## Requirement: REQ-004 - 코멘트 포함 여부 제어

시스템은 코멘트 포함 여부를 파라미터로 제어할 수 있어야 한다(SHALL).

### Scenario: 코멘트 포함 조회

- **GIVEN** Issue #123에 코멘트가 5개 존재
- **WHEN** `get_issue({ issue_number: 123, include_comments: true })`를 호출
- **THEN** 반환된 객체의 `comments` 배열에 5개의 코멘트가 포함되어야 함

### Scenario: 코멘트 제외 조회 (기본)

- **GIVEN** Issue #123에 코멘트가 5개 존재
- **WHEN** `get_issue({ issue_number: 123 })`를 호출 (include_comments 미지정)
- **THEN** 반환된 객체의 `comments` 필드가 `undefined`이거나 빈 배열이어야 함

## Interface

### Input Parameters

```typescript
interface GetIssueParams {
  issue_number: number;
  include_comments?: boolean;  // 기본: false
}
```

### Output

```typescript
interface GetIssueResult {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: string[];
  author: string;
  created_at: string;
  updated_at: string;

  // 파싱된 컨텍스트
  parsed_context: {
    type: "error" | "bug" | "feature";
    source: "sentry" | "asana" | "direct";
    file?: string;
    function?: string;
    lines?: string;
    component?: string;
    description?: string;
    stack_trace?: string;
    event_count?: number;
    sentry_link?: string;
    asana_link?: string;
  };

  // 관련 이슈
  related_issues: number[];

  // 코멘트 (include_comments: true 시)
  comments?: {
    id: number;
    author: string;
    body: string;
    created_at: string;
  }[];
}
```

## Error Handling

### Scenario: 필수 파라미터 누락

- **GIVEN** 파라미터가 비어있음
- **WHEN** `get_issue({})`를 호출
- **THEN** MCP error code "INVALID_PARAMS"와 함께 "issue_number is required" 메시지를 반환해야 함

### Scenario: GitHub API 실패

- **GIVEN** GitHub API가 일시적으로 응답하지 않음
- **WHEN** `get_issue({ issue_number: 123 })`를 호출
- **THEN** MCP error code "EXTERNAL_SERVICE_ERROR"와 함께 에러를 반환해야 함

### Scenario: 템플릿 파싱 실패

- **GIVEN** Issue #123의 본문이 템플릿 형식을 따르지 않음
- **WHEN** `get_issue({ issue_number: 123 })`를 호출
- **THEN** 파싱 가능한 부분만 추출하고, `parsed_context`에 가능한 필드만 포함하여 반환해야 함 (에러가 아님)
