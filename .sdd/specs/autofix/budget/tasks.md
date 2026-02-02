---
status: draft
created: 2026-02-02
spec: autofix/budget
---

# Budget Management 작업 목록

## 작업 목록

### TASK-BUD-001: BudgetTracker 클래스

- [ ] BudgetConfig 인터페이스 정의
- [ ] DEFAULT_BUDGET_CONFIG 상수 (Infinity, opus/sonnet)
- [ ] BudgetTracker 클래스 구현
- [ ] addCost() 메서드
- [ ] getUsage() 메서드
- [ ] canSpend() 메서드

**파일**: `src/commands/autofix/budget.ts`

### TASK-BUD-002: 모델 폴백

- [ ] getCurrentModel() 메서드
- [ ] 80% 임계값에서 폴백 모델
- [ ] 90% 임계값에서 haiku
- [ ] 무제한 예산 시 항상 선호 모델

**파일**: `src/commands/autofix/budget.ts`

### TASK-BUD-003: 이슈/세션 리셋

- [ ] resetIssue() - 이슈별 사용량 리셋
- [ ] reset() - 전체 리셋

**파일**: `src/commands/autofix/budget.ts`

### TASK-BUD-004: AIConfig 연동

- [ ] AIConfig 인터페이스 (common/types/config.ts)
- [ ] createBudgetConfigFromAI() 함수
- [ ] createBudgetTrackerFromAI() 함수

**파일**: `src/commands/autofix/budget.ts`, `src/common/types/config.ts`

### TASK-BUD-005: 환경 변수 매핑

- [ ] AI_MAX_BUDGET_PER_ISSUE
- [ ] AI_MAX_BUDGET_PER_SESSION
- [ ] AI_PREFERRED_MODEL
- [ ] AI_FALLBACK_MODEL
- [ ] extractAIConfig() 함수

**파일**: `src/commands/autofix/config.ts`

### TASK-BUD-006: 테스트 작성

- [ ] 기본 생성 테스트
- [ ] 비용 추적 테스트
- [ ] canSpend 임계값 테스트
- [ ] 모델 폴백 테스트
- [ ] 무제한 예산 테스트

**파일**: `src/commands/autofix/__tests__/budget.test.ts`

## 기본값 (예정)

```typescript
DEFAULT_BUDGET_CONFIG = {
  maxPerIssue: Infinity,
  maxPerSession: Infinity,
  preferredModel: 'opus',
  fallbackModel: 'sonnet',
};
```
