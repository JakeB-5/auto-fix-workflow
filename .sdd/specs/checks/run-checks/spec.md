---
status: draft
created: 2026-01-30
domain: checks
feature: run-checks
depends: [common/types]
---

# Run Checks

> Worktree 내에서 테스트, 타입체크, 린트 등 품질 검증을 실행

## Requirement: REQ-CHECK-001 - 테스트 실행

코드 변경 후 테스트를 실행하여 정상 동작을 검증해야 한다.

### Scenario: 모든 테스트 통과

- **GIVEN** Worktree 경로와 `checks: ["test"]`가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 테스트가 실행되고 통과 결과가 반환되어야 한다
- **AND** `passed: true`여야 한다

### Scenario: 테스트 실패

- **GIVEN** 실패하는 테스트가 있는 Worktree 경로가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 테스트 실행 결과가 반환되어야 한다
- **AND** `passed: false`여야 한다
- **AND** `error` 필드에 실패 정보가 포함되어야 한다

## Requirement: REQ-CHECK-002 - 타입 체크

TypeScript 타입 검증을 수행해야 한다.

### Scenario: 타입 체크 통과

- **GIVEN** Worktree 경로와 `checks: ["typecheck"]`가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 타입 체크가 실행되고 통과 결과가 반환되어야 한다

### Scenario: 타입 에러 발견

- **GIVEN** 타입 에러가 있는 코드가 포함된 Worktree 경로가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 타입 체크 실패 결과가 반환되어야 한다
- **AND** 에러 메시지에 파일명과 라인 번호가 포함되어야 한다

## Requirement: REQ-CHECK-003 - 린트 검사

코드 스타일 및 품질 규칙을 검사해야 한다.

### Scenario: 린트 규칙 통과

- **GIVEN** Worktree 경로와 `checks: ["lint"]`가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 린트 검사가 실행되고 통과 결과가 반환되어야 한다

### Scenario: 린트 규칙 위반

- **GIVEN** 린트 규칙을 위반하는 코드가 있는 Worktree 경로가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 린트 검사 실패 결과가 반환되어야 한다
- **AND** 위반 항목 정보가 `output` 필드에 포함되어야 한다

## Requirement: REQ-CHECK-004 - 복합 체크 실행

여러 체크를 한 번에 실행할 수 있어야 한다.

### Scenario: 모든 체크 통과

- **GIVEN** Worktree 경로와 `checks: ["test", "typecheck", "lint"]`가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 모든 체크가 순차적으로 실행되어야 한다
- **AND** 전체 결과는 `passed: true`여야 한다
- **AND** 각 체크별 결과가 `results` 배열에 포함되어야 한다

### Scenario: 일부 체크 실패

- **GIVEN** Worktree 경로와 여러 체크가 주어지고
- **WHEN** 그 중 일부 체크가 실패하면
- **THEN** 전체 결과는 `passed: false`여야 한다
- **AND** 실패한 체크의 결과만 `passed: false`로 표시되어야 한다
- **AND** 성공한 체크는 `passed: true`를 유지해야 한다

## Requirement: REQ-CHECK-005 - 체크 실패 시 조기 종료

첫 번째 실패 시 나머지 체크를 건너뛸 수 있어야 한다.

### Scenario: 조기 종료 (기본 동작)

- **GIVEN** Worktree 경로와 여러 체크가 주어지고
- **WHEN** 첫 번째 체크가 실패하면
- **THEN** 즉시 실패 결과를 반환해야 한다
- **AND** 나머지 체크는 실행되지 않아야 한다

## Requirement: REQ-CHECK-006 - 존재하지 않는 Worktree 처리

유효하지 않은 Worktree 경로에 대한 에러 처리가 되어야 한다.

### Scenario: 존재하지 않는 경로

- **GIVEN** 존재하지 않는 Worktree 경로가 주어지고
- **WHEN** `run_checks`를 호출하면
- **THEN** 에러가 반환되어야 한다
- **AND** `passed: false`여야 한다
- **AND** `error` 필드에 "Worktree not found" 메시지가 포함되어야 한다

## Requirement: REQ-CHECK-007 - 재시도 로직

체크 실패 시 최대 3회까지 재시도할 수 있어야 한다(SHALL).

### Scenario: 첫 번째 시도 성공

- **GIVEN** Worktree 경로와 체크가 주어지고
- **WHEN** 첫 번째 시도에서 모든 체크가 통과하면
- **THEN** 즉시 성공 결과를 반환해야 한다(SHALL)
- **AND** `attempt: 1`이 결과에 포함되어야 한다

### Scenario: 재시도 후 성공

- **GIVEN** Worktree 경로와 체크가 주어지고
- **WHEN** 첫 번째 시도에서 실패하고
- **AND** 코드 수정 후 두 번째 시도에서 성공하면
- **THEN** 성공 결과를 반환해야 한다(SHALL)
- **AND** `attempt: 2`가 결과에 포함되어야 한다

### Scenario: 최대 재시도 초과

- **GIVEN** Worktree 경로와 체크가 주어지고
- **WHEN** 3회 시도 모두 실패하면
- **THEN** 최종 실패 결과를 반환해야 한다(SHALL)
- **AND** `attempt: 3`이 결과에 포함되어야 한다
- **AND** `max_retries_exceeded: true`가 포함되어야 한다

### Scenario: 재시도 간 에러 분석

- **GIVEN** 체크가 실패했을 때
- **WHEN** 재시도 전에
- **THEN** 이전 시도의 에러 정보가 분석 가능해야 한다(SHALL)
- **AND** `previous_errors` 배열에 이전 시도 에러가 누적되어야 한다

---

## Data Types

### RunChecksParams

```typescript
interface RunChecksParams {
  worktree_path: string;
  checks: ("test" | "typecheck" | "lint")[];
}
```

**Constraints:**
- `worktree_path`는 MUST be a valid absolute path
- `checks`는 MUST contain at least one check type
- `checks`의 각 요소는 MUST be one of: "test", "typecheck", "lint"
- `checks`는 SHOULD NOT contain duplicates

### RunChecksResult

```typescript
interface RunChecksResult {
  passed: boolean;
  results: CheckResult[];
  attempt: number;                    // 현재 시도 횟수 (1-3)
  max_retries_exceeded?: boolean;     // 최대 재시도 초과 여부
  previous_errors?: PreviousError[];  // 이전 시도 에러 (재시도 시)
}

interface CheckResult {
  check: "test" | "typecheck" | "lint";
  passed: boolean;
  output?: string;
  error?: string;
  duration_ms?: number;               // 실행 시간 (밀리초)
}

interface PreviousError {
  attempt: number;
  check: string;
  error: string;
  timestamp: string;
}
```

**Constraints:**
- `passed`는 MUST be `true` only if all checks passed
- `results`는 MUST contain one entry per check executed
- `CheckResult.check`은 MUST match the requested check type
- `CheckResult.output`은 성공 시 SHOULD contain command output
- `CheckResult.error`는 실패 시 MUST contain error details
- `attempt`는 MUST be between 1 and 3 (Constitution: 최대 3회 재시도)
- `max_retries_exceeded`는 MUST be `true` when attempt is 3 and still failing

## Implementation Notes

### 체크 명령어 매핑

- `test`: `pnpm test` 또는 `npm test`
- `typecheck`: `pnpm type-check` 또는 `tsc --noEmit`
- `lint`: `pnpm lint` 또는 `eslint .`

### 실행 순서

1. `typecheck` (빠른 피드백)
2. `lint` (중간 속도)
3. `test` (가장 느림)

### 타임아웃 설정

- `typecheck`: 60초
- `lint`: 120초
- `test`: 300초 (5분)

### 출력 포맷

- 성공 시: 간단한 요약만 포함
- 실패 시: 전체 에러 로그 포함 (최대 5000자)
