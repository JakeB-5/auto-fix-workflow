---
status: draft
created: 2026-02-02
spec: autofix/ai-integration
---

# AI Integration 작업 목록

## 작업 목록

### TASK-AI-001: CLI 래퍼 기본 구현

- [ ] `invokeClaudeCLI()` 함수 구현
- [ ] spawn으로 subprocess 실행
- [ ] `--dangerously-skip-permissions` 플래그 적용
- [ ] `--print --output-format json` 출력 처리
- [ ] stdout/stderr 수집
- [ ] exit code 처리

**파일**: `src/commands/autofix/ai-integration.ts`

### TASK-AI-002: analyzeGroup 함수 구현

- [ ] Issue 컨텍스트를 프롬프트로 변환
- [ ] `--allowedTools "Read,Glob,Grep"` 설정
- [ ] JSON 응답 파싱 (confidence, rootCause, suggestedFix)
- [ ] 신뢰도 임계값 검증 (minConfidence)

**파일**: `src/commands/autofix/ai-integration.ts`

### TASK-AI-003: applyFix 함수 구현

- [ ] worktree 경로를 `cwd`로 설정
- [ ] `--allowedTools "Read,Edit,Glob,Grep,Bash"` 설정
- [ ] 수정 결과 요약 수집
- [ ] git add 명령 실행 (자동 staging)

**파일**: `src/commands/autofix/ai-integration.ts`

### TASK-AI-004: 에러 핸들링

- [ ] Rate limit / overload 시 exponential backoff
- [ ] 타임아웃 처리 (분석: 300초, 수정: 600초)
- [ ] 비용 초과 처리 (모델 폴백)
- [ ] Result<T, Error> 패턴 적용

**파일**: `src/commands/autofix/ai-integration.ts`

### TASK-AI-005: Budget 연동

- [ ] BudgetTracker 통합
- [ ] 비용 추적
- [ ] 모델 폴백 로직

**파일**: `src/commands/autofix/ai-integration.ts`, `budget.ts`

### TASK-AI-006: 테스트 작성

- [ ] Mock subprocess 테스트
- [ ] JSON 파싱 테스트
- [ ] 에러 핸들링 테스트
- [ ] Budget 연동 테스트

**파일**: `src/commands/autofix/__tests__/ai-integration.test.ts`

## 구현 파일 (예정)

| 파일 | 설명 |
|------|------|
| `ai-integration.ts` | Claude CLI 래퍼 및 분석/수정 함수 |
| `budget.ts` | 비용 관리 모듈 |
| `prompts.ts` | 프롬프트 템플릿 |
| `ai-integration.test.ts` | 단위 테스트 |
| `budget.test.ts` | 예산 관리 테스트 |
| `prompts.test.ts` | 프롬프트 테스트 |
