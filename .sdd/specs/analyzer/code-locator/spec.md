---
status: draft
created: 2026-01-30
domain: analyzer
feature: code-locator
depends: [common/types]
---

# Code Locator

> 에러 메시지, 스택트레이스, 텍스트 설명으로부터 관련 코드 파일과 함수를 탐색하는 컴포넌트

## Requirement: REQ-001 - 스택트레이스 파싱

### Scenario: JavaScript/TypeScript 스택트레이스

- **GIVEN** 다음 형식의 스택트레이스가 입력됨
  ```
  TypeError: Cannot read property 'id' of undefined
      at handleSave (Editor.tsx:145)
      at onClick (SaveButton.tsx:23)
      at callCallback (react-dom.js:3945)
  ```
- **WHEN** code-locator가 스택트레이스를 파싱할 때
- **THEN** 다음 정보가 추출되어야 함
  ```typescript
  {
    frames: [
      { file: "Editor.tsx", function: "handleSave", line: 145 },
      { file: "SaveButton.tsx", function: "onClick", line: 23 },
      { file: "react-dom.js", function: "callCallback", line: 3945 }
    ],
    primary_file: "Editor.tsx",  // 첫 번째 프로젝트 파일
    primary_function: "handleSave",
    primary_line: 145
  }
  ```

### Scenario: Python 스택트레이스

- **GIVEN** 다음 형식의 스택트레이스가 입력됨
  ```
  Traceback (most recent call last):
    File "app.py", line 42, in process_data
      result = transform(data)
    File "utils.py", line 15, in transform
      return data['key']
  KeyError: 'key'
  ```
- **WHEN** code-locator가 스택트레이스를 파싱할 때
- **THEN** 다음 정보가 추출되어야 함
  ```typescript
  {
    frames: [
      { file: "app.py", function: "process_data", line: 42 },
      { file: "utils.py", function: "transform", line: 15 }
    ],
    primary_file: "app.py",
    primary_function: "process_data",
    primary_line: 42
  }
  ```

### Scenario: Node.js 모듈 경로가 포함된 스택트레이스

- **GIVEN** 스택트레이스에 절대 경로가 포함됨
  ```
  at /Users/dev/project/src/components/Editor.tsx:145:23
  ```
- **WHEN** code-locator가 파일 경로를 추출할 때
- **THEN** 프로젝트 루트 기준 상대 경로로 정규화되어야 함
  ```
  src/components/Editor.tsx
  ```

## Requirement: REQ-002 - 파일 탐색

### Scenario: 정확한 파일 경로가 있는 경우

- **GIVEN** 스택트레이스에서 `src/components/Editor.tsx` 경로가 추출됨
- **WHEN** code-locator가 파일을 조회할 때
- **THEN** 해당 파일이 존재하면 절대 경로로 반환되어야 함
- **AND** 파일이 없으면 `file_exists: false`로 표시되어야 함

### Scenario: 파일명만 있고 경로가 없는 경우

- **GIVEN** 에러 메시지에 `Editor.tsx`만 언급됨 (경로 없음)
- **WHEN** code-locator가 파일을 검색할 때
- **THEN** 프로젝트 전체에서 `Editor.tsx` 파일을 검색해야 함
- **AND** 여러 개 발견되면 모든 후보를 반환해야 함
  ```typescript
  {
    matches: [
      "src/components/Editor.tsx",
      "src/legacy/Editor.tsx"
    ],
    is_ambiguous: true
  }
  ```

### Scenario: 파일명 패턴 매칭

- **GIVEN** 에러 메시지에 "SaveButton component"라는 텍스트가 있음
- **WHEN** code-locator가 관련 파일을 찾을 때
- **THEN** `SaveButton.tsx`, `SaveButton.jsx`, `save-button.ts` 등을 검색해야 함
- **AND** 컴포넌트 디렉토리(`components/`, `ui/`) 우선순위로 정렬되어야 함

## Requirement: REQ-003 - 함수/클래스 위치 특정

### Scenario: 함수명이 스택트레이스에 있는 경우

- **GIVEN** 스택트레이스에서 `handleSave` 함수가 `Editor.tsx:145`에 있다고 추출됨
- **WHEN** code-locator가 함수 정의를 찾을 때
- **THEN** 다음 정보가 반환되어야 함
  ```typescript
  {
    file: "src/components/Editor.tsx",
    function_name: "handleSave",
    start_line: 142,  // 실제 함수 정의 시작
    end_line: 156,
    error_line: 145,  // 에러 발생 라인
    context_lines: "142-156"
  }
  ```

### Scenario: 함수명만 언급되고 파일이 없는 경우

- **GIVEN** 에러 설명에 `processData function` 만 언급됨
- **WHEN** code-locator가 함수를 검색할 때
- **THEN** 프로젝트 전체에서 `processData` 함수 정의를 검색해야 함
- **AND** Grep 도구를 사용하여 `function processData`, `const processData =` 등을 찾아야 함

### Scenario: 클래스 메서드인 경우

- **GIVEN** 스택트레이스에 `DocumentEditor.save` 형태로 표시됨
- **WHEN** code-locator가 위치를 찾을 때
- **THEN** `DocumentEditor` 클래스 내의 `save` 메서드를 찾아야 함
- **AND** 클래스 전체 범위와 메서드 범위 모두 반환해야 함

## Requirement: REQ-004 - 컴포넌트 식별

### Scenario: React 컴포넌트 파일

- **GIVEN** `Editor.tsx` 파일이 React 컴포넌트임
- **WHEN** code-locator가 컴포넌트를 분석할 때
- **THEN** 다음 정보가 추출되어야 함
  ```typescript
  {
    file: "src/components/Editor.tsx",
    component_name: "Editor",
    component_type: "react",
    exports: ["Editor", "useEditorState"],
    imports: ["react", "src/hooks/useDocument"]
  }
  ```

### Scenario: 컴포넌트 라벨 추론

- **GIVEN** 파일 경로가 `src/canvas/core/Editor.tsx`임
- **WHEN** code-locator가 컴포넌트 라벨을 추론할 때
- **THEN** `component: "canvas-core"` 라벨을 제안해야 함

## Requirement: REQ-005 - 텍스트 기반 코드 탐색

### Scenario: 에러 메시지에 코드 스니펫이 포함된 경우

- **GIVEN** 에러 설명에 다음 코드 스니펫이 있음
  ```typescript
  const id = document.id;
  api.save(id, data);
  ```
- **WHEN** code-locator가 이 코드를 찾을 때
- **THEN** 프로젝트 내에서 정확히 일치하거나 유사한 코드를 검색해야 함
- **AND** 유사도 점수와 함께 결과를 반환해야 함

### Scenario: 키워드 기반 탐색

- **GIVEN** 에러 설명이 "저장 버튼 클릭 시 에러"임
- **WHEN** code-locator가 관련 코드를 찾을 때
- **THEN** 다음 키워드로 검색해야 함
  - `save`, `onSave`, `handleSave`
  - `SaveButton`, `save-button`
  - `onClick`, `onPress`
- **AND** 검색 결과를 관련성 순으로 정렬해야 함

### Scenario: 자연어 설명에서 코드 위치 추론

- **GIVEN** "새 문서 작성 후 저장할 때 에러"라는 설명이 있음
- **WHEN** code-locator가 관련 코드를 찾을 때
- **THEN** 다음 패턴을 탐색해야 함
  - 문서 생성 관련: `createDocument`, `newDocument`
  - 저장 관련: `save`, `persist`, `store`
  - 조건 분기: `if (isNew)`, `if (!document.id)`

## Requirement: REQ-006 - 결과 우선순위 및 신뢰도

### Scenario: 여러 매칭 결과가 있는 경우

- **GIVEN** `Editor.tsx` 파일이 3곳에서 발견됨
  - `src/components/Editor.tsx`
  - `src/legacy/Editor.tsx`
  - `tests/mocks/Editor.tsx`
- **WHEN** code-locator가 결과를 반환할 때
- **THEN** 다음 우선순위로 정렬되어야 함
  1. 스택트레이스에 명시된 경로와 정확히 일치
  2. 프로덕션 코드 (`src/`, `lib/`)
  3. 테스트 코드 (`tests/`, `__tests__/`)
  4. 레거시/아카이브 코드

### Scenario: 신뢰도 점수 계산

- **GIVEN** code-locator가 여러 단서로 코드를 찾음
- **WHEN** 결과를 반환할 때
- **THEN** 각 결과에 신뢰도 점수가 포함되어야 함
  ```typescript
  {
    file: "src/components/Editor.tsx",
    confidence: 0.95,  // 0.0 ~ 1.0
    match_reasons: [
      "exact_stack_trace_match",
      "function_name_match",
      "line_number_match"
    ]
  }
  ```

## Requirement: REQ-007 - 에러 케이스 처리

### Scenario: 스택트레이스가 없는 경우

- **GIVEN** 에러 설명에 스택트레이스가 없고 일반 텍스트만 있음
- **WHEN** code-locator가 분석할 때
- **THEN** 텍스트 기반 탐색으로 전환해야 함
- **AND** 신뢰도 점수가 낮게 설정되어야 함

### Scenario: 파일을 전혀 찾지 못한 경우

- **GIVEN** 모든 탐색 방법으로도 관련 파일을 찾지 못함
- **WHEN** code-locator가 결과를 반환할 때
- **THEN** 빈 배열과 함께 `no_matches: true` 플래그를 반환해야 함
- **AND** 검색에 사용한 키워드 목록을 포함해야 함

## Data Types

```typescript
interface StackFrame {
  file: string;
  function?: string;
  line?: number;
  column?: number;
  is_project_code: boolean;  // node_modules 제외
}

interface ParsedStackTrace {
  error_type: string;
  error_message: string;
  frames: StackFrame[];
  primary_file?: string;
  primary_function?: string;
  primary_line?: number;
}

interface CodeLocation {
  file: string;
  absolute_path: string;
  file_exists: boolean;
  function_name?: string;
  class_name?: string;
  start_line?: number;
  end_line?: number;
  error_line?: number;
  confidence: number;  // 0.0 ~ 1.0
  match_reasons: string[];
}

interface CodeSearchResult {
  matches: CodeLocation[];
  is_ambiguous: boolean;
  no_matches: boolean;
  search_keywords: string[];
  component_label?: string;
}
```

## Implementation Notes

1. **스택트레이스 파싱 정규식**
   - JavaScript/TS: `at (.+?) \((.+?):(\d+):(\d+)\)`
   - Python: `File "(.+?)", line (\d+), in (.+)`
   - Java: `at (.+?)\.(.+?)\((.+?):(\d+)\)`

2. **파일 검색 전략**
   1. 정확한 경로 매칭
   2. 파일명 매칭 (확장자 고려)
   3. 파일명 패턴 매칭 (kebab-case ↔ PascalCase)
   4. 키워드 기반 Grep 검색

3. **컴포넌트 라벨 추론 규칙**
   - `src/canvas/core/**` → `component: "canvas-core"`
   - `src/editor/**` → `component: "editor"`
   - `src/ui/**` → `component: "ui"`

4. **신뢰도 점수 계산**
   ```
   score = 0.0
   if (스택트레이스 정확 매칭) score += 0.6
   if (함수명 매칭) score += 0.2
   if (라인 번호 매칭) score += 0.1
   if (파일 경로 매칭) score += 0.1
   ```

## Related Specs

- [common/types](../../common/types/spec.md) - 공통 타입 정의
- [analyzer/task-analyzer](../task-analyzer/spec.md) - 태스크 분석
- [analyzer/issue-generator](../issue-generator/spec.md) - GitHub Issue 생성
