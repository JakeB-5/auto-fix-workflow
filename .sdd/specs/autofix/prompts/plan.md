---
status: draft
created: 2026-02-02
spec: autofix/prompts
---

# Prompt Templates 구현 계획

## 개요

Claude CLI에 전달할 분석 및 수정 프롬프트 템플릿 모듈 구현.

## 구현 단계

### Phase 1: 프롬프트 템플릿

1. **분석 프롬프트**
   - ANALYSIS_PROMPT_TEMPLATE
   - 이슈 정보 포함
   - JSON 출력 요청

2. **수정 프롬프트**
   - FIX_PROMPT_TEMPLATE
   - 분석 결과 포함
   - 안전 가이드라인

3. **재시도 프롬프트**
   - RETRY_PROMPT_TEMPLATE
   - 테스트 에러 포함

### Phase 2: 빌더 함수

1. **buildAnalysisPrompt()**
   - IssueGroup → 프롬프트 문자열

2. **buildFixPrompt()**
   - IssueGroup + AIAnalysisResult → 프롬프트 문자열

3. **buildRetryPrompt()**
   - 재시도 컨텍스트 포함

### Phase 3: JSON 스키마

1. **ANALYSIS_RESULT_SCHEMA**
2. **FIX_RESULT_SCHEMA**

## 의존성

- `common/types` - GitHubIssue, IssueGroup 타입

## 테스트 전략

1. 템플릿 변수 치환 테스트
2. 다중 이슈 처리 테스트
3. 스키마 유효성 테스트

## 완료 기준

- [ ] 프롬프트 템플릿 정의
- [ ] 빌더 함수 구현
- [ ] JSON 스키마 내보내기
- [ ] 테스트 작성

## 참고

구현은 `feature/ai-config-system` 브랜치에서 진행됩니다.
