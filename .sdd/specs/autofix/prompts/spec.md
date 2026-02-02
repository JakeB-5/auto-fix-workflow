---
status: draft
created: 2026-02-02
constitution_version: "1.1.0"
domain: autofix
feature: prompts
depends: "common/types"
---

# Prompt Templates

> Claude CLI에 전달할 분석 및 수정 프롬프트 템플릿

---

## Requirement: REQ-PRM-001 - 분석 프롬프트 템플릿

이슈 분석을 위한 프롬프트를 구성해야 한다(SHALL).

### Scenario: 분석 프롬프트 생성

- **GIVEN** IssueGroup이 전달되고
- **WHEN** `buildAnalysisPrompt(group)`을 호출하면
- **THEN** 다음 섹션을 포함해야 함:
  - 이슈 제목 및 본문
  - 관련 파일 힌트
  - 분석 지침
  - 출력 형식 지정
- **AND** JSON 출력을 명시적으로 요청해야 함

### Scenario: 다중 이슈 그룹 처리

- **GIVEN** 여러 이슈가 하나의 그룹으로 묶이고
- **WHEN** 프롬프트를 구성할 때
- **THEN** 각 이슈를 개별 섹션으로 나열해야 함
- **AND** 공통 근본 원인을 찾도록 지시해야 함

---

## Requirement: REQ-PRM-002 - 수정 프롬프트 템플릿

코드 수정을 위한 프롬프트를 구성해야 한다(SHALL).

### Scenario: 수정 프롬프트 생성

- **GIVEN** IssueGroup과 AIAnalysisResult가 전달되고
- **WHEN** `buildFixPrompt(group, analysis)`를 호출하면
- **THEN** 다음 섹션을 포함해야 함:
  - 이슈 정보 요약
  - 분석 결과 (rootCause, suggestedFix)
  - 수정 지침
  - 수정 범위 제한
- **AND** 최소한의 변경만 하도록 지시해야 함

### Scenario: 안전 가이드라인 포함

- **GIVEN** 수정 프롬프트를 구성할 때
- **WHEN** 지침 섹션을 작성하면
- **THEN** 다음 규칙을 명시해야 함:
  - 불필요한 주석 추가 금지
  - 불필요한 리팩토링 금지
  - 최소한의 변경만 수행
  - 기존 코드 스타일 유지

---

## Requirement: REQ-PRM-003 - JSON 스키마 정의

구조화된 출력을 위한 스키마를 제공해야 한다(SHALL).

### Scenario: 분석 결과 스키마

- **GIVEN** 분석 프롬프트를 생성할 때
- **WHEN** 출력 형식을 지정하면
- **THEN** 다음 스키마를 포함해야 함:
  ```json
  {
    "type": "object",
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "rootCause": { "type": "string" },
      "suggestedFix": { "type": "string" },
      "affectedFiles": { "type": "array", "items": { "type": "string" } },
      "complexity": { "enum": ["low", "medium", "high"] }
    },
    "required": ["confidence", "rootCause", "suggestedFix", "affectedFiles", "complexity"]
  }
  ```

### Scenario: 수정 결과 스키마

- **GIVEN** 수정 프롬프트를 생성할 때
- **WHEN** 출력 형식을 지정하면
- **THEN** 다음 스키마를 포함해야 함:
  ```json
  {
    "type": "object",
    "properties": {
      "success": { "type": "boolean" },
      "summary": { "type": "string" },
      "filesChanged": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["success", "summary", "filesChanged"]
  }
  ```

---

## Requirement: REQ-PRM-004 - 재시도 프롬프트

테스트 실패 후 재시도를 위한 프롬프트를 제공해야 한다(SHOULD).

### Scenario: 재시도 프롬프트 생성

- **GIVEN** 이전 수정 시도가 테스트 실패로 종료되고
- **WHEN** `buildRetryPrompt(group, analysis, testError)`를 호출하면
- **THEN** 다음 섹션을 포함해야 함:
  - 이전 시도 요약
  - 테스트 에러 로그
  - 에러 분석 지침
  - 수정 보완 요청

### Scenario: 에러 로그 포맷팅

- **GIVEN** 테스트 에러 로그가 길고
- **WHEN** 프롬프트에 포함할 때
- **THEN** 관련 부분만 발췌해야 함
- **AND** 최대 50줄로 제한해야 함

---

## Data Types

### PromptTemplate

```typescript
interface PromptTemplate {
  template: string;
  variables: string[];
  schema?: object;
}
```

### PromptContext

```typescript
interface PromptContext {
  issues: GitHubIssue[];
  analysis?: AIAnalysisResult;
  testError?: string;
  attemptNumber?: number;
}
```

---

## Prompt Templates

### ANALYSIS_PROMPT_TEMPLATE

```typescript
export const ANALYSIS_PROMPT_TEMPLATE = `
## Task
Analyze the following GitHub issue(s) and identify the root cause and fix strategy.

## Issue(s)
{{#each issues}}
### Issue #{{this.number}}: {{this.title}}

{{this.body}}

---
{{/each}}

## Instructions
1. Read the relevant code files to understand the context
2. Identify the root cause of the problem
3. Suggest a fix approach
4. List all files that need to be modified
5. Rate your confidence (0-1) in the analysis

## Output Format
Respond with a JSON object matching this schema:
\`\`\`json
{
  "confidence": <number 0-1>,
  "rootCause": "<description of the root cause>",
  "suggestedFix": "<description of the suggested fix>",
  "affectedFiles": ["<file1>", "<file2>", ...],
  "complexity": "<low|medium|high>"
}
\`\`\`

Only output the JSON object, no other text.
`;
```

### FIX_PROMPT_TEMPLATE

```typescript
export const FIX_PROMPT_TEMPLATE = `
## Task
Fix the issue described below by editing the necessary files.

## Issue(s)
{{#each issues}}
### Issue #{{this.number}}: {{this.title}}
{{this.body}}
{{/each}}

## Analysis
- **Root Cause**: {{analysis.rootCause}}
- **Suggested Fix**: {{analysis.suggestedFix}}
- **Files to modify**: {{analysis.affectedFiles}}

## Instructions
1. Read the affected files
2. Make the minimum necessary changes to fix the issue
3. Do NOT add unnecessary comments or documentation
4. Do NOT refactor unrelated code
5. Ensure the fix is complete and correct
6. After making changes, stage the files with git add

## Constraints
- Maximum 3 files can be modified
- Keep changes focused and minimal
- Maintain existing code style
- Do not change function signatures unless necessary

After making changes, output a JSON summary:
\`\`\`json
{
  "success": true,
  "summary": "<what was changed and why>",
  "filesChanged": ["<file1>", "<file2>", ...]
}
\`\`\`
`;
```

### RETRY_PROMPT_TEMPLATE

```typescript
export const RETRY_PROMPT_TEMPLATE = `
## Task
The previous fix attempt failed tests. Analyze the error and fix the issue.

## Previous Attempt
{{previousSummary}}

## Test Error
\`\`\`
{{testError}}
\`\`\`

## Original Issue(s)
{{#each issues}}
### Issue #{{this.number}}: {{this.title}}
{{/each}}

## Analysis
- **Root Cause**: {{analysis.rootCause}}
- **Suggested Fix**: {{analysis.suggestedFix}}

## Instructions
1. Analyze why the previous fix failed
2. Identify what was missed or incorrect
3. Make corrective changes
4. Ensure all tests pass

## Attempt {{attemptNumber}} of 3
`;
```

---

## Implementation Notes

### 프롬프트 빌더 함수

```typescript
export function buildAnalysisPrompt(group: IssueGroup): string {
  return renderTemplate(ANALYSIS_PROMPT_TEMPLATE, {
    issues: group.issues,
  });
}

export function buildFixPrompt(
  group: IssueGroup,
  analysis: AIAnalysisResult
): string {
  return renderTemplate(FIX_PROMPT_TEMPLATE, {
    issues: group.issues,
    analysis,
  });
}

export function buildRetryPrompt(
  group: IssueGroup,
  analysis: AIAnalysisResult,
  testError: string,
  attemptNumber: number,
  previousSummary: string
): string {
  return renderTemplate(RETRY_PROMPT_TEMPLATE, {
    issues: group.issues,
    analysis,
    testError: truncateError(testError, 50),
    attemptNumber,
    previousSummary,
  });
}
```

### 템플릿 렌더링

```typescript
function renderTemplate(template: string, context: Record<string, unknown>): string {
  let result = template;

  // Simple variable replacement
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    } else if (typeof value === 'object' && value !== null) {
      result = result.replace(
        new RegExp(`{{${key}\\.(\\w+)}}`, 'g'),
        (_, prop) => String((value as Record<string, unknown>)[prop] || '')
      );
    }
  }

  // Handle {{#each}} blocks
  result = result.replace(
    /{{#each (\w+)}}([\s\S]*?){{\/each}}/g,
    (_, arrayName, content) => {
      const array = context[arrayName] as unknown[];
      if (!Array.isArray(array)) return '';
      return array.map((item, index) => {
        let itemContent = content;
        if (typeof item === 'object' && item !== null) {
          for (const [prop, val] of Object.entries(item)) {
            itemContent = itemContent.replace(
              new RegExp(`{{this\\.${prop}}}`, 'g'),
              String(val)
            );
          }
        }
        return itemContent;
      }).join('');
    }
  );

  return result.trim();
}
```

### JSON 스키마 내보내기

```typescript
export const ANALYSIS_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rootCause: { type: 'string' },
    suggestedFix: { type: 'string' },
    affectedFiles: { type: 'array', items: { type: 'string' } },
    complexity: { enum: ['low', 'medium', 'high'] },
  },
  required: ['confidence', 'rootCause', 'suggestedFix', 'affectedFiles', 'complexity'],
};

export const FIX_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
  },
  required: ['success', 'summary', 'filesChanged'],
};
```

---

## Testing Scenarios

### 단위 테스트

1. **분석 프롬프트**: 단일/다중 이슈에서 프롬프트 생성
2. **수정 프롬프트**: 분석 결과 포함 확인
3. **재시도 프롬프트**: 에러 로그 포함 확인
4. **템플릿 렌더링**: 변수 치환 검증
5. **스키마 유효성**: JSON 스키마 형식 검증

### 통합 테스트

1. **AI Integration 연동**: 프롬프트 → CLI 호출 → 파싱
2. **에러 로그 트렁케이션**: 긴 에러 로그 처리

---

## Related Specs

- [autofix/ai-integration](../ai-integration/spec.md) - AI 통합 모듈
- [workflow/code-fix-strategy](../../workflow/code-fix-strategy/spec.md) - 수정 전략
- [commands/autofix](../../commands/autofix/spec.md) - Autofix 커맨드
