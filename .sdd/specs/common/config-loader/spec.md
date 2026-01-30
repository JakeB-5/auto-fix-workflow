---
status: draft
created: 2026-01-30
domain: common
feature: config-loader
depends: null
---

# Config Loader

> autofix.config.yml 파일을 로딩하고 환경변수를 통합하여 검증된 설정 객체를 제공한다.

## Requirement: REQ-001 - YAML 설정 파일 로딩

시스템은 프로젝트 루트의 `autofix.config.yml` 파일을 읽어야 한다(SHALL).

### Scenario: 유효한 설정 파일 로딩

- **GIVEN** `autofix.config.yml` 파일이 존재한다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** YAML 파일이 파싱되어 JavaScript 객체로 반환된다

### Scenario: 설정 파일이 없는 경우

- **GIVEN** `autofix.config.yml` 파일이 존재하지 않는다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `ConfigFileNotFoundError` 에러를 던져야 한다

### Scenario: 잘못된 YAML 형식

- **GIVEN** `autofix.config.yml` 파일이 잘못된 YAML 형식이다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `ConfigParseError` 에러를 던져야 한다

## Requirement: REQ-002 - 환경변수 통합

시스템은 설정 파일의 값을 환경변수로 오버라이드할 수 있어야 한다(SHALL).

### Scenario: GitHub 토큰 환경변수 오버라이드

- **GIVEN** 설정 파일에 `github.token: "file-token"`이 있고
- **AND** 환경변수 `GITHUB_TOKEN="env-token"`이 설정되어 있다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** 최종 설정의 `github.token` 값은 `"env-token"`이어야 한다

### Scenario: 중첩된 설정 오버라이드

- **GIVEN** 설정 파일에 `asana.workspace_id: "123"`이 있고
- **AND** 환경변수 `ASANA_WORKSPACE_ID="456"`이 설정되어 있다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** 최종 설정의 `asana.workspace_id` 값은 `"456"`이어야 한다

### Scenario: 환경변수 매핑 규칙

- **GIVEN** 환경변수 이름 규칙은 `PREFIX_NESTED_KEY` 형태다
- **WHEN** `GITHUB_OWNER`, `ASANA_TOKEN` 등의 환경변수가 설정되어 있다
- **THEN** 각각 `github.owner`, `asana.token` 설정으로 매핑되어야 한다

## Requirement: REQ-003 - Zod 스키마 검증

시스템은 로딩된 설정을 Zod 스키마로 검증해야 한다(SHALL).

### Scenario: 유효한 설정 검증 통과

- **GIVEN** 로딩된 설정이 모든 필수 필드를 포함한다
- **WHEN** Zod 스키마 검증을 수행한다
- **THEN** 검증이 통과하고 타입이 안전한 설정 객체를 반환한다

### Scenario: 필수 필드 누락

- **GIVEN** 설정 파일에 `github.owner` 필드가 없다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `ConfigValidationError` 에러를 던지고 누락된 필드를 명시해야 한다

### Scenario: 잘못된 타입

- **GIVEN** 설정 파일에 `worktree.max_parallel: "invalid"`(문자열)가 있다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `ConfigValidationError` 에러를 던지고 예상 타입(number)을 명시해야 한다

### Scenario: 허용되지 않는 값

- **GIVEN** 설정 파일에 `sentry.severity: ["critical"]`이 있다
- **AND** 허용 값은 `["error", "fatal"]`만 가능하다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `ConfigValidationError` 에러를 던지고 허용 값 목록을 명시해야 한다

## Requirement: REQ-004 - 기본값 제공

시스템은 선택적 설정 필드에 대해 기본값을 제공해야 한다(SHALL).

### Scenario: 체크 명령어 기본값

- **GIVEN** 설정 파일에 `checks` 필드가 없다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `checks` 필드는 `["pnpm test", "pnpm type-check", "pnpm lint"]` 기본값을 가져야 한다

### Scenario: Worktree 경로 기본값

- **GIVEN** 설정 파일에 `worktree.base_path` 필드가 없다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `worktree.base_path` 필드는 `"../worktrees"` 기본값을 가져야 한다

### Scenario: 최대 병렬 처리 기본값

- **GIVEN** 설정 파일에 `worktree.max_parallel` 필드가 없다
- **WHEN** `loadConfig()` 함수를 호출한다
- **THEN** `worktree.max_parallel` 필드는 `3` 기본값을 가져야 한다

## Requirement: REQ-005 - 설정 캐싱

시스템은 로딩된 설정을 캐싱하여 반복 호출 시 재사용해야 한다(SHALL).

### Scenario: 동일 프로세스 내 재사용

- **GIVEN** `loadConfig()`를 한 번 호출하여 설정을 로딩했다
- **WHEN** 동일 프로세스 내에서 `loadConfig()`를 다시 호출한다
- **THEN** 파일을 다시 읽지 않고 캐싱된 설정을 반환해야 한다

### Scenario: 강제 리로드

- **GIVEN** 설정이 이미 캐싱되어 있다
- **WHEN** `loadConfig({ reload: true })`를 호출한다
- **THEN** 캐시를 무시하고 파일을 다시 읽어 새로운 설정을 반환해야 한다
