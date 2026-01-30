---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: common
feature: issue-parser
depends: null
---

# Issue Parser

> GitHub Issue 템플릿의 마크다운 본문을 파싱하여 구조화된 데이터를 추출한다.

## Requirement: REQ-001 - Context 섹션 파싱

시스템은 Issue 본문의 Context 섹션을 파싱하여 코드 위치 정보를 추출해야 한다(SHALL).

### Scenario: 파일 경로 추출

- **GIVEN** Issue 본문에 `**파일**: \`src/components/Editor.tsx\``가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `context.file` 값은 `"src/components/Editor.tsx"`여야 한다

### Scenario: 함수/클래스 이름 추출

- **GIVEN** Issue 본문에 `**함수/클래스**: \`handleSave()\``가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `context.function` 값은 `"handleSave()"`여야 한다

### Scenario: 라인 번호 추출

- **GIVEN** Issue 본문에 `**라인**: 142-156`이 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `context.line` 값은 `"142-156"`여야 한다

### Scenario: 컴포넌트 이름 추출

- **GIVEN** Issue 본문에 `**컴포넌트**: \`canvas-core\``가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `context.component` 값은 `"canvas-core"`여야 한다

### Scenario: Context 정보 누락

- **GIVEN** Issue 본문에 Context 섹션이 없거나 불완전하다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 누락된 필드는 `undefined` 또는 빈 문자열이어야 한다

## Requirement: REQ-002 - Code Analysis 섹션 파싱

시스템은 Issue 본문의 Code Analysis 섹션을 파싱하여 코드 스니펫을 추출해야 한다(SHALL).

### Scenario: 코드 블록 추출

- **GIVEN** Issue 본문에 Code Analysis 섹션 아래 ` ```typescript ... ``` ` 코드 블록이 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `codeAnalysis.snippet` 필드에 코드가 포함되어야 한다

### Scenario: 언어 정보 추출

- **GIVEN** 코드 블록이 ` ```typescript `로 시작한다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `codeAnalysis.language` 값은 `"typescript"`여야 한다

### Scenario: Code Analysis 섹션 누락

- **GIVEN** Issue 본문에 Code Analysis 섹션이 없다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `codeAnalysis` 필드는 `undefined` 또는 빈 객체여야 한다

## Requirement: REQ-003 - Source 정보 파싱

시스템은 Issue 본문의 Source 섹션을 파싱하여 이슈 출처를 식별해야 한다(SHALL).

### Scenario: Sentry 출처 파싱

- **GIVEN** Issue 본문에 `**Origin**: Sentry`가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `source.origin` 값은 `"Sentry"`여야 한다

### Scenario: Asana 출처 파싱

- **GIVEN** Issue 본문에 `**Origin**: Asana`와 `**Reference**: [Asana Task #12345](...)`이 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `source.origin`은 `"Asana"`이고 `source.reference`는 Asana 링크여야 한다

### Scenario: Direct 출처

- **GIVEN** Issue 본문에 Source 섹션이 없거나 `**Origin**: Direct`가 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `source.origin` 값은 `"Direct"`여야 한다

## Requirement: REQ-004 - Type 정보 파싱

시스템은 Issue 본문의 Type 섹션을 파싱하여 이슈 유형을 식별해야 한다(SHALL).

### Scenario: Sentry Error 타입

- **GIVEN** Issue 본문에 `- [x] 🔴 Sentry Error`가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `type` 값은 `"error"`여야 한다

### Scenario: Bug Report 타입

- **GIVEN** Issue 본문에 `- [x] 🐛 Bug Report`가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `type` 값은 `"bug"`여야 한다

### Scenario: Feature Request 타입

- **GIVEN** Issue 본문에 `- [x] ✨ Feature Request`가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 반환된 객체의 `type` 값은 `"feature"`여야 한다

### Scenario: Type 정보 누락

- **GIVEN** Issue 본문에 체크된 Type이 없다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `type` 값은 `"unknown"` 또는 `undefined`여야 한다

## Requirement: REQ-005 - Problem Description 파싱

시스템은 Problem Description 섹션에서 문제 설명과 에러 메시지를 추출해야 한다(SHALL).

### Scenario: 에러 메시지 추출

- **GIVEN** Problem Description 섹션에 코드 블록이 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `problemDescription.error` 필드에 에러 메시지가 포함되어야 한다

### Scenario: 발생 조건 추출

- **GIVEN** Issue 본문에 `**발생 조건**: 새 문서를 처음 저장할 때`가 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `problemDescription.condition` 값은 `"새 문서를 처음 저장할 때"`여야 한다

### Scenario: 재현 빈도 추출

- **GIVEN** Issue 본문에 `**재현 빈도**: 항상`이 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `problemDescription.frequency` 값은 `"항상"`이어야 한다

## Requirement: REQ-006 - Suggested Fix Direction 파싱

시스템은 Suggested Fix Direction 섹션을 파싱하여 수정 힌트를 추출해야 한다(SHALL).

### Scenario: 수정 방향 목록 추출

- **GIVEN** Suggested Fix Direction 섹션에 여러 개의 불릿 포인트가 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `suggestedFix` 필드는 각 항목을 포함한 배열이어야 한다

### Scenario: 참고 코드 위치 추출

- **GIVEN** 수정 힌트에 `참고: \`src/utils/helper.ts:45\``가 포함되어 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 해당 참고 위치가 `suggestedFix.references` 배열에 포함되어야 한다

### Scenario: Suggested Fix 누락

- **GIVEN** Issue 본문에 Suggested Fix Direction 섹션이 없다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `suggestedFix` 필드는 빈 배열이어야 한다

## Requirement: REQ-007 - Acceptance Criteria 파싱

시스템은 Acceptance Criteria 섹션을 파싱하여 완료 조건 체크리스트를 추출해야 한다(SHALL).

### Scenario: 체크리스트 항목 추출

- **GIVEN** Acceptance Criteria 섹션에 `- [ ] 에러가 더 이상 발생하지 않음` 항목이 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `acceptanceCriteria` 배열에 해당 항목이 포함되어야 한다

### Scenario: 완료 상태 파싱

- **GIVEN** 체크리스트에 `- [x]` (체크됨)와 `- [ ]` (체크 안됨) 항목이 있다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 각 항목의 `checked` 필드가 올바르게 `true`/`false`로 설정되어야 한다

## Requirement: REQ-008 - 파싱 에러 처리

시스템은 파싱 중 발생하는 에러를 적절히 처리해야 한다(SHALL).

### Scenario: 빈 본문 처리

- **GIVEN** Issue 본문이 빈 문자열이다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** `IssueParseError` 에러를 던지거나 모든 필드가 비어있는 객체를 반환해야 한다

### Scenario: 잘못된 마크다운 형식

- **GIVEN** Issue 본문이 예상 템플릿 형식과 다르다
- **WHEN** `parseIssue()` 함수를 호출한다
- **THEN** 파싱 가능한 부분만 추출하고 나머지는 기본값으로 채워야 한다

### Scenario: 파싱 결과 검증

- **GIVEN** Issue 본문을 파싱했다
- **WHEN** 필수 필드(예: `context.component`)가 누락되었다
- **THEN** 경고 로그를 출력하거나 `warnings` 배열에 누락 정보를 포함해야 한다
