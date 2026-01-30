---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: git
feature: manage-worktree
depends: "common/types"
---

# Manage Worktree

> Git Worktree 생성, 삭제, 조회를 통한 병렬 이슈 처리 지원

## Requirement: REQ-GIT-001 - Worktree 생성

Worktree를 생성하여 독립적인 작업 공간을 제공해야 한다.

### Scenario: 단일 이슈용 Worktree 생성

- **GIVEN** 유효한 GitHub Issue 번호가 주어지고
- **WHEN** `action: "create"`로 `manage_worktree`를 호출하면
- **THEN** 새로운 Worktree가 생성되고 브랜치가 체크아웃되어야 한다
- **AND** Worktree 경로와 브랜치명이 반환되어야 한다

### Scenario: 그룹 이슈용 Worktree 생성

- **GIVEN** 여러 개의 Issue 번호가 주어지고
- **WHEN** `action: "create"`로 `manage_worktree`를 호출하면
- **THEN** 그룹화된 브랜치명으로 Worktree가 생성되어야 한다
- **AND** 브랜치명은 `fix/issue-{number1}-{number2}-{number3}` 형식이어야 한다

### Scenario: 커스텀 브랜치명 지정

- **GIVEN** `branch_name` 파라미터가 제공되고
- **WHEN** `action: "create"`로 `manage_worktree`를 호출하면
- **THEN** 지정된 브랜치명으로 Worktree가 생성되어야 한다

### Scenario: Worktree 생성 실패 - 중복 브랜치

- **GIVEN** 이미 존재하는 브랜치명이 주어지고
- **WHEN** `action: "create"`로 `manage_worktree`를 호출하면
- **THEN** 에러가 반환되어야 한다
- **AND** `success: false`를 포함해야 한다

## Requirement: REQ-GIT-002 - Worktree 정리

사용이 완료된 Worktree를 제거해야 한다.

### Scenario: 정상 정리

- **GIVEN** 존재하는 Worktree의 Issue 번호가 주어지고
- **WHEN** `action: "cleanup"`으로 `manage_worktree`를 호출하면
- **THEN** Worktree 디렉토리가 삭제되어야 한다
- **AND** 연관된 브랜치는 유지되어야 한다

### Scenario: 존재하지 않는 Worktree 정리

- **GIVEN** 존재하지 않는 Worktree의 Issue 번호가 주어지고
- **WHEN** `action: "cleanup"`으로 `manage_worktree`를 호출하면
- **THEN** 에러를 반환하지 않고 성공으로 처리해야 한다

## Requirement: REQ-GIT-003 - Worktree 목록 조회

현재 활성화된 Worktree 목록을 조회해야 한다.

### Scenario: 활성 Worktree 목록

- **GIVEN** 여러 Worktree가 생성되어 있고
- **WHEN** `action: "list"`로 `manage_worktree`를 호출하면
- **THEN** 모든 Worktree의 목록이 반환되어야 한다
- **AND** 각 항목은 경로, 브랜치명, Issue 번호를 포함해야 한다

### Scenario: Worktree가 없는 경우

- **GIVEN** 생성된 Worktree가 없고
- **WHEN** `action: "list"`로 `manage_worktree`를 호출하면
- **THEN** 빈 배열이 반환되어야 한다

## Requirement: REQ-GIT-004 - 병렬 처리 제한

동시에 실행 가능한 Worktree 수를 제한해야 한다.

### Scenario: 최대 병렬 수 초과

- **GIVEN** 이미 최대 개수(기본 3개)의 Worktree가 생성되어 있고
- **WHEN** 추가로 Worktree를 생성하려 하면
- **THEN** 에러가 반환되어야 한다
- **AND** `error: "Maximum parallel worktrees exceeded"` 메시지를 포함해야 한다

## Data Types

### ManageWorktreeParams

```typescript
interface ManageWorktreeParams {
  action: "create" | "cleanup" | "list";
  issues?: number[];          // create/cleanup 시 필수
  branch_name?: string;       // create 시 선택 (자동 생성 가능)
}
```

**Constraints:**
- `action`은 MUST be one of: "create", "cleanup", "list"
- `issues`는 `action: "create"` 또는 `action: "cleanup"`일 때 MUST be provided
- `issues`의 각 요소는 MUST be a positive integer
- `branch_name`은 MUST match pattern: `^[a-z0-9/-]+$`

### ManageWorktreeResult

```typescript
interface ManageWorktreeResult {
  action: string;
  worktree_path?: string;     // create 시 반환
  branch: string;
  success: boolean;
  error?: string;             // 실패 시 반환
  worktrees?: WorktreeInfo[]; // list 시 반환
}

interface WorktreeInfo {
  path: string;
  branch: string;
  issues: number[];
}
```

**Constraints:**
- `action`은 MUST match the input action
- `success`는 MUST be `true` for successful operations
- `worktree_path`은 `action: "create"`이고 `success: true`일 때 MUST be provided
- `error`는 `success: false`일 때 SHOULD be provided
- `worktrees`는 `action: "list"`일 때 MUST be provided

## Implementation Notes

### Worktree 경로 생성 규칙

- 기본 경로: `{base_path}/fix-issue-{numbers}`
- 단일 이슈: `../worktrees/fix-issue-123`
- 그룹 이슈: `../worktrees/fix-issue-123-124-125`

### 브랜치명 생성 규칙

- 단일 이슈: `fix/issue-123`
- 그룹 이슈: `fix/issue-123-124-125`
- 커스텀: 사용자 지정 브랜치명 사용

### 정리 전략

- Worktree 디렉토리만 삭제
- 브랜치는 PR 생성 후에도 유지 (GitHub에서 자동 정리)
- 강제 삭제 옵션 없음 (안전성 우선)
