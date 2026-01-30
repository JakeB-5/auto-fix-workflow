---
status: draft
created: 2026-01-30
domain: common
feature: logger
depends: null
---

# Logger - 구조화된 로깅

> 구조화된 JSON 형식의 로깅 시스템을 제공하여 일관된 로그 관리와 분석을 가능하게 한다.

## Requirement: REQ-001 - 로그 레벨 지원

시스템은 다양한 심각도의 로그 레벨을 제공해야 한다(SHALL).

### Scenario: 기본 로그 레벨

- **GIVEN** Logger 인스턴스가 생성되어 있다
- **WHEN** 로그 레벨을 확인한다
- **THEN** `debug`, `info`, `warn`, `error` 레벨이 지원되어야 한다

### Scenario: 레벨별 로깅

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `logger.info("message")`를 호출한다
- **THEN** 로그 출력의 `level` 필드는 `"info"`여야 한다

### Scenario: 레벨 필터링

- **GIVEN** Logger의 최소 레벨이 `warn`으로 설정되어 있다
- **WHEN** `logger.debug("debug message")`를 호출한다
- **THEN** 로그가 출력되지 않아야 한다

### Scenario: 환경 변수 기반 레벨 설정

- **GIVEN** `LOG_LEVEL=debug` 환경 변수가 설정되어 있다
- **WHEN** Logger를 초기화한다
- **THEN** 모든 레벨의 로그가 출력되어야 한다

## Requirement: REQ-002 - 구조화된 로그 출력

시스템은 JSON 형식의 구조화된 로그를 출력해야 한다(SHALL).

### Scenario: JSON 형식 출력

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `logger.info("Test message")`를 호출한다
- **THEN** 출력은 유효한 JSON 문자열이어야 한다

### Scenario: 필수 필드 포함

- **GIVEN** Logger로 로그를 출력한다
- **WHEN** 로그 출력을 파싱한다
- **THEN** `timestamp`, `level`, `message` 필드가 반드시 포함되어야 한다

### Scenario: 타임스탬프 형식

- **GIVEN** Logger로 로그를 출력한다
- **WHEN** `timestamp` 필드를 확인한다
- **THEN** ISO 8601 형식(`YYYY-MM-DDTHH:mm:ss.sssZ`)이어야 한다

### Scenario: 추가 컨텍스트 포함

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `logger.info("message", { issue_number: 123, path: "/tmp/worktree" })`를 호출한다
- **THEN** 로그에 `issue_number`와 `path` 필드가 포함되어야 한다

## Requirement: REQ-003 - 민감 정보 마스킹

시스템은 로그에서 민감 정보를 자동으로 마스킹해야 한다(SHALL).

### Scenario: API 토큰 마스킹

- **GIVEN** 로그 컨텍스트에 `token: "ghp_123456789"`이 포함되어 있다
- **WHEN** Logger로 로그를 출력한다
- **THEN** 출력된 로그의 `token` 필드는 `"***"`여야 한다

### Scenario: 비밀번호 마스킹

- **GIVEN** 로그 컨텍스트에 `password: "secret123"`이 포함되어 있다
- **WHEN** Logger로 로그를 출력한다
- **THEN** 출력된 로그의 `password` 필드는 `"***"`여야 한다

### Scenario: API 키 마스킹

- **GIVEN** 로그 컨텍스트에 `api_key: "sk-1234567890"`이 포함되어 있다
- **WHEN** Logger로 로그를 출력한다
- **THEN** 출력된 로그의 `api_key` 필드는 `"***"`여야 한다

### Scenario: 중첩 객체의 민감 정보 마스킹

- **GIVEN** 로그 컨텍스트에 `{ config: { github_token: "ghp_123" } }`이 포함되어 있다
- **WHEN** Logger로 로그를 출력한다
- **THEN** 출력된 로그의 `config.github_token` 필드는 `"***"`여야 한다

### Scenario: 커스텀 민감 필드 추가

- **GIVEN** Logger 설정에 `sensitive_fields: ["custom_secret"]`이 지정되어 있다
- **WHEN** 로그 컨텍스트에 `custom_secret: "value"`가 포함된 로그를 출력한다
- **THEN** `custom_secret` 필드는 `"***"`로 마스킹되어야 한다

## Requirement: REQ-004 - 컨텍스트 관리

시스템은 로그에 도메인별 컨텍스트를 추가할 수 있어야 한다(SHALL).

### Scenario: 기본 컨텍스트 설정

- **GIVEN** Logger를 생성할 때 `{ issue_number: 123 }`을 기본 컨텍스트로 설정한다
- **WHEN** `logger.info("message")`를 호출한다
- **THEN** 출력된 로그에 `issue_number: 123`이 포함되어야 한다

### Scenario: 동적 컨텍스트 추가

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `logger.info("message", { worktree_path: "/tmp/wt" })`를 호출한다
- **THEN** 출력된 로그에 `worktree_path` 필드가 포함되어야 한다

### Scenario: 컨텍스트 병합

- **GIVEN** Logger의 기본 컨텍스트가 `{ issue_number: 123 }`이다
- **WHEN** `logger.info("message", { branch: "fix-123" })`를 호출한다
- **THEN** 출력된 로그에 `issue_number`와 `branch` 모두 포함되어야 한다

### Scenario: 컨텍스트 덮어쓰기

- **GIVEN** Logger의 기본 컨텍스트가 `{ issue_number: 123 }`이다
- **WHEN** `logger.info("message", { issue_number: 456 })`를 호출한다
- **THEN** 출력된 로그의 `issue_number`는 `456`이어야 한다

### Scenario: Child Logger 생성

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `childLogger = logger.child({ component: "worktree" })`를 호출한다
- **THEN** Child Logger는 부모의 컨텍스트를 상속하고 `component` 필드가 추가되어야 한다

## Requirement: REQ-005 - 에러 로깅

시스템은 에러 객체를 로깅할 때 상세 정보를 포함해야 한다(SHALL).

### Scenario: 에러 스택 트레이스 포함

- **GIVEN** `Error` 객체가 있다
- **WHEN** `logger.error("Error occurred", { error })`를 호출한다
- **THEN** 로그에 `error.stack` 필드가 포함되어야 한다

### Scenario: 에러 메시지 추출

- **GIVEN** `Error` 객체가 있다
- **WHEN** `logger.error("Error occurred", { error })`를 호출한다
- **THEN** 로그에 `error.message` 필드가 포함되어야 한다

### Scenario: AutofixError 전용 처리

- **GIVEN** `AutofixError` 인스턴스가 있다
- **WHEN** `logger.error("Error occurred", { error })`를 호출한다
- **THEN** 로그에 `error.code`, `error.message`, `error.details` 필드가 포함되어야 한다

### Scenario: 중첩된 에러 로깅

- **GIVEN** `cause` 속성을 가진 에러가 있다
- **WHEN** `logger.error("Error occurred", { error })`를 호출한다
- **THEN** 로그에 `error.cause` 정보도 포함되어야 한다

## Requirement: REQ-006 - 성능 및 출력 최적화

시스템은 효율적인 로깅을 위해 최적화해야 한다(SHALL).

### Scenario: 조건부 로그 생성

- **GIVEN** Logger의 최소 레벨이 `warn`으로 설정되어 있다
- **WHEN** `logger.debug(() => expensiveOperation())`를 호출한다
- **THEN** `expensiveOperation()`이 실행되지 않아야 한다

### Scenario: 버퍼링 없는 출력

- **GIVEN** Logger로 로그를 출력한다
- **WHEN** `logger.info("message")`를 호출한다
- **THEN** 로그가 즉시 stdout/stderr로 출력되어야 한다

### Scenario: 테스트 환경에서 로그 비활성화

- **GIVEN** `NODE_ENV=test` 환경 변수가 설정되어 있다
- **WHEN** Logger를 초기화한다
- **THEN** 로그가 출력되지 않아야 한다 (또는 메모리 버퍼에만 저장)

### Scenario: 대용량 객체 로깅 제한

- **GIVEN** 매우 큰 객체를 로그 컨텍스트로 전달한다
- **WHEN** Logger로 로그를 출력한다
- **THEN** 객체가 적절히 잘리거나 요약되어 출력되어야 한다

## Requirement: REQ-007 - 출력 대상 설정

시스템은 로그 레벨에 따라 적절한 출력 스트림을 사용해야 한다(SHALL).

### Scenario: info/debug는 stdout

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `logger.info("message")`를 호출한다
- **THEN** 로그는 `stdout`으로 출력되어야 한다

### Scenario: warn/error는 stderr

- **GIVEN** Logger 인스턴스가 있다
- **WHEN** `logger.error("error message")`를 호출한다
- **THEN** 로그는 `stderr`로 출력되어야 한다

### Scenario: 커스텀 출력 스트림

- **GIVEN** Logger를 생성할 때 `output: fileStream`을 지정한다
- **WHEN** 로그를 출력한다
- **THEN** 로그는 지정된 파일 스트림으로 출력되어야 한다

## Requirement: REQ-008 - 타입 안전성

시스템은 TypeScript 타입 시스템을 활용하여 로그 사용을 안전하게 해야 한다(SHALL).

### Scenario: 로그 레벨 타입

- **GIVEN** `LogLevel` 타입이 정의되어 있다
- **WHEN** 잘못된 로그 레벨을 사용한다
- **THEN** TypeScript 컴파일 에러가 발생해야 한다

### Scenario: 컨텍스트 타입

- **GIVEN** `LogContext` 타입이 정의되어 있다
- **WHEN** 컨텍스트에 허용되지 않는 타입의 값을 전달한다
- **THEN** TypeScript 컴파일 에러가 발생해야 한다

### Scenario: Logger 인터페이스

- **GIVEN** `ILogger` 인터페이스가 정의되어 있다
- **WHEN** 다른 구현체를 주입한다
- **THEN** 인터페이스 계약을 준수하는지 컴파일 타임에 검증되어야 한다

## Requirement: REQ-009 - 테스트 지원

시스템은 테스트 환경에서 로그를 쉽게 검증할 수 있어야 한다(SHALL).

### Scenario: 메모리 로거

- **GIVEN** `MemoryLogger` 인스턴스를 생성한다
- **WHEN** `logger.info("test message")`를 호출한다
- **THEN** `logger.getLogs()` 메서드로 저장된 로그를 확인할 수 있어야 한다

### Scenario: 로그 카운트 확인

- **GIVEN** `MemoryLogger` 인스턴스가 있다
- **WHEN** 여러 로그를 출력한다
- **THEN** `logger.getLogCount()` 메서드로 출력된 로그 수를 확인할 수 있어야 한다

### Scenario: 로그 초기화

- **GIVEN** `MemoryLogger`에 여러 로그가 저장되어 있다
- **WHEN** `logger.clear()`를 호출한다
- **THEN** 저장된 로그가 모두 삭제되어야 한다

### Scenario: 로그 필터링

- **GIVEN** `MemoryLogger`에 다양한 레벨의 로그가 저장되어 있다
- **WHEN** `logger.getLogsByLevel("error")`를 호출한다
- **THEN** `error` 레벨의 로그만 반환되어야 한다

## Requirement: REQ-010 - 전역 Logger 인스턴스

시스템은 전역에서 사용 가능한 기본 Logger를 제공해야 한다(SHALL).

### Scenario: 싱글톤 Logger

- **GIVEN** `logger` 모듈을 import한다
- **WHEN** `logger.info("message")`를 호출한다
- **THEN** 전역 설정이 적용된 Logger로 로그가 출력되어야 한다

### Scenario: Logger 재설정

- **GIVEN** 전역 Logger가 초기화되어 있다
- **WHEN** `setLogger(customLogger)`를 호출한다
- **THEN** 이후 모든 로그는 `customLogger`를 사용해야 한다

### Scenario: 기본 설정 병합

- **GIVEN** 전역 Logger가 기본 설정으로 초기화되어 있다
- **WHEN** `setLoggerConfig({ level: "debug" })`를 호출한다
- **THEN** 기존 설정과 병합되고 `level`만 업데이트되어야 한다
