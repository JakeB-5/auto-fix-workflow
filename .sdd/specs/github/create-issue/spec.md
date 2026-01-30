---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: github
feature: create-issue
depends: "common/types"
---

# Create Issue

> Asana 태스크 또는 수동으로 GitHub Issue를 생성하는 Tool

## Requirement: REQ-001 - Auto-Fix Issue 템플릿 생성

시스템은 Auto-Fix Issue 템플릿 형식에 맞춰 GitHub Issue를 생성해야 한다(SHALL).

### Scenario: 버그 리포트 이슈 생성

- **GIVEN** Asana 태스크 분석 결과가 다음과 같음
  ```typescript
  {
    type: "bug",
    title: "저장 버튼 클릭 시 에러 발생",
    file: "src/components/Editor.tsx",
    function: "handleSave()",
    component: "editor",
    description: "새 문서 저장 시 TypeError 발생"
  }
  ```
- **WHEN** `create_issue({ title, body, labels, asana_task_id })`를 호출
- **THEN** GitHub에 Auto-Fix Issue 템플릿 형식의 이슈가 생성되어야 함

### Scenario: Asana 링크 포함

- **GIVEN** `asana_task_id: "1234567890"`이 파라미터에 포함됨
- **WHEN** `create_issue({ ..., asana_task_id: "1234567890" })`를 호출
- **THEN** 생성된 이슈 본문의 "Source.Reference"에 Asana 태스크 링크가 포함되어야 함

## Requirement: REQ-002 - 라벨 자동 설정

시스템은 이슈 타입과 소스에 따라 적절한 라벨을 자동으로 추가해야 한다(SHALL).

### Scenario: 기본 라벨 자동 추가

- **GIVEN** 이슈를 생성할 때 `labels: ["component:editor"]`만 지정
- **WHEN** `create_issue({ labels: ["component:editor"] })`를 호출
- **THEN** 생성된 이슈에 "auto-fix", "component:editor" 라벨이 모두 포함되어야 함

### Scenario: Asana 소스 라벨

- **GIVEN** `asana_task_id`가 제공됨
- **WHEN** `create_issue({ ..., asana_task_id: "123" })`를 호출
- **THEN** 생성된 이슈에 "asana" 라벨이 자동으로 추가되어야 함

### Scenario: Sentry 소스 라벨

- **GIVEN** 이슈 본문에 Sentry 정보가 포함됨 (sentry_link)
- **WHEN** `create_issue({ ..., body: "...sentry.io..." })`를 호출
- **THEN** 생성된 이슈에 "sentry" 라벨이 자동으로 추가되어야 함

## Requirement: REQ-003 - 템플릿 검증

시스템은 필수 필드가 누락된 경우 에러를 반환해야 한다(SHALL).

### Scenario: 필수 필드 검증

- **GIVEN** `title`이 누락됨
- **WHEN** `create_issue({ body: "...", labels: [] })`를 호출
- **THEN** MCP error code "INVALID_PARAMS"와 함께 "title is required" 메시지를 반환해야 함

### Scenario: 본문 형식 검증

- **GIVEN** `body`가 비어있거나 템플릿 구조가 아님
- **WHEN** `create_issue({ title: "...", body: "" })`를 호출
- **THEN** MCP error code "INVALID_PARAMS"와 함께 "body must follow Auto-Fix Issue template" 메시지를 반환해야 함

## Requirement: REQ-004 - Asana 태스크 업데이트 (연동)

시스템은 GitHub Issue 생성 후 원본 Asana 태스크를 업데이트해야 한다(SHALL).

### Scenario: Asana 태그 및 코멘트 추가

- **GIVEN** `asana_task_id: "1234567890"`이 제공되고 GitHub Issue #123이 생성됨
- **WHEN** `create_issue({ ..., asana_task_id: "1234567890" })`가 성공
- **THEN** Asana 태스크에 다음이 수행되어야 함
  - 태그 "triaged" 추가
  - 코멘트 "GitHub Issue #123 created: [링크]" 추가

### Scenario: Asana 업데이트 실패 시 롤백 안함

- **GIVEN** GitHub Issue #123이 생성됨
- **WHEN** Asana API 호출이 실패
- **THEN** GitHub Issue는 롤백하지 않고, 경고 메시지만 반환해야 함

## Interface

### Input Parameters

```typescript
interface CreateIssueParams {
  title: string;
  body: string;              // Auto-Fix Issue 템플릿 형식
  labels?: string[];         // 추가 라벨 (auto-fix는 자동 추가)
  asana_task_id?: string;    // Asana 태스크 ID (선택)
}
```

### Output

```typescript
interface CreateIssueResult {
  issue_number: number;
  url: string;
  created_at: string;
  labels: string[];

  // Asana 업데이트 결과
  asana_updated?: {
    success: boolean;
    tag_added: boolean;
    comment_added: boolean;
    error?: string;
  };
}
```

## Error Handling

### Scenario: 중복 이슈 방지

- **GIVEN** 동일한 `asana_task_id`로 이미 GitHub Issue가 생성되어 있음
- **WHEN** `create_issue({ ..., asana_task_id: "1234567890" })`를 호출
- **THEN** MCP error code "DUPLICATE"와 함께 기존 이슈 번호를 포함한 에러를 반환해야 함

### Scenario: GitHub API 권한 부족

- **GIVEN** GitHub PAT이 Issue 생성 권한이 없음
- **WHEN** `create_issue({ ... })`를 호출
- **THEN** MCP error code "PERMISSION_DENIED"와 함께 에러를 반환해야 함

### Scenario: 라벨이 레포지토리에 존재하지 않음

- **GIVEN** `labels: ["non-existent-label"]`이 제공됨
- **WHEN** `create_issue({ labels: ["non-existent-label"] })`를 호출
- **THEN** GitHub Issue는 생성되지만, 존재하지 않는 라벨은 무시하고 경고를 반환해야 함

## Template Generation

### Scenario: Auto-Fix Issue 템플릿 자동 생성

시스템은 구조화된 데이터를 받아 템플릿 형식의 본문을 자동 생성할 수 있어야 한다(SHOULD).

- **GIVEN** 구조화된 이슈 데이터
  ```typescript
  {
    type: "bug",
    source: "asana",
    file: "src/Editor.tsx",
    function: "handleSave()",
    component: "editor",
    description: "저장 시 에러"
  }
  ```
- **WHEN** 내부적으로 템플릿 생성 함수 호출
- **THEN** 다음 형식의 `body` 문자열이 생성되어야 함
  ```markdown
  ## 🤖 Auto-Fix Issue

  ### Type
  - [x] 🐛 Bug Report

  ### Source
  - **Origin**: Asana

  ### Context
  - **파일**: `src/Editor.tsx`
  - **함수/클래스**: `handleSave()`
  - **컴포넌트**: editor

  ### Problem Description
  저장 시 에러
  ```
