---
status: draft
created: 2026-02-02
spec: autofix/prompts
---

# Prompt Templates 작업 목록

## 작업 목록

### TASK-PRM-001: 프롬프트 템플릿 정의

- [ ] ANALYSIS_PROMPT_TEMPLATE
- [ ] FIX_PROMPT_TEMPLATE
- [ ] RETRY_PROMPT_TEMPLATE

**파일**: `src/commands/autofix/prompts.ts`

### TASK-PRM-002: 빌더 함수 구현

- [ ] buildAnalysisPrompt(group: IssueGroup)
- [ ] buildFixPrompt(group: IssueGroup, analysis: AIAnalysisResult)
- [ ] buildRetryPrompt(group, analysis, testError, attemptNumber, previousSummary)
- [ ] renderTemplate() 헬퍼 함수

**파일**: `src/commands/autofix/prompts.ts`

### TASK-PRM-003: JSON 스키마 정의

- [ ] ANALYSIS_RESULT_SCHEMA
- [ ] FIX_RESULT_SCHEMA
- [ ] 스키마 내보내기

**파일**: `src/commands/autofix/prompts.ts`

### TASK-PRM-004: 테스트 작성

- [ ] 분석 프롬프트 생성 테스트
- [ ] 수정 프롬프트 생성 테스트
- [ ] 재시도 프롬프트 생성 테스트
- [ ] 템플릿 렌더링 테스트
- [ ] 스키마 형식 검증 테스트

**파일**: `src/commands/autofix/__tests__/prompts.test.ts`

## 프롬프트 특징 (예정)

1. **분석 프롬프트**
   - 이슈 제목/본문 포함
   - JSON 출력 명시적 요청
   - confidence, rootCause, suggestedFix, affectedFiles, complexity 필드

2. **수정 프롬프트**
   - 분석 결과 포함
   - 최소 변경 지침
   - 안전 가이드라인

3. **재시도 프롬프트**
   - 이전 실패 정보
   - 테스트 에러 로그
   - 시도 횟수 표시
