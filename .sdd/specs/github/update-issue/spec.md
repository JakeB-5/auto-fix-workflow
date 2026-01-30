---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: github
feature: update-issue
depends: "common/types"
---

# Update Issue

> GitHub Issue에 코멘트를 추가하거나 라벨을 변경하는 Tool

## Requirement: REQ-001 - 진행 상황 코멘트 추가

시스템은 자동 수정 워크플로우의 진행 상황을 이슈에 코멘트로 기록해야 한다(SHALL).

### Scenario: 처리 시작 코멘트

- **GIVEN** Issue #123의 자동 수정이 시작됨
- **WHEN** `update_issue({ issue_number: 123, comment: "🔄 자동 수정을 시작합니다..." })`를 호출
- **THEN** Issue #123에 코멘트가 추가되어야 함

### Scenario: PR 생성 완료 코멘트

- **GIVEN** Issue #123에 대한 PR #201이 생성됨
- **WHEN** `update_issue({ issue_number: 123, comment: "✅ PR #201이 생성되었습니다." })`를 호출
- **THEN** Issue #123에 코멘트가 추가되고, PR 링크가 포함되어야 함

### Scenario: 실패 코멘트

- **GIVEN** Issue #123의 자동 수정이 3회 시도 후 실패
- **WHEN** `update_issue({ issue_number: 123, comment: "❌ 자동 수정에 실패했습니다. 상세 로그: ..." })`를 호출
- **THEN** Issue #123에 실패 코멘트가 추가되어야 함

## Requirement: REQ-002 - 라벨 상태 관리

시스템은 자동 수정 워크플로우의 상태에 따라 라벨을 자동으로 변경해야 한다(SHALL).

### Scenario: 처리 중 라벨 추가

- **GIVEN** Issue #123의 자동 수정이 시작됨
- **WHEN** `update_issue({ issue_number: 123, labels: ["auto-fix-processing"] })`를 호출
- **THEN** Issue #123에 "auto-fix-processing" 라벨이 추가되어야 함 (기존 라벨 유지)

### Scenario: 실패 라벨 추가 및 처리 중 라벨 제거

- **GIVEN** Issue #123이 "auto-fix-processing" 라벨을 가짐
- **WHEN** `update_issue({ issue_number: 123, add_labels: ["auto-fix-failed"], remove_labels: ["auto-fix-processing"] })`를 호출
- **THEN** "auto-fix-processing" 라벨은 제거되고, "auto-fix-failed" 라벨이 추가되어야 함

### Scenario: 성공 시 처리 중 라벨만 제거

- **GIVEN** Issue #123이 "auto-fix-processing" 라벨을 가짐
- **WHEN** `update_issue({ issue_number: 123, remove_labels: ["auto-fix-processing"] })`를 호출
- **THEN** "auto-fix-processing" 라벨만 제거되어야 함 (다른 라벨 유지)

## Requirement: REQ-003 - 코멘트와 라벨 동시 업데이트

시스템은 하나의 호출로 코멘트 추가와 라벨 변경을 동시에 수행할 수 있어야 한다(SHALL).

### Scenario: 실패 시 코멘트와 라벨 동시 업데이트

- **GIVEN** Issue #123의 자동 수정이 실패
- **WHEN** `update_issue({ issue_number: 123, comment: "❌ 실패", add_labels: ["auto-fix-failed"], remove_labels: ["auto-fix-processing"] })`를 호출
- **THEN** 하나의 트랜잭션으로 코멘트 추가 및 라벨 변경이 수행되어야 함

### Scenario: 부분 실패 처리

- **GIVEN** 코멘트 추가는 성공했지만 라벨 변경이 실패
- **WHEN** `update_issue({ issue_number: 123, comment: "...", add_labels: ["invalid-label"] })`를 호출
- **THEN** 성공한 작업(코멘트)은 유지하고, 실패한 작업(라벨)에 대한 경고를 반환해야 함

## Requirement: REQ-004 - 멱등성 보장

시스템은 동일한 업데이트를 여러 번 호출해도 안전해야 한다(SHALL).

### Scenario: 동일 라벨 중복 추가 방지

- **GIVEN** Issue #123이 이미 "auto-fix-processing" 라벨을 가짐
- **WHEN** `update_issue({ issue_number: 123, add_labels: ["auto-fix-processing"] })`를 재호출
- **THEN** 에러 없이 성공하고, 라벨이 중복 추가되지 않아야 함

### Scenario: 없는 라벨 제거 시도

- **GIVEN** Issue #123이 "auto-fix-processing" 라벨을 가지지 않음
- **WHEN** `update_issue({ issue_number: 123, remove_labels: ["auto-fix-processing"] })`를 호출
- **THEN** 에러 없이 성공하고, 아무 변경도 일어나지 않아야 함

## Interface

### Input Parameters

```typescript
interface UpdateIssueParams {
  issue_number: number;

  // 코멘트
  comment?: string;

  // 라벨 관리 (Option 1: 간단한 방식)
  labels?: string[];         // 전체 라벨 교체 (주의: 기존 라벨 모두 삭제)

  // 라벨 관리 (Option 2: 세밀한 제어, 권장)
  add_labels?: string[];     // 추가할 라벨
  remove_labels?: string[];  // 제거할 라벨
}
```

### Output

```typescript
interface UpdateIssueResult {
  issue_number: number;
  updated_at: string;

  // 업데이트 결과
  comment_added?: boolean;
  labels_updated?: boolean;
  current_labels: string[];

  // 경고 (부분 실패 시)
  warnings?: string[];
}
```

## Error Handling

### Scenario: 존재하지 않는 이슈

- **GIVEN** GitHub 레포지토리에 Issue #999가 존재하지 않음
- **WHEN** `update_issue({ issue_number: 999, comment: "..." })`를 호출
- **THEN** MCP error code "NOT_FOUND"와 함께 에러를 반환해야 함

### Scenario: 빈 업데이트 요청

- **GIVEN** 코멘트도 라벨도 제공되지 않음
- **WHEN** `update_issue({ issue_number: 123 })`를 호출
- **THEN** MCP error code "INVALID_PARAMS"와 함께 "At least one of comment, labels, add_labels, remove_labels is required" 메시지를 반환해야 함

### Scenario: GitHub API 권한 부족

- **GIVEN** GitHub PAT이 Issue 수정 권한이 없음
- **WHEN** `update_issue({ issue_number: 123, comment: "..." })`를 호출
- **THEN** MCP error code "PERMISSION_DENIED"와 함께 에러를 반환해야 함

## Progress Tracking

### Scenario: 워크플로우 전체 진행 상황 추적

자동 수정 워크플로우의 각 단계에서 호출되는 패턴:

1. **시작**: `update_issue({ comment: "🔄 처리 시작", add_labels: ["auto-fix-processing"] })`
2. **분석 완료**: `update_issue({ comment: "🔍 분석 완료: 3개 파일 수정 필요" })`
3. **수정 완료**: `update_issue({ comment: "✏️ 코드 수정 완료" })`
4. **테스트 실행**: `update_issue({ comment: "🧪 테스트 실행 중..." })`
5. **성공**: `update_issue({ comment: "✅ PR #201 생성", remove_labels: ["auto-fix-processing"] })`
6. **실패**: `update_issue({ comment: "❌ 실패: 테스트 통과 안됨", add_labels: ["auto-fix-failed"], remove_labels: ["auto-fix-processing"] })`

### Scenario: 진행 상황 코멘트 형식

코멘트는 다음 형식을 따라야 한다(SHOULD):

- **시작**: 🔄 emoji + 단계명
- **진행**: 🔍/✏️/🧪 등 단계별 emoji
- **성공**: ✅ + 결과
- **실패**: ❌ + 실패 이유
