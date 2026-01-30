---
status: draft
created: 2026-01-30
domain: common
feature: error-handler
depends: null
---

# Error Handler

> 도메인별 에러 클래스와 에러 코드 체계를 정의하여 일관된 에러 처리를 제공한다.

## Requirement: REQ-001 - 기본 에러 클래스 정의

시스템은 모든 도메인 에러의 기반이 되는 베이스 클래스를 제공해야 한다(SHALL).

### Scenario: AutofixError 기본 클래스

- **GIVEN** `AutofixError` 클래스가 정의되어 있다
- **WHEN** 새로운 에러를 생성한다
- **THEN** 에러는 `code`, `message`, `details` 필드를 포함해야 한다

### Scenario: Error 클래스 상속

- **GIVEN** `AutofixError`가 정의되어 있다
- **WHEN** `instanceof Error` 체크를 수행한다
- **THEN** `true`를 반환해야 한다

### Scenario: 스택 트레이스 보존

- **GIVEN** `AutofixError`를 생성한다
- **WHEN** 에러를 throw한다
- **THEN** 스택 트레이스(`stack` 속성)가 정확한 발생 위치를 가리켜야 한다

## Requirement: REQ-002 - Config 관련 에러 정의

시스템은 설정 파일 관련 에러를 명확하게 구분해야 한다(SHALL).

### Scenario: ConfigFileNotFoundError

- **GIVEN** 설정 파일이 존재하지 않는다
- **WHEN** `ConfigFileNotFoundError`를 생성한다
- **THEN** 에러 코드는 `"CONFIG_FILE_NOT_FOUND"`여야 한다

### Scenario: ConfigParseError

- **GIVEN** 설정 파일이 잘못된 YAML 형식이다
- **WHEN** `ConfigParseError`를 생성한다
- **THEN** 에러 코드는 `"CONFIG_PARSE_ERROR"`이고 `details`에 파싱 에러 정보가 포함되어야 한다

### Scenario: ConfigValidationError

- **GIVEN** 설정 파일이 Zod 스키마 검증을 통과하지 못한다
- **WHEN** `ConfigValidationError`를 생성한다
- **THEN** 에러 코드는 `"CONFIG_VALIDATION_ERROR"`이고 `details`에 검증 실패 필드 정보가 포함되어야 한다

## Requirement: REQ-003 - GitHub API 관련 에러 정의

시스템은 GitHub API 호출 실패를 명확하게 구분해야 한다(SHALL).

### Scenario: GitHubAPIError

- **GIVEN** GitHub API 호출이 실패한다
- **WHEN** `GitHubAPIError`를 생성한다
- **THEN** 에러 코드는 `"GITHUB_API_ERROR"`이고 `details`에 HTTP 상태 코드와 응답 메시지가 포함되어야 한다

### Scenario: IssueNotFoundError

- **GIVEN** 요청한 Issue가 존재하지 않는다
- **WHEN** `IssueNotFoundError`를 생성한다
- **THEN** 에러 코드는 `"ISSUE_NOT_FOUND"`이고 `details`에 이슈 번호가 포함되어야 한다

### Scenario: GitHubRateLimitError

- **GIVEN** GitHub API Rate Limit에 도달한다
- **WHEN** `GitHubRateLimitError`를 생성한다
- **THEN** 에러 코드는 `"GITHUB_RATE_LIMIT"`이고 `details`에 재시도 가능 시간이 포함되어야 한다

## Requirement: REQ-004 - Asana API 관련 에러 정의

시스템은 Asana API 호출 실패를 명확하게 구분해야 한다(SHALL).

### Scenario: AsanaAPIError

- **GIVEN** Asana API 호출이 실패한다
- **WHEN** `AsanaAPIError`를 생성한다
- **THEN** 에러 코드는 `"ASANA_API_ERROR"`이고 `details`에 HTTP 상태 코드와 응답 메시지가 포함되어야 한다

### Scenario: TaskNotFoundError

- **GIVEN** 요청한 Asana Task가 존재하지 않는다
- **WHEN** `TaskNotFoundError`를 생성한다
- **THEN** 에러 코드는 `"TASK_NOT_FOUND"`이고 `details`에 태스크 ID가 포함되어야 한다

### Scenario: TaskAnalysisError

- **GIVEN** Asana Task 분석이 실패한다(정보 부족 등)
- **WHEN** `TaskAnalysisError`를 생성한다
- **THEN** 에러 코드는 `"TASK_ANALYSIS_ERROR"`이고 `details`에 실패 이유와 필요 정보가 포함되어야 한다

## Requirement: REQ-005 - Worktree 관련 에러 정의

시스템은 Git Worktree 작업 실패를 명확하게 구분해야 한다(SHALL).

### Scenario: WorktreeCreateError

- **GIVEN** Worktree 생성이 실패한다
- **WHEN** `WorktreeCreateError`를 생성한다
- **THEN** 에러 코드는 `"WORKTREE_CREATE_ERROR"`이고 `details`에 실패 이유와 경로가 포함되어야 한다

### Scenario: WorktreeCleanupError

- **GIVEN** Worktree 정리가 실패한다
- **WHEN** `WorktreeCleanupError`를 생성한다
- **THEN** 에러 코드는 `"WORKTREE_CLEANUP_ERROR"`이고 `details`에 정리 실패한 경로가 포함되어야 한다

### Scenario: WorktreeAlreadyExistsError

- **GIVEN** 동일한 브랜치의 Worktree가 이미 존재한다
- **WHEN** `WorktreeAlreadyExistsError`를 생성한다
- **THEN** 에러 코드는 `"WORKTREE_ALREADY_EXISTS"`이고 `details`에 기존 경로가 포함되어야 한다

## Requirement: REQ-006 - 파싱 관련 에러 정의

시스템은 데이터 파싱 실패를 명확하게 구분해야 한다(SHALL).

### Scenario: IssueParseError

- **GIVEN** Issue 템플릿 파싱이 실패한다
- **WHEN** `IssueParseError`를 생성한다
- **THEN** 에러 코드는 `"ISSUE_PARSE_ERROR"`이고 `details`에 파싱 실패 섹션 정보가 포함되어야 한다

### Scenario: YAMLParseError

- **GIVEN** YAML 파일 파싱이 실패한다
- **WHEN** `YAMLParseError`를 생성한다
- **THEN** 에러 코드는 `"YAML_PARSE_ERROR"`이고 `details`에 라인 번호와 에러 메시지가 포함되어야 한다

## Requirement: REQ-007 - 체크 실패 에러 정의

시스템은 코드 체크(테스트, 린트 등) 실패를 명확하게 구분해야 한다(SHALL).

### Scenario: CheckFailedError

- **GIVEN** 코드 체크가 실패한다
- **WHEN** `CheckFailedError`를 생성한다
- **THEN** 에러 코드는 `"CHECK_FAILED"`이고 `details`에 실패한 체크 종류와 출력이 포함되어야 한다

### Scenario: TestFailedError

- **GIVEN** 테스트 실행이 실패한다
- **WHEN** `TestFailedError`를 생성한다
- **THEN** 에러 코드는 `"TEST_FAILED"`이고 `details`에 실패한 테스트 목록이 포함되어야 한다

### Scenario: LintFailedError

- **GIVEN** 린트 체크가 실패한다
- **WHEN** `LintFailedError`를 생성한다
- **THEN** 에러 코드는 `"LINT_FAILED"`이고 `details`에 린트 에러 목록이 포함되어야 한다

## Requirement: REQ-008 - 에러 코드 체계

시스템은 일관된 에러 코드 네이밍 규칙을 따라야 한다(SHALL).

### Scenario: 도메인 기반 프리픽스

- **GIVEN** 에러 코드가 정의되어 있다
- **WHEN** 에러 코드를 확인한다
- **THEN** `{DOMAIN}_{ERROR_TYPE}` 형식을 따라야 한다 (예: `GITHUB_API_ERROR`, `CONFIG_PARSE_ERROR`)

### Scenario: 에러 코드 유니크

- **GIVEN** 시스템의 모든 에러 코드가 정의되어 있다
- **WHEN** 에러 코드 목록을 확인한다
- **THEN** 모든 에러 코드는 고유해야 한다

### Scenario: 에러 코드 타입 안전성

- **GIVEN** `ErrorCode` 타입이 정의되어 있다
- **WHEN** 에러 코드를 사용한다
- **THEN** TypeScript 타입 시스템이 허용되지 않은 코드 사용을 방지해야 한다

## Requirement: REQ-009 - 에러 직렬화

시스템은 에러를 JSON으로 직렬화할 수 있어야 한다(SHALL).

### Scenario: toJSON 메서드

- **GIVEN** `AutofixError` 인스턴스가 있다
- **WHEN** `JSON.stringify(error)`를 호출한다
- **THEN** `code`, `message`, `details` 필드를 포함한 JSON 문자열이 반환되어야 한다

### Scenario: 중첩된 에러 직렬화

- **GIVEN** `details`에 원본 에러(`cause`)가 포함되어 있다
- **WHEN** 에러를 직렬화한다
- **THEN** 중첩된 에러 정보도 포함되어야 한다

## Requirement: REQ-010 - 에러 로깅

시스템은 에러를 적절히 로깅할 수 있어야 한다(SHALL).

### Scenario: 구조화된 로그 출력

- **GIVEN** 에러가 발생한다
- **WHEN** 에러를 로깅한다
- **THEN** 에러 코드, 메시지, details, 스택 트레이스가 모두 로그에 포함되어야 한다

### Scenario: 민감 정보 마스킹

- **GIVEN** 에러 `details`에 토큰이나 비밀번호가 포함되어 있다
- **WHEN** 에러를 로깅한다
- **THEN** 민감 정보는 `***`로 마스킹되어야 한다

### Scenario: 에러 레벨 구분

- **GIVEN** 여러 종류의 에러가 있다
- **WHEN** 에러를 로깅한다
- **THEN** 에러 심각도에 따라 `ERROR`, `WARN`, `INFO` 레벨로 구분되어야 한다
