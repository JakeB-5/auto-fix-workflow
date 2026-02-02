---
status: draft
created: 2026-02-02
constitution_version: "1.1.0"
domain: autofix
feature: budget
depends: "common/types, common/config-loader"
---

# Budget Management

> AI API 사용 비용을 추적하고 제한하는 예산 관리 모듈

---

## Requirement: REQ-BUD-001 - 비용 추적

API 호출 비용을 실시간으로 추적해야 한다(SHALL).

### Scenario: 호출별 비용 기록

- **GIVEN** Claude CLI 호출이 완료되고
- **WHEN** 비용 정보가 반환되면
- **THEN** 호출 비용을 누적해야 함
- **AND** 이슈별, 세션별로 구분하여 추적해야 함

### Scenario: 비용 조회

- **GIVEN** BudgetTracker 인스턴스가 있고
- **WHEN** `getUsage()`를 호출하면
- **THEN** 현재 사용량을 반환해야 함:
  ```typescript
  interface BudgetUsage {
    currentIssue: number;    // 현재 이슈 비용
    currentSession: number;  // 현재 세션 총 비용
    remainingIssue: number;  // 이슈 잔여 예산
    remainingSession: number; // 세션 잔여 예산
  }
  ```

---

## Requirement: REQ-BUD-002 - 예산 제한

설정된 예산을 초과하지 않도록 제한해야 한다(SHALL).

### Scenario: 이슈당 예산 제한

- **GIVEN** `maxPerIssue`가 설정되고
- **WHEN** 현재 이슈 비용이 제한에 도달하면
- **THEN** `canSpend()`가 `false`를 반환해야 함
- **AND** 추가 API 호출을 차단해야 함

### Scenario: 세션당 예산 제한

- **GIVEN** `maxPerSession`이 설정되고
- **WHEN** 총 세션 비용이 제한에 도달하면
- **THEN** `canSpend()`가 `false`를 반환해야 함
- **AND** 이후 모든 이슈 처리를 중단해야 함

### Scenario: 무제한 예산

- **GIVEN** 예산 제한이 `Infinity`로 설정되고
- **WHEN** 비용을 확인할 때
- **THEN** `canSpend()`가 항상 `true`를 반환해야 함
- **AND** 기본 동작으로 무제한이어야 함

---

## Requirement: REQ-BUD-003 - 모델 폴백

예산 초과 시 저렴한 모델로 전환해야 한다(SHOULD).

### Scenario: 선호 모델에서 폴백 모델로 전환

- **GIVEN** 현재 모델이 `opus`이고 비용이 임계값(80%)에 도달하면
- **WHEN** 다음 호출을 준비할 때
- **THEN** `getCurrentModel()`이 `sonnet`을 반환해야 함
- **AND** 경고 메시지를 로깅해야 함

### Scenario: 폴백 모델에서 haiku로 전환

- **GIVEN** 현재 모델이 `sonnet`이고 비용이 임계값(90%)에 도달하면
- **WHEN** 다음 호출을 준비할 때
- **THEN** `getCurrentModel()`이 `haiku`를 반환해야 함

### Scenario: 최소 모델에서 초과

- **GIVEN** 현재 모델이 `haiku`이고 예산이 완전히 소진되면
- **WHEN** 추가 호출을 시도할 때
- **THEN** `canSpend()`가 `false`를 반환해야 함
- **AND** 예산 초과 에러를 반환해야 함

---

## Requirement: REQ-BUD-004 - 이슈 리셋

새 이슈 처리 시작 시 이슈별 예산을 리셋해야 한다(SHALL).

### Scenario: 새 이슈 시작

- **GIVEN** 이전 이슈 처리가 완료되고
- **WHEN** `resetIssue()`를 호출하면
- **THEN** 이슈별 사용량을 0으로 초기화해야 함
- **AND** 세션별 사용량은 유지해야 함
- **AND** 모델을 선호 모델로 복원해야 함

---

## Requirement: REQ-BUD-005 - 설정 파일 연동

`.auto-fix.yaml`의 AI 설정과 연동해야 한다(SHALL).

### Scenario: YAML 설정 로드

- **GIVEN** `.auto-fix.yaml`에 `ai:` 섹션이 있고
- **WHEN** BudgetTracker를 생성할 때
- **THEN** 설정값을 읽어와야 함:
  ```yaml
  ai:
    maxBudgetPerIssue: 10.0
    maxBudgetPerSession: 100.0
    preferredModel: opus
    fallbackModel: sonnet
  ```

### Scenario: 환경 변수 오버라이드

- **GIVEN** 환경 변수가 설정되고
- **WHEN** 설정을 로드할 때
- **THEN** 환경 변수가 YAML 설정보다 우선해야 함

### Scenario: 기본값 사용

- **GIVEN** 설정이 없고
- **WHEN** BudgetTracker를 생성할 때
- **THEN** 기본값을 사용해야 함:
  - `maxPerIssue`: `Infinity`
  - `maxPerSession`: `Infinity`
  - `preferredModel`: `opus`
  - `fallbackModel`: `sonnet`

---

## Data Types

### BudgetConfig

```typescript
interface BudgetConfig {
  maxPerIssue: number;                    // 이슈당 최대 비용 (USD)
  maxPerSession: number;                  // 세션당 최대 비용 (USD)
  preferredModel: 'opus' | 'sonnet' | 'haiku';  // 선호 모델
  fallbackModel: 'opus' | 'sonnet' | 'haiku';   // 폴백 모델
}
```

**Constraints:**
- `maxPerIssue` MUST be positive or Infinity
- `maxPerSession` MUST be positive or Infinity
- `preferredModel` MUST be a valid model name
- `fallbackModel` MUST be cheaper than or equal to preferredModel

### BudgetUsage

```typescript
interface BudgetUsage {
  currentIssue: number;
  currentSession: number;
  remainingIssue: number;
  remainingSession: number;
}
```

### DEFAULT_BUDGET_CONFIG

```typescript
const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxPerIssue: Infinity,
  maxPerSession: Infinity,
  preferredModel: 'opus',
  fallbackModel: 'sonnet',
};
```

---

## BudgetTracker Class Interface

```typescript
class BudgetTracker {
  constructor(config?: Partial<BudgetConfig>);

  // 비용 추가
  addCost(amount: number): void;

  // 현재 사용량 조회
  getUsage(): BudgetUsage;

  // 추가 지출 가능 여부
  canSpend(estimatedCost?: number): boolean;

  // 현재 사용할 모델
  getCurrentModel(): 'opus' | 'sonnet' | 'haiku';

  // 이슈별 사용량 리셋
  resetIssue(): void;

  // 전체 리셋
  reset(): void;
}
```

---

## Implementation Notes

### BudgetTracker 구현

```typescript
export class BudgetTracker {
  private config: BudgetConfig;
  private issueUsage: number = 0;
  private sessionUsage: number = 0;

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
  }

  addCost(amount: number): void {
    this.issueUsage += amount;
    this.sessionUsage += amount;
  }

  getUsage(): BudgetUsage {
    return {
      currentIssue: this.issueUsage,
      currentSession: this.sessionUsage,
      remainingIssue: Math.max(0, this.config.maxPerIssue - this.issueUsage),
      remainingSession: Math.max(0, this.config.maxPerSession - this.sessionUsage),
    };
  }

  canSpend(estimatedCost = 0): boolean {
    const issueOk = this.issueUsage + estimatedCost <= this.config.maxPerIssue;
    const sessionOk = this.sessionUsage + estimatedCost <= this.config.maxPerSession;
    return issueOk && sessionOk;
  }

  getCurrentModel(): 'opus' | 'sonnet' | 'haiku' {
    const usage = this.getUsage();

    // 90% 이상 사용 시 haiku
    if (usage.remainingIssue <= this.config.maxPerIssue * 0.1 ||
        usage.remainingSession <= this.config.maxPerSession * 0.1) {
      return 'haiku';
    }

    // 80% 이상 사용 시 폴백 모델
    if (usage.remainingIssue <= this.config.maxPerIssue * 0.2 ||
        usage.remainingSession <= this.config.maxPerSession * 0.2) {
      return this.config.fallbackModel;
    }

    return this.config.preferredModel;
  }

  resetIssue(): void {
    this.issueUsage = 0;
  }

  reset(): void {
    this.issueUsage = 0;
    this.sessionUsage = 0;
  }
}
```

### AIConfig 변환 함수

```typescript
export function createBudgetConfigFromAI(aiConfig?: AIConfig): Partial<BudgetConfig> {
  if (!aiConfig) return {};

  return {
    maxPerIssue: aiConfig.maxBudgetPerIssue,
    maxPerSession: aiConfig.maxBudgetPerSession,
    preferredModel: aiConfig.preferredModel,
    fallbackModel: aiConfig.fallbackModel,
  };
}

export function createBudgetTrackerFromAI(aiConfig?: AIConfig): BudgetTracker {
  return new BudgetTracker(createBudgetConfigFromAI(aiConfig));
}
```

---

## Testing Scenarios

### 단위 테스트

1. **기본 생성**: 기본값으로 BudgetTracker 생성
2. **비용 추가**: addCost로 비용 누적 확인
3. **사용량 조회**: getUsage 반환값 검증
4. **지출 가능 여부**: canSpend 임계값 검증
5. **모델 폴백**: 비용 증가에 따른 모델 전환
6. **이슈 리셋**: resetIssue 후 이슈 사용량 0 확인
7. **무제한 예산**: Infinity 설정 시 항상 canSpend true

### 통합 테스트

1. **YAML 연동**: .auto-fix.yaml에서 설정 로드
2. **환경 변수**: 환경 변수 오버라이드 검증
3. **AI Integration 연동**: BudgetTracker와 invokeClaudeCLI 통합

---

## Related Specs

- [autofix/ai-integration](../ai-integration/spec.md) - AI 통합 모듈
- [common/config-loader](../../common/config-loader/spec.md) - 설정 로더
- [common/types](../../common/types/spec.md) - AIConfig 타입 정의
