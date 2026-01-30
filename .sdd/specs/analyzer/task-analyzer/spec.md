---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: analyzer
feature: task-analyzer
depends: "common/types"
---

# Task Analyzer

> Asana 태스크를 분석하여 GitHub Issue로 자동 변환 가능 여부를 판단하는 분석기

## Requirement: REQ-001 - 재현 가능성 판단

### Scenario: 명확한 재현 단계가 있는 경우

- **GIVEN** Asana 태스크에 단계별 재현 방법이 기술되어 있음
- **WHEN** task-analyzer가 태스크를 분석할 때
- **THEN** `reproducibility` 필드가 `"clear"`로 설정되어야 함
- **AND** `confidence` 점수가 `high`로 평가되어야 함

### Scenario: 재현 단계가 불명확한 경우

- **GIVEN** Asana 태스크에 모호한 증상만 기술되어 있음 (예: "앱이 느려요")
- **WHEN** task-analyzer가 태스크를 분석할 때
- **THEN** `reproducibility` 필드가 `"unclear"`로 설정되어야 함
- **AND** `confidence` 점수가 `low`로 평가되어야 함
- **AND** `missing_info` 배열에 `"reproduction-steps"`가 포함되어야 함

## Requirement: REQ-002 - 정보 충분성 평가

### Scenario: 필수 정보가 모두 있는 경우

- **GIVEN** Asana 태스크에 다음 정보가 모두 포함됨
  - 에러 메시지 또는 스택트레이스
  - 발생 조건
  - 기대 동작 vs 실제 동작
- **WHEN** task-analyzer가 정보 충분성을 평가할 때
- **THEN** `has_sufficient_info` 필드가 `true`로 설정되어야 함
- **AND** `confidence` 점수가 `high` 또는 `medium`으로 평가되어야 함

### Scenario: 에러 메시지가 없는 경우

- **GIVEN** Asana 태스크에 에러 메시지나 스택트레이스가 없음
- **WHEN** task-analyzer가 정보 충분성을 평가할 때
- **THEN** `has_sufficient_info` 필드가 `false`로 설정되어야 함
- **AND** `missing_info` 배열에 `"error-message"`가 포함되어야 함

### Scenario: 스크린샷만 있고 텍스트 설명이 없는 경우

- **GIVEN** Asana 태스크에 스크린샷만 첨부되어 있음
- **WHEN** task-analyzer가 정보 충분성을 평가할 때
- **THEN** `has_sufficient_info` 필드가 `false`로 설정되어야 함
- **AND** `missing_info` 배열에 `"text-description"`이 포함되어야 함

## Requirement: REQ-003 - Confidence 레벨 평가

### Scenario: High Confidence

- **GIVEN** 태스크가 다음 조건을 모두 만족함
  - 재현 단계 명확
  - 에러 메시지/스택트레이스 존재
  - 코드 위치 식별 가능
- **WHEN** task-analyzer가 confidence를 계산할 때
- **THEN** `confidence` 필드가 `"high"`로 설정되어야 함
- **AND** `can_auto_convert` 필드가 `true`로 설정되어야 함

### Scenario: Medium Confidence

- **GIVEN** 태스크가 다음 조건 중 일부만 만족함
  - 재현 단계는 있지만 일부 모호함
  - 에러 메시지는 있지만 스택트레이스 없음
  - 코드 위치 추정 가능하지만 확실하지 않음
- **WHEN** task-analyzer가 confidence를 계산할 때
- **THEN** `confidence` 필드가 `"medium"`으로 설정되어야 함
- **AND** `can_auto_convert` 필드가 `true`로 설정되어야 함 (사용자 확인 필요)

### Scenario: Low Confidence

- **GIVEN** 태스크가 필수 정보 대부분이 부족함
- **WHEN** task-analyzer가 confidence를 계산할 때
- **THEN** `confidence` 필드가 `"low"`로 설정되어야 함
- **AND** `can_auto_convert` 필드가 `false`로 설정되어야 함
- **AND** `asana_action` 필드에 보충 요청 정보가 포함되어야 함

## Requirement: REQ-004 - 분석 결과 구조

### Scenario: 분석 완료 후 결과 반환

- **GIVEN** task-analyzer가 Asana 태스크 분석을 완료함
- **WHEN** 분석 결과를 반환할 때
- **THEN** 다음 필드들이 반드시 포함되어야 함
  ```typescript
  {
    task_id: string;
    confidence: "high" | "medium" | "low";
    can_auto_convert: boolean;
    reproducibility: "clear" | "partial" | "unclear";
    has_sufficient_info: boolean;
    missing_info: string[];  // ["error-message", "reproduction-steps", etc.]
    identified_files?: string[];  // 코드 위치가 식별된 경우
    asana_action?: {
      add_tags: string[];  // 예: ["needs-more-info"]
      comment: string;     // 보충 요청 코멘트
    };
  }
  ```

## Requirement: REQ-005 - Asana 태그 기반 필터링

### Scenario: 이미 처리된 태스크 제외

- **GIVEN** Asana 태스크에 다음 태그 중 하나가 있음
  - `"triaged"`
  - `"needs-more-info"`
  - `"auto-fix-skip"`
- **WHEN** task-analyzer가 대상 태스크를 조회할 때
- **THEN** 해당 태스크는 분석 대상에서 제외되어야 함

### Scenario: 특정 섹션의 태스크만 분석

- **GIVEN** 설정 파일에 `asana.sections.triage`가 `"To Triage"`로 지정됨
- **WHEN** task-analyzer가 대상 태스크를 조회할 때
- **THEN** `"To Triage"` 섹션의 태스크만 조회되어야 함

## Requirement: REQ-006 - 에러 케이스 처리

### Scenario: Asana API 호출 실패

- **GIVEN** Asana API가 응답하지 않거나 인증 오류가 발생함
- **WHEN** task-analyzer가 태스크를 조회할 때
- **THEN** 적절한 에러 메시지와 함께 예외를 throw해야 함
- **AND** 에러 타입은 `AsanaAPIError`여야 함

### Scenario: 태스크 ID가 유효하지 않은 경우

- **GIVEN** 존재하지 않는 Asana 태스크 ID가 입력됨
- **WHEN** task-analyzer가 해당 태스크를 분석하려 할 때
- **THEN** `TaskNotFoundError` 예외를 throw해야 함

## Data Types

```typescript
interface TaskAnalysisResult {
  task_id: string;
  confidence: "high" | "medium" | "low";
  can_auto_convert: boolean;
  reproducibility: "clear" | "partial" | "unclear";
  has_sufficient_info: boolean;
  missing_info: string[];
  identified_files?: string[];
  estimated_component?: string;
  asana_action?: {
    add_tags: string[];
    comment: string;
  };
  analyzed_at: string;  // ISO 8601 timestamp
}

interface AsanaTask {
  id: string;
  name: string;
  notes: string;
  tags: string[];
  section: string;
  custom_fields?: Record<string, any>;
  attachments?: Array<{
    type: string;
    url: string;
  }>;
}
```

## Implementation Notes

1. **재현 가능성 판단 로직**
   - "When", "Steps to reproduce", "재현 단계" 등의 키워드 탐지
   - 번호 매겨진 단계 목록 확인
   - 조건문 (if, when, 만약) 패턴 분석

2. **정보 충분성 체크리스트**
   - [ ] 에러 메시지 또는 스택트레이스
   - [ ] 발생 조건 또는 재현 단계
   - [ ] 기대 동작 vs 실제 동작
   - [ ] 관련 화면/기능 명시

3. **Confidence 계산 알고리즘**
   ```
   score = 0
   if (재현 단계 명확) score += 40
   if (에러 메시지 존재) score += 30
   if (코드 위치 식별 가능) score += 30

   high: score >= 80
   medium: 50 <= score < 80
   low: score < 50
   ```

4. **Missing Info 종류**
   - `"error-message"`: 에러 메시지/스택트레이스 필요
   - `"reproduction-steps"`: 재현 단계 필요
   - `"expected-behavior"`: 기대 동작 명시 필요
   - `"actual-behavior"`: 실제 동작 명시 필요
   - `"context"`: 발생 화면/기능 명시 필요
   - `"text-description"`: 텍스트 설명 필요 (스크린샷만 있는 경우)

## Related Specs

- [common/types](../../common/types/spec.md) - 공통 타입 정의
- [analyzer/code-locator](../code-locator/spec.md) - 코드 위치 탐색
- [analyzer/issue-generator](../issue-generator/spec.md) - GitHub Issue 생성
