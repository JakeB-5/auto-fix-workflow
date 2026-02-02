/**
 * @module commands/autofix/prompts
 * @description AI 프롬프트 템플릿 및 빌더 함수
 */

import type { IssueGroup } from '../../common/types/index.js';
import type { AIAnalysisResult } from './types.js';

/**
 * 분석 프롬프트 템플릿
 *
 * 이슈 분석을 위한 프롬프트를 생성합니다.
 * {{#each issues}} 블록을 사용하여 다중 이슈를 처리합니다.
 */
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

/**
 * 수정 프롬프트 템플릿
 *
 * 코드 수정을 위한 프롬프트를 생성합니다.
 * 분석 결과를 포함하고 안전 가이드라인을 제시합니다.
 */
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

/**
 * 재시도 프롬프트 템플릿
 *
 * 테스트 실패 후 재시도를 위한 프롬프트를 생성합니다.
 * 이전 시도 정보와 테스트 에러를 포함합니다.
 */
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

/**
 * 분석 결과 JSON 스키마
 *
 * AI 분석 출력의 구조를 정의합니다.
 */
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
} as const;

/**
 * 수정 결과 JSON 스키마
 *
 * AI 수정 출력의 구조를 정의합니다.
 */
export const FIX_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
  },
  required: ['success', 'summary', 'filesChanged'],
} as const;

/**
 * 에러 로그를 최대 줄 수로 제한합니다.
 *
 * @param error - 원본 에러 로그
 * @param maxLines - 최대 줄 수 (기본값: 50)
 * @returns 제한된 에러 로그
 */
function truncateError(error: string, maxLines: number = 50): string {
  const lines = error.split('\n');
  if (lines.length <= maxLines) {
    return error;
  }

  const truncated = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;
  truncated.push(`\n... (${remaining} more lines omitted)`);

  return truncated.join('\n');
}

/**
 * 템플릿 변수를 치환하여 최종 문자열을 생성합니다.
 *
 * 지원하는 문법:
 * - `{{variable}}` - 단순 변수 치환
 * - `{{object.property}}` - 객체 속성 접근
 * - `{{#each array}}...{{/each}}` - 배열 반복
 * - `{{this.property}}` - 반복 내 현재 아이템 속성 접근
 *
 * @param template - 템플릿 문자열
 * @param context - 치환할 변수를 포함한 컨텍스트 객체
 * @returns 렌더링된 문자열
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  let result = template;

  // Simple variable replacement: {{variable}}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' || typeof value === 'number') {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Object property access: {{object.property}}
      result = result.replace(
        new RegExp(`{{${key}\\.(\\w+)}}`, 'g'),
        (_, prop) => {
          const val = (value as Record<string, unknown>)[prop];
          if (val === undefined || val === null) return '';
          return String(val);
        }
      );
    }
  }

  // Handle {{#each array}}...{{/each}} blocks
  result = result.replace(
    /{{#each (\w+)}}([\s\S]*?){{\/each}}/g,
    (_, arrayName, content) => {
      const array = context[arrayName];
      if (!Array.isArray(array)) return '';

      return array.map((item) => {
        let itemContent = content;

        if (typeof item === 'object' && item !== null) {
          // Replace {{this.property}} with item property values
          for (const [prop, val] of Object.entries(item)) {
            const replacement = val === undefined || val === null ? '' : String(val);
            itemContent = itemContent.replace(
              new RegExp(`{{this\\.${prop}}}`, 'g'),
              replacement
            );
          }
        }

        return itemContent;
      }).join('');
    }
  );

  return result.trim();
}

/**
 * 이슈 그룹에 대한 분석 프롬프트를 생성합니다.
 *
 * @param group - 분석할 이슈 그룹
 * @returns 렌더링된 분석 프롬프트
 *
 * @example
 * ```typescript
 * const prompt = buildAnalysisPrompt({
 *   id: 'grp-1',
 *   issues: [
 *     { number: 123, title: 'Bug', body: 'Description', ... }
 *   ],
 *   ...
 * });
 * ```
 */
export function buildAnalysisPrompt(group: IssueGroup): string {
  return renderTemplate(ANALYSIS_PROMPT_TEMPLATE, {
    issues: group.issues,
  });
}

/**
 * 이슈 그룹과 분석 결과를 기반으로 수정 프롬프트를 생성합니다.
 *
 * @param group - 수정할 이슈 그룹
 * @param analysis - AI 분석 결과
 * @returns 렌더링된 수정 프롬프트
 *
 * @example
 * ```typescript
 * const prompt = buildFixPrompt(group, {
 *   confidence: 0.9,
 *   rootCause: 'Null pointer',
 *   suggestedFix: 'Add null check',
 *   affectedFiles: ['src/index.ts'],
 *   complexity: 'low'
 * });
 * ```
 */
export function buildFixPrompt(
  group: IssueGroup,
  analysis: AIAnalysisResult
): string {
  return renderTemplate(FIX_PROMPT_TEMPLATE, {
    issues: group.issues,
    analysis: {
      rootCause: analysis.rootCause,
      suggestedFix: analysis.suggestedFix,
      affectedFiles: analysis.filesToModify.join(', '),
    },
  });
}

/**
 * 테스트 실패 후 재시도를 위한 프롬프트를 생성합니다.
 *
 * @param group - 수정할 이슈 그룹
 * @param analysis - AI 분석 결과
 * @param testError - 테스트 실패 에러 로그
 * @param attemptNumber - 현재 시도 횟수 (1부터 시작)
 * @param previousSummary - 이전 시도 요약
 * @returns 렌더링된 재시도 프롬프트
 *
 * @example
 * ```typescript
 * const prompt = buildRetryPrompt(
 *   group,
 *   analysis,
 *   'Test failed: Expected 1 but got 2',
 *   2,
 *   'Previous attempt: Added null check'
 * );
 * ```
 */
export function buildRetryPrompt(
  group: IssueGroup,
  analysis: AIAnalysisResult,
  testError: string,
  attemptNumber: number,
  previousSummary: string
): string {
  return renderTemplate(RETRY_PROMPT_TEMPLATE, {
    issues: group.issues,
    analysis: {
      rootCause: analysis.rootCause,
      suggestedFix: analysis.suggestedFix,
    },
    testError: truncateError(testError, 50),
    attemptNumber,
    previousSummary,
  });
}
