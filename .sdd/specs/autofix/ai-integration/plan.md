---
status: draft
created: 2026-02-02
spec: autofix/ai-integration
---

# AI Integration 구현 계획

## 개요

Claude CLI를 subprocess로 실행하여 코드 분석 및 수정을 수행하는 통합 모듈 구현.

## 구현 단계

### Phase 1: CLI 래퍼 기본 구현

1. **invokeClaudeCLI 함수**
   - spawn으로 subprocess 실행
   - 필수 플래그 설정 (--dangerously-skip-permissions, --print, --output-format json)
   - stdout/stderr 수집
   - exit code 처리

2. **옵션 처리**
   - model 선택 (opus/sonnet/haiku)
   - allowedTools 제한
   - maxBudget 설정
   - workingDir 설정

### Phase 2: 분석/수정 함수 구현

1. **analyzeGroup 함수**
   - 프롬프트 구성 (buildAnalysisPrompt 사용)
   - 분석용 도구 제한 (Read, Glob, Grep)
   - JSON 결과 파싱

2. **applyFix 함수**
   - 프롬프트 구성 (buildFixPrompt 사용)
   - 수정용 도구 허용 (Read, Edit, Glob, Grep, Bash)
   - git staging 처리

### Phase 3: 에러 핸들링

1. **재시도 로직**
   - exponential backoff
   - rate limit 처리
   - overload 처리

2. **타임아웃**
   - 분석: 300초
   - 수정: 600초

## 의존성

- `autofix/budget` - 비용 관리
- `autofix/prompts` - 프롬프트 템플릿
- `common/types` - 타입 정의
- `common/config-loader` - 설정 로드

## 테스트 전략

1. Mock subprocess 테스트
2. JSON 파싱 테스트
3. 에러 핸들링 테스트

## 완료 기준

- [ ] invokeClaudeCLI 구현 및 테스트
- [ ] analyzeGroup 구현 및 테스트
- [ ] applyFix 구현 및 테스트
- [ ] 에러 핸들링 및 재시도 로직
- [ ] Budget 연동

## 참고

구현은 `feature/ai-config-system` 브랜치에서 진행됩니다.
