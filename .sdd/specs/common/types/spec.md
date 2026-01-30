---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: common
feature: types
depends: null
---

# Common Types

> 시스템 전반에서 사용되는 공유 타입과 인터페이스를 정의한다.

## Requirement: REQ-001 - Issue 타입 정의

시스템은 GitHub Issue를 표현하는 타입을 제공해야 한다(SHALL).

### Scenario: 기본 Issue 필드

- **GIVEN** Issue 타입이 정의되어 있다
- **WHEN** Issue 객체를 생성한다
- **THEN** 다음 필드를 포함해야 한다: `number`, `title`, `labels`, `state`, `created_at`

### Scenario: Issue Context 추출

- **GIVEN** Issue 타입이 `context` 필드를 포함한다
- **WHEN** Issue 템플릿에서 파싱한 데이터를 할당한다
- **THEN** `context.file`, `context.function`, `context.line`, `context.component` 필드가 있어야 한다

### Scenario: Issue Source 정보

- **GIVEN** Issue 타입이 `source` 필드를 포함한다
- **WHEN** Issue 출처를 표시한다
- **THEN** `source.origin`은 `"Sentry" | "Asana" | "Direct"` 중 하나여야 한다
- **AND** `source.reference` 필드로 원본 링크를 참조할 수 있어야 한다

## Requirement: REQ-002 - PullRequest 타입 정의

시스템은 GitHub Pull Request를 표현하는 타입을 제공해야 한다(SHALL).

### Scenario: PR 기본 정보

- **GIVEN** PullRequest 타입이 정의되어 있다
- **WHEN** PR 객체를 생성한다
- **THEN** 다음 필드를 포함해야 한다: `number`, `title`, `body`, `head`, `base`, `state`

### Scenario: PR과 Issue 연결

- **GIVEN** PullRequest 타입이 `relatedIssues` 필드를 포함한다
- **WHEN** PR이 여러 이슈를 해결한다
- **THEN** `relatedIssues`는 Issue 번호 배열(`number[]`)이어야 한다

### Scenario: PR 생성 파라미터

- **GIVEN** `CreatePRParams` 타입이 정의되어 있다
- **WHEN** PR 생성 요청을 만든다
- **THEN** 필수 필드는 `branch`, `target`, `title`이고 선택 필드는 `body`, `labels`, `issues`여야 한다

## Requirement: REQ-003 - Config 타입 정의

시스템은 설정 파일 구조를 표현하는 타입을 제공해야 한다(SHALL).

### Scenario: GitHub 설정 타입

- **GIVEN** `GitHubConfig` 타입이 정의되어 있다
- **WHEN** GitHub 관련 설정을 정의한다
- **THEN** `owner`, `repo`, `base_branch`, `fix_branch`, `labels` 필드를 포함해야 한다

### Scenario: Asana 설정 타입

- **GIVEN** `AsanaConfig` 타입이 정의되어 있다
- **WHEN** Asana 관련 설정을 정의한다
- **THEN** `workspace_id`, `project_id`, `sections`, `tags` 필드를 포함해야 한다

### Scenario: Worktree 설정 타입

- **GIVEN** `WorktreeConfig` 타입이 정의되어 있다
- **WHEN** Worktree 관련 설정을 정의한다
- **THEN** `base_path`는 문자열이고 `max_parallel`은 숫자여야 한다

### Scenario: 전체 Config 타입 통합

- **GIVEN** `Config` 타입이 정의되어 있다
- **WHEN** 전체 설정을 표현한다
- **THEN** `github`, `asana`, `sentry`, `worktree`, `checks` 필드를 포함해야 한다

## Requirement: REQ-004 - Result 타입 정의

시스템은 작업 결과를 표현하는 제네릭 타입을 제공해야 한다(SHALL).

### Scenario: 성공 결과

- **GIVEN** `Result<T, E>` 타입이 정의되어 있다
- **WHEN** 작업이 성공한다
- **THEN** `{ success: true, data: T }` 형태를 가져야 한다

### Scenario: 실패 결과

- **GIVEN** `Result<T, E>` 타입이 정의되어 있다
- **WHEN** 작업이 실패한다
- **THEN** `{ success: false, error: E }` 형태를 가져야 한다

### Scenario: Result 타입 가드

- **GIVEN** Result 값이 있다
- **WHEN** `result.success`를 체크한다
- **THEN** TypeScript 타입 좁히기가 작동하여 `data` 또는 `error`에 안전하게 접근할 수 있어야 한다

## Requirement: REQ-005 - WorktreeInfo 타입 정의

시스템은 Git Worktree 정보를 표현하는 타입을 제공해야 한다(SHALL).

### Scenario: Worktree 기본 정보

- **GIVEN** `WorktreeInfo` 타입이 정의되어 있다
- **WHEN** Worktree 정보를 표현한다
- **THEN** `path`, `branch`, `issues` 필드를 포함해야 한다

### Scenario: Worktree 관리 액션

- **GIVEN** `WorktreeAction` 타입이 정의되어 있다
- **WHEN** Worktree 관리 작업을 지정한다
- **THEN** `"create" | "cleanup" | "list"` 중 하나여야 한다

### Scenario: Worktree 생성 파라미터

- **GIVEN** `CreateWorktreeParams` 타입이 정의되어 있다
- **WHEN** Worktree 생성 요청을 만든다
- **THEN** `issues` 필드는 필수이고 `branch_name` 필드는 선택적이어야 한다

## Requirement: REQ-006 - CheckResult 타입 정의

시스템은 코드 체크(테스트, 린트 등) 결과를 표현하는 타입을 제공해야 한다(SHALL).

### Scenario: 개별 체크 결과

- **GIVEN** `SingleCheckResult` 타입이 정의되어 있다
- **WHEN** 단일 체크(예: `pnpm test`) 결과를 표현한다
- **THEN** `check`, `passed`, `output`, `error` 필드를 포함해야 한다

### Scenario: 전체 체크 결과

- **GIVEN** `CheckResult` 타입이 정의되어 있다
- **WHEN** 모든 체크의 결과를 표현한다
- **THEN** `passed`(전체 성공 여부)와 `results`(개별 결과 배열) 필드를 포함해야 한다

### Scenario: 체크 타입 정의

- **GIVEN** `CheckType` 타입이 정의되어 있다
- **WHEN** 실행 가능한 체크를 지정한다
- **THEN** `"test" | "typecheck" | "lint"` 중 하나여야 한다

## Requirement: REQ-007 - IssueGroup 타입 정의

시스템은 그룹핑된 이슈들을 표현하는 타입을 제공해야 한다(SHALL).

### Scenario: 이슈 그룹 기본 정보

- **GIVEN** `IssueGroup` 타입이 정의되어 있다
- **WHEN** 유사한 이슈들을 그룹핑한다
- **THEN** `key`(그룹 식별자), `issues`(이슈 번호 배열), `suggested_branch`(제안 브랜치명) 필드를 포함해야 한다

### Scenario: 그룹핑 기준

- **GIVEN** `GroupBy` 타입이 정의되어 있다
- **WHEN** 이슈 그룹핑 기준을 지정한다
- **THEN** `"component" | "file" | "label"` 중 하나여야 한다
