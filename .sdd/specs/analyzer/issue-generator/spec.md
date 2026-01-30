---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: analyzer
feature: issue-generator
depends: "common/types, analyzer/task-analyzer, analyzer/code-locator"
---

# Issue Generator

> task-analyzer와 code-locator의 분석 결과를 GitHub Issue 템플릿 형식으로 변환하는 컴포넌트

## Requirement: REQ-001 - GitHub Issue 템플릿 생성

시스템은 분석 결과를 GitHub Issue 템플릿 형식으로 변환해야 한다(SHALL).

### Scenario: 완전한 분석 결과를 Issue로 변환

- **GIVEN** task-analyzer에서 `confidence: "high"` 결과가 반환됨
- **AND** code-locator에서 정확한 파일 위치가 식별됨
- **WHEN** issue-generator가 GitHub Issue를 생성할 때
- **THEN** 다음 구조의 Issue body가 생성되어야 함
  ```markdown
  ## 🤖 Auto-Fix Issue

  ### Type
  - [x] 🐛 Bug Report

  ### Source
  - **Origin**: Asana
  - **Reference**: [Asana Task #12345](https://app.asana.com/...)

  ### Context
  - **파일**: `src/components/Editor.tsx`
  - **함수/클래스**: `handleSave()`
  - **라인**: 142-156
  - **컴포넌트**: `editor`

  ### Problem Description
  ...

  ### Code Analysis
  ```typescript
  ...
  ```

  ### Suggested Fix Direction
  ...

  ### Acceptance Criteria
  - [ ] ...
  ```

### Scenario: 부분 정보만 있는 경우

- **GIVEN** code-locator가 파일은 찾았지만 정확한 함수를 특정하지 못함
- **WHEN** issue-generator가 GitHub Issue를 생성할 때
- **THEN** Context 섹션에 식별된 정보만 포함해야 함
  ```markdown
  ### Context
  - **파일**: `src/components/Editor.tsx`
  - **컴포넌트**: `editor`
  ```
- **AND** 누락된 정보는 빈 값으로 남겨두지 말고 해당 필드를 생략해야 함

## Requirement: REQ-002 - Type 자동 판단

### Scenario: Sentry 에러인 경우

- **GIVEN** 분석 대상이 Sentry에서 온 에러임
- **WHEN** issue-generator가 Type을 결정할 때
- **THEN** `- [x] 🔴 Sentry Error`가 체크되어야 함

### Scenario: Asana 버그 리포트인 경우

- **GIVEN** 분석 대상이 Asana 태스크이고 에러가 포함됨
- **WHEN** issue-generator가 Type을 결정할 때
- **THEN** `- [x] 🐛 Bug Report`가 체크되어야 함

### Scenario: 기능 요청인 경우

- **GIVEN** 분석 대상에 에러가 없고 개선 제안만 있음
- **WHEN** issue-generator가 Type을 결정할 때
- **THEN** `- [x] ✨ Feature Request`가 체크되어야 함

## Requirement: REQ-003 - Context 섹션 자동 채우기

### Scenario: 코드 위치가 명확한 경우

- **GIVEN** code-locator가 다음 정보를 반환함
  ```typescript
  {
    file: "src/components/Editor.tsx",
    function_name: "handleSave",
    start_line: 142,
    end_line: 156,
    component_label: "editor"
  }
  ```
- **WHEN** issue-generator가 Context를 생성할 때
- **THEN** 다음 내용이 포함되어야 함
  ```markdown
  ### Context
  - **파일**: `src/components/Editor.tsx`
  - **함수/클래스**: `handleSave()`
  - **라인**: 142-156
  - **컴포넌트**: `editor`
  ```

### Scenario: 여러 파일이 관련된 경우

- **GIVEN** code-locator가 2개 이상의 관련 파일을 반환함
- **WHEN** issue-generator가 Context를 생성할 때
- **THEN** 주 파일은 파일 필드에, 나머지는 Related Files로 표시해야 함
  ```markdown
  ### Context
  - **파일**: `src/components/Editor.tsx` (primary)
  - **관련 파일**:
    - `src/components/SaveButton.tsx`
    - `src/api/document.ts`
  - **컴포넌트**: `editor`
  ```

## Requirement: REQ-004 - Code Analysis 섹션 생성

### Scenario: 스택트레이스가 있는 경우

- **GIVEN** 에러에 스택트레이스가 포함됨
- **WHEN** issue-generator가 Code Analysis를 생성할 때
- **THEN** 에러 발생 지점의 코드 스니펫을 포함해야 함
  ```markdown
  ### Code Analysis
  ```typescript
  // 현재 코드 (문제)
  const handleSave = () => {
    const id = document.id;  // document가 undefined일 수 있음
    api.save(id, data);
  };
  ```
  ```

### Scenario: 코드 파일을 읽을 수 있는 경우

- **GIVEN** code-locator가 파일 경로와 라인 범위를 반환함
- **WHEN** issue-generator가 Code Analysis를 생성할 때
- **THEN** 해당 라인의 실제 코드를 Read 도구로 읽어야 함
- **AND** 컨텍스트를 위해 앞뒤 2줄씩 포함해야 함

### Scenario: 코드를 읽을 수 없는 경우

- **GIVEN** 파일이 존재하지 않거나 접근 불가
- **WHEN** issue-generator가 Code Analysis를 생성할 때
- **THEN** 에러 메시지에 포함된 코드 스니펫만 사용해야 함
- **OR** 스니펫도 없으면 섹션을 생략해야 함

## Requirement: REQ-005 - Suggested Fix Direction 생성

### Scenario: 일반적인 null 체크 에러

- **GIVEN** 에러 메시지가 `Cannot read property 'id' of undefined`임
- **WHEN** issue-generator가 수정 방향을 제안할 때
- **THEN** 다음과 같은 제안을 포함해야 함
  ```markdown
  ### Suggested Fix Direction
  - `document` 객체 존재 여부 체크 필요
  - Optional chaining (`document?.id`) 사용 고려
  - 또는 기본값 설정 (`document || {}`)
  ```

### Scenario: 분석에서 유사 패턴을 찾은 경우

- **GIVEN** task-analyzer가 `"참고: src/utils/documentHelper.ts:45의 패턴"` 힌트를 제공함
- **WHEN** issue-generator가 수정 방향을 제안할 때
- **THEN** 참조 파일을 포함해야 함
  ```markdown
  ### Suggested Fix Direction
  - 참고: `src/utils/documentHelper.ts:45`의 패턴 적용 고려
  ```

### Scenario: 수정 방향 힌트가 없는 경우

- **GIVEN** 분석 결과에 수정 힌트가 전혀 없음
- **WHEN** issue-generator가 Issue를 생성할 때
- **THEN** Suggested Fix Direction 섹션을 생략해야 함

## Requirement: REQ-006 - Acceptance Criteria 자동 생성

### Scenario: 버그 수정의 경우

- **GIVEN** Issue Type이 Bug Report 또는 Sentry Error임
- **WHEN** issue-generator가 Acceptance Criteria를 생성할 때
- **THEN** 다음 기본 항목이 포함되어야 함
  ```markdown
  ### Acceptance Criteria
  - [ ] 에러가 더 이상 발생하지 않음
  - [ ] 기존 테스트 모두 통과
  - [ ] 재현 시나리오에서 정상 동작
  ```

### Scenario: 재현 시나리오가 명확한 경우

- **GIVEN** task-analyzer가 재현 단계를 식별함
  - "새 문서 저장 시 에러"
- **WHEN** issue-generator가 Acceptance Criteria를 생성할 때
- **THEN** 재현 시나리오를 Criteria로 추가해야 함
  ```markdown
  ### Acceptance Criteria
  - [ ] 에러가 더 이상 발생하지 않음
  - [ ] 기존 테스트 모두 통과
  - [ ] 새 문서 저장 정상 동작
  - [ ] 기존 문서 저장 정상 동작
  ```

### Scenario: 기능 요청인 경우

- **GIVEN** Issue Type이 Feature Request임
- **WHEN** issue-generator가 Acceptance Criteria를 생성할 때
- **THEN** 기능 완료 조건을 포함해야 함
  ```markdown
  ### Acceptance Criteria
  - [ ] 요청된 기능 구현 완료
  - [ ] 기존 기능에 영향 없음
  - [ ] 테스트 코드 추가
  ```

## Requirement: REQ-007 - Labels 자동 설정

### Scenario: 기본 라벨

- **GIVEN** issue-generator가 GitHub Issue를 생성함
- **WHEN** Issue를 생성할 때
- **THEN** 항상 `auto-fix` 라벨이 포함되어야 함

### Scenario: 소스별 라벨

- **GIVEN** Issue 소스가 Sentry임
- **WHEN** Labels를 설정할 때
- **THEN** `auto-fix`, `sentry` 라벨이 포함되어야 함

- **GIVEN** Issue 소스가 Asana임
- **THEN** `auto-fix`, `asana` 라벨이 포함되어야 함

### Scenario: 컴포넌트 라벨

- **GIVEN** code-locator가 `component: "canvas-core"`를 반환함
- **WHEN** Labels를 설정할 때
- **THEN** `component:canvas-core` 라벨이 추가되어야 함

### Scenario: 우선순위 라벨

- **GIVEN** Asana 태스크에 `Priority: High` 커스텀 필드가 있음
- **WHEN** Labels를 설정할 때
- **THEN** `priority:high` 라벨이 추가되어야 함

## Requirement: REQ-008 - Related Issues 링크

### Scenario: 유사 이슈가 있는 경우

- **GIVEN** task-analyzer가 유사 이슈 `#120`, `#118`을 식별함
- **WHEN** issue-generator가 Related Issues를 생성할 때
- **THEN** 다음 내용이 포함되어야 함
  ```markdown
  ### Related Issues
  - #120 - 유사한 null 체크 이슈
  - #118 - 같은 컴포넌트 관련
  ```

### Scenario: 관련 이슈가 없는 경우

- **GIVEN** 유사 이슈가 식별되지 않음
- **WHEN** issue-generator가 Issue를 생성할 때
- **THEN** Related Issues 섹션을 생략해야 함

## Requirement: REQ-009 - Issue Title 생성

### Scenario: Sentry 에러의 경우

- **GIVEN** Sentry 에러 타입이 `TypeError`이고 메시지가 `Cannot read property 'id' of undefined`임
- **WHEN** issue-generator가 Title을 생성할 때
- **THEN** `[Sentry] TypeError: Cannot read property 'id' of undefined` 형식이어야 함

### Scenario: Asana 버그의 경우

- **GIVEN** Asana 태스크 제목이 "저장 버튼 클릭 시 에러 발생"임
- **WHEN** issue-generator가 Title을 생성할 때
- **THEN** `[Asana] 저장 버튼 클릭 시 에러 발생` 형식이어야 함

### Scenario: 파일 위치 추가

- **GIVEN** code-locator가 주 파일을 `Editor.tsx`로 식별함
- **WHEN** issue-generator가 Title을 생성할 때
- **THEN** 파일명을 괄호로 추가할 수 있음
  - `[Sentry] TypeError in Editor.tsx`

## Requirement: REQ-010 - 검증 및 에러 처리

### Scenario: 필수 정보가 누락된 경우

- **GIVEN** task-analyzer 결과에 `can_auto_convert: false`가 설정됨
- **WHEN** issue-generator가 Issue 생성을 시도할 때
- **THEN** `InsufficientDataError` 예외를 throw해야 함
- **AND** 누락된 정보 목록을 포함해야 함

### Scenario: GitHub API 호출 실패

- **GIVEN** GitHub Issue 생성 API가 실패함
- **WHEN** issue-generator가 처리할 때
- **THEN** 적절한 에러 메시지와 함께 예외를 throw해야 함
- **AND** Asana 태스크에 실패 코멘트를 남겨야 함

## Data Types

```typescript
interface IssueTemplate {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
}

interface IssueGenerationInput {
  source: "sentry" | "asana" | "direct";
  task_analysis?: TaskAnalysisResult;
  code_location?: CodeSearchResult;
  raw_data: {
    title?: string;
    description: string;
    error_message?: string;
    stack_trace?: string;
    reference_url?: string;
    priority?: "high" | "medium" | "low";
    custom_fields?: Record<string, any>;
  };
}

interface IssueGenerationResult {
  success: boolean;
  issue_number?: number;
  issue_url?: string;
  template: IssueTemplate;
  errors?: string[];
}
```

## Implementation Notes

1. **코드 스니펫 추출**
   - Read 도구로 파일 읽기
   - 에러 라인 기준 앞뒤 5줄씩 추출
   - 들여쓰기 유지, 라인 번호 주석 추가

2. **마크다운 이스케이프**
   - 코드 블록 내부는 이스케이프 불필요
   - 설명 텍스트의 `*`, `_`, `[` 등은 이스케이프

3. **라벨 정규화**
   - 컴포넌트 라벨: `component:` 접두사
   - 우선순위 라벨: `priority:` 접두사
   - 공백을 `-`로 치환 (예: `canvas core` → `canvas-core`)

4. **수정 방향 패턴 매칭**
   - `Cannot read property` → null/undefined 체크 제안
   - `is not a function` → 함수 존재 여부 체크 제안
   - `Maximum call stack` → 재귀 종료 조건 체크 제안

5. **템플릿 검증**
   - Title: 최대 256자
   - Body: 최대 65536자
   - Labels: 최대 100개
   - 각 Label: 최대 50자

## Related Specs

- [common/types](../../common/types/spec.md) - 공통 타입 정의
- [analyzer/task-analyzer](../task-analyzer/spec.md) - 태스크 분석
- [analyzer/code-locator](../code-locator/spec.md) - 코드 위치 탐색
- [github/create-issue](../../github/create-issue/spec.md) - GitHub Issue 생성 API
