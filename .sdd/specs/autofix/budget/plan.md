---
status: draft
created: 2026-02-02
spec: autofix/budget
---

# Budget Management 구현 계획

## 개요

AI API 사용 비용을 추적하고 제한하는 예산 관리 모듈 구현.

## 구현 단계

### Phase 1: BudgetTracker 클래스

1. **기본 구조**
   - BudgetConfig 인터페이스
   - 이슈별/세션별 사용량 추적
   - 기본값 설정 (무제한)

2. **핵심 메서드**
   - addCost(): 비용 추가
   - getUsage(): 사용량 조회
   - canSpend(): 지출 가능 여부
   - getCurrentModel(): 현재 모델 반환
   - resetIssue(): 이슈별 리셋
   - reset(): 전체 리셋

### Phase 2: 모델 폴백

1. **임계값 기반 전환**
   - 80% 사용 시 폴백 모델
   - 90% 사용 시 haiku
   - 100% 사용 시 차단

### Phase 3: 설정 연동

1. **AIConfig 변환**
   - createBudgetConfigFromAI()
   - createBudgetTrackerFromAI()

2. **환경 변수 오버라이드**
   - AI_MAX_BUDGET_PER_ISSUE
   - AI_MAX_BUDGET_PER_SESSION
   - AI_PREFERRED_MODEL
   - AI_FALLBACK_MODEL

## 의존성

- `common/types` - AIConfig 타입
- `common/config-loader` - 설정 로드

## 테스트 전략

1. 기본 생성 테스트
2. 비용 추적 테스트
3. 모델 폴백 테스트
4. 무제한 예산 테스트

## 완료 기준

- [ ] BudgetTracker 클래스 구현
- [ ] 모델 폴백 로직
- [ ] AIConfig 변환 함수
- [ ] 테스트 작성

## 참고

구현은 `feature/ai-config-system` 브랜치에서 진행됩니다.
