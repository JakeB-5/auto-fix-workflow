---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: asana
feature: analyze-task
depends: "common/types, asana/get-task"
---

# Analyze Asana Task

> Asana 태스크를 분석하여 GitHub Issue로 변환 가능 여부를 판단하고, 성공 시 Issue 템플릿을 생성하는 Tool

## Requirement: REQ-001 - 태스크 분석 가능 여부 판단

Tool은 태스크의 내용을 분석하여 자동 수정 대상으로 적합한지 판단해야 한다.

### Scenario: 명확한 버그 리포트

- **GIVEN** 태스크 설명에 다음이 포함되어 있고:
  - 명확한 재현 단계
  - 에러 메시지 또는 스크린샷
  - 기대 동작과 실제 동작의 차이
- **WHEN** `analyze_asana_task`를 호출하면
- **THEN** `analysis_result: "success"`를 반환해야 한다
- **AND** GitHub Issue 템플릿을 생성해야 한다

### Scenario: 정보 부족

- **GIVEN** 태스크 설명이 "앱이 느려요"처럼 모호하고
- **AND** 구체적인 재현 단계나 에러 정보가 없고
- **WHEN** Tool이 실행되면
- **THEN** `analysis_result: "needs-more-info"`를 반환해야 한다
- **AND** 필요한 정보 목록을 제공해야 한다

### Scenario: 재현 불가

- **GIVEN** 재현 단계가 불명확하거나 일관성이 없고
- **WHEN** Tool이 실행되면
- **THEN** `analysis_result: "cannot-reproduce"`를 반환해야 한다
- **AND** 재현 단계 상세화 요청 메시지를 생성해야 한다

### Scenario: 요구사항 불명확

- **GIVEN** 태스크가 기능 요청이지만 기대 동작이 불명확하고
- **WHEN** Tool이 실행되면
- **THEN** `analysis_result: "unclear-requirement"`를 반환해야 한다
- **AND** 명확화가 필요한 항목을 나열해야 한다

## Requirement: REQ-002 - 코드베이스 매핑

Tool은 태스크 내용을 기반으로 관련 코드 위치를 찾아야 한다.

### Scenario: 에러 메시지 기반 탐색

- **GIVEN** 태스크에 "handleSave에서 TypeError 발생" 에러가 포함되어 있고
- **WHEN** Tool이 코드베이스를 탐색하면
- **THEN** `src/components/Editor.tsx`의 `handleSave` 함수를 찾아야 한다
- **AND** 관련 파일 경로와 라인 번호를 반환해야 한다

### Scenario: 기능명 기반 탐색

- **GIVEN** 태스크가 "저장 버튼 클릭 시 문제"를 언급하고
- **WHEN** Tool이 코드베이스를 탐색하면
- **THEN** 저장 관련 컴포넌트와 함수를 찾아야 한다
- **AND** 컴포넌트 분류(예: "editor")를 추론해야 한다

### Scenario: 코드 위치 불명

- **GIVEN** 태스크 설명이 너무 일반적이고
- **AND** 코드베이스에서 관련 파일을 특정할 수 없고
- **WHEN** Tool이 실행되면
- **THEN** `analysis_result: "needs-context"`를 반환해야 한다
- **AND** 발생 화면/기능 명시 요청 메시지를 생성해야 한다

## Requirement: REQ-003 - GitHub Issue 템플릿 생성

분석 성공 시, Tool은 GitHub Issue 템플릿을 자동 생성해야 한다.

### Scenario: 버그 리포트 템플릿

- **GIVEN** 태스크 분석이 성공하고
- **AND** 버그로 분류되고
- **WHEN** Tool이 Issue 템플릿을 생성하면
- **THEN** 다음 섹션이 모두 채워져야 한다:
  - Type: Bug Report 체크
  - Source: Asana + 태스크 링크
  - Context: 파일/함수/컴포넌트
  - Problem Description: 에러 및 재현 조건
  - Code Analysis: 문제 코드 스니펫
  - Suggested Fix Direction: 수정 방향 제안

### Scenario: 간단한 기능 요청 템플릿

- **GIVEN** 태스크가 간단한 기능 추가 요청이고
- **WHEN** Tool이 Issue 템플릿을 생성하면
- **THEN** Type: Feature Request를 체크해야 한다
- **AND** 구현 방향과 참고 코드를 제시해야 한다

## Requirement: REQ-004 - 분석 실패 처리

분석 실패 시, Tool은 Asana 업데이트를 위한 정보를 제공해야 한다.

### Scenario: needs-more-info 케이스

- **GIVEN** 분석 결과가 `needs-more-info`이고
- **WHEN** Tool이 완료되면
- **THEN** 다음을 반환해야 한다:
  - `suggested_tag: "needs-more-info"`
  - `comment_template`: 구조화된 정보 요청 메시지
  - `missing_items`: 부족한 정보 항목 목록

### Scenario: cannot-reproduce 케이스

- **GIVEN** 분석 결과가 `cannot-reproduce`이고
- **WHEN** Tool이 완료되면
- **THEN** 다음을 반환해야 한다:
  - `suggested_tag: "cannot-reproduce"`
  - `comment_template`: 재현 단계 상세화 요청
  - `questions`: 명확화가 필요한 질문 목록

### Scenario: unclear-requirement 케이스

- **GIVEN** 분석 결과가 `unclear-requirement`이고
- **WHEN** Tool이 완료되면
- **THEN** 다음을 반환해야 한다:
  - `suggested_tag: "unclear-requirement"`
  - `comment_template`: 기대 동작 명확화 요청
  - `clarifications`: 명확화가 필요한 항목들

### Scenario: needs-context 케이스

- **GIVEN** 분석 결과가 `needs-context`이고
- **WHEN** Tool이 완료되면
- **THEN** 다음을 반환해야 한다:
  - `suggested_tag: "needs-context"`
  - `comment_template`: 발생 위치 명시 요청
  - `context_questions`: 컨텍스트 확보 질문들

## Requirement: REQ-005 - 응답 형식

Tool은 일관된 분석 결과를 반환해야 한다.

### Scenario: 분석 성공

- **GIVEN** 태스크 분석이 성공하고
- **WHEN** Tool이 완료되면
- **THEN** 다음 구조를 반환해야 한다:

```typescript
{
  analysis_result: "success";
  confidence: number;              // 0-100, 분석 신뢰도
  github_issue: {
    title: string;
    body: string;                  // Markdown 형식의 전체 템플릿
    labels: string[];              // ["auto-fix", "asana", "bug", "component:xxx"]
  };
  code_context: {
    files: string[];               // 관련 파일 경로
    component: string;             // 컴포넌트 분류
    functions?: string[];          // 관련 함수명
  };
  asana_update: {
    tag: "triaged";
    comment: string;               // GitHub Issue 링크 포함 메시지
    section: "Triaged";
  };
}
```

### Scenario: 분석 실패

- **GIVEN** 태스크 분석이 실패하고
- **WHEN** Tool이 완료되면
- **THEN** 다음 구조를 반환해야 한다:

```typescript
{
  analysis_result: "needs-more-info" | "cannot-reproduce" | "unclear-requirement" | "needs-context";
  reason: string;                  // 실패 이유 설명
  asana_update: {
    tag: string;                   // 해당하는 실패 태그
    comment: string;               // 구조화된 보충 요청 메시지
    section: "Needs More Info";
  };
  missing_information?: {
    required: string[];            // 필수 정보 목록
    suggested: string[];           // 있으면 좋은 정보 목록
  };
}
```

## Requirement: REQ-006 - 코멘트 템플릿

Tool은 분석 결과에 따라 적절한 코멘트 템플릿을 생성해야 한다.

### Scenario: 분석 성공 코멘트

- **GIVEN** GitHub Issue가 생성되고
- **WHEN** Asana 업데이트 코멘트를 생성하면
- **THEN** 다음 형식이어야 한다:

```markdown
🤖 자동 분석 완료

✅ GitHub Issue 생성됨: [#123](https://github.com/org/repo/issues/123)

**분석 결과:**
- 타입: Bug Report
- 컴포넌트: editor
- 관련 파일: `src/components/Editor.tsx`

이 이슈는 자동 수정 워크플로우로 처리됩니다.
```

### Scenario: needs-more-info 코멘트

- **GIVEN** 정보가 부족하여 분석 실패하고
- **WHEN** Asana 업데이트 코멘트를 생성하면
- **THEN** 다음 형식이어야 한다:

```markdown
🤖 자동 분석 결과, 추가 정보가 필요합니다

다음 정보를 보충해주시면 분석을 다시 시도합니다:

**필수 정보:**
- [ ] 정확한 재현 단계 (1, 2, 3...)
- [ ] 에러 메시지 전문 또는 스크린샷
- [ ] 발생 빈도 (항상 / 간헐적)

**선택 정보 (있으면 더 좋음):**
- [ ] 브라우저 개발자 도구 콘솔 내용
- [ ] 발생하는 화면/기능명
- [ ] 최근 변경된 사항
```

## Parameters

```typescript
interface AnalyzeAsanaTaskParams {
  task_id: string;                    // REQUIRED: Asana 태스크 ID
  codebase_path?: string;             // 코드베이스 경로 (기본: 현재 디렉토리)
  search_depth?: number;              // 코드 탐색 깊이 (기본: 3)
  confidence_threshold?: number;      // 성공 판정 신뢰도 임계값 (기본: 70)
}
```

## Implementation Notes

- MUST use `get_asana_task` Tool to fetch task details first
- SHOULD use code search tools (Grep, Glob) to locate relevant files
- MUST apply heuristics to extract:
  - Error messages from task description
  - File paths or function names mentioned
  - Keywords indicating component (e.g., "save" → editor)
- SHOULD use AI reasoning to:
  - Assess reproduction clarity
  - Infer code locations from natural language
  - Generate structured GitHub Issue template
- MUST handle edge cases:
  - Tasks with attachments only (analyze image content)
  - Tasks with multiple issues (suggest splitting)
  - Tasks in non-English (translate or flag)
- SHOULD cache analysis results to avoid redundant processing
- MUST sanitize all outputs to prevent injection attacks
