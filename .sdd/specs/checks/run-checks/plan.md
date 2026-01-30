---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Run Checks 구현 계획

## 기술 결정

### 결정 1: 체크 명령어 실행 방식
**선택:** Node.js `child_process.spawn`을 사용하여 package.json 스크립트 실행
**근거:**
- 프로젝트별 설정된 스크립트를 그대로 활용 가능
- 실시간 출력 스트리밍으로 긴 테스트도 타임아웃 방지
- stderr와 stdout 분리 캡처 가능
- 프로세스 종료 코드로 성공/실패 명확히 판단

### 결정 2: 체크 실행 순서
**선택:** typecheck → lint → test 순서로 고정
**근거:**
- 빠른 피드백 우선 (typecheck가 가장 빠름)
- 린트는 타입 에러 수정 후 의미 있음
- 테스트는 가장 느리므로 마지막
- 조기 종료 시 사용자 대기 시간 최소화

### 결정 3: 재시도 메커니즘
**선택:** 최대 3회 재시도, 각 시도마다 이전 에러 정보 누적
**근거:**
- Flaky test 대응 (1회 실패가 진짜 실패가 아닐 수 있음)
- 네트워크 의존적 테스트 (npm registry 타임아웃 등)
- 이전 에러 분석으로 더 나은 수정 가능
- 3회는 합리적인 균형점 (너무 많으면 시간 낭비)

### 결정 4: 타임아웃 설정
**선택:** typecheck 60초, lint 120초, test 300초
**근거:**
- TypeScript 타입 체크는 보통 30초 내외 (여유 두배)
- Lint는 대규모 프로젝트도 60초면 충분 (여유 두배)
- Test는 E2E 포함 시 오래 걸릴 수 있음 (여유 5분)
- 타임아웃 초과 시 명확한 에러 메시지

### 결정 5: 출력 로그 처리
**선택:** 성공 시 요약만, 실패 시 전체 로그 (최대 5000자)
**근거:**
- 성공 시 전체 로그는 불필요하고 노이즈
- 실패 시 전체 컨텍스트 필요 (스택 트레이스 등)
- 5000자 제한으로 이슈 코멘트 길이 제한 준수
- 너무 긴 로그는 파일 첨부 제안

### 결정 6: Package Manager 자동 감지
**선택:** lockfile 기준으로 pnpm > yarn > npm 순 우선순위
**근거:**
- `pnpm-lock.yaml` 존재 → pnpm 사용
- `yarn.lock` 존재 → yarn 사용
- 그 외 → npm (기본값)
- 프로젝트마다 다른 매니저 사용 가능성 대응

## 구현 단계

### Step 1: 기본 인터페이스 및 타입 정의
**산출물:**
- [ ] `RunChecksParams` 인터페이스 정의
- [ ] `RunChecksResult` 인터페이스 정의
- [ ] `CheckResult` 인터페이스 정의
- [ ] `PreviousError` 인터페이스 정의
- [ ] 파라미터 검증 함수 구현

### Step 2: Package Manager 감지 로직
**산출물:**
- [ ] `detectPackageManager()` 함수 구현
- [ ] lockfile 존재 확인 로직
- [ ] 폴백 메커니즘 (npm)

**상세:**
```typescript
async function detectPackageManager(
  worktreePath: string
): Promise<"pnpm" | "yarn" | "npm"> {
  const files = await fs.readdir(worktreePath);

  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  return "npm";
}
```

### Step 3: 체크 명령어 실행 엔진
**산출물:**
- [ ] `executeCheck()` 함수 구현
- [ ] stdout/stderr 캡처 로직
- [ ] 타임아웃 처리
- [ ] 실행 시간 측정

**상세:**
```typescript
async function executeCheck(
  worktreePath: string,
  checkType: "test" | "typecheck" | "lint",
  packageManager: string,
  timeout: number
): Promise<CheckResult> {
  const command = getCheckCommand(checkType, packageManager);
  const startTime = Date.now();

  // spawn으로 실행, stdout/stderr 캡처
  // 타임아웃 설정
  // 종료 코드 확인

  return {
    check: checkType,
    passed: exitCode === 0,
    output: stdout,
    error: stderr,
    duration_ms: Date.now() - startTime
  };
}
```

### Step 4: 체크 명령어 매핑
**산출물:**
- [ ] `getCheckCommand()` 함수 구현
- [ ] package.json 스크립트 확인 로직
- [ ] 폴백 명령어 정의

**상세:**
```typescript
function getCheckCommand(
  checkType: string,
  packageManager: string
): string[] {
  const scripts = {
    test: ["test", "test:ci"],
    typecheck: ["type-check", "typecheck", "tsc --noEmit"],
    lint: ["lint", "eslint ."]
  };

  // package.json에서 스크립트 확인
  // 있으면 `${packageManager} run ${script}` 반환
  // 없으면 폴백 명령어 사용
}
```

### Step 5: 재시도 로직 구현
**산출물:**
- [ ] `runChecksWithRetry()` 함수 구현
- [ ] 이전 에러 누적 로직
- [ ] 재시도 조건 판단
- [ ] 최대 재시도 횟수 체크

**상세:**
```typescript
async function runChecksWithRetry(
  worktreePath: string,
  checks: string[],
  maxRetry: number = 3
): Promise<RunChecksResult> {
  const previousErrors: PreviousError[] = [];

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const results = await runChecks(worktreePath, checks);

    if (results.every(r => r.passed)) {
      return {
        passed: true,
        results,
        attempt,
        previous_errors: previousErrors
      };
    }

    // 실패 에러 기록
    results.filter(r => !r.passed).forEach(r => {
      previousErrors.push({
        attempt,
        check: r.check,
        error: r.error!,
        timestamp: new Date().toISOString()
      });
    });
  }

  // 최대 재시도 초과
  return {
    passed: false,
    results: lastResults,
    attempt: maxRetry,
    max_retries_exceeded: true,
    previous_errors: previousErrors
  };
}
```

### Step 6: 메인 함수 구현
**산출물:**
- [ ] `runChecks()` 메인 함수 구현
- [ ] Worktree 존재 확인
- [ ] 체크 순서 정렬
- [ ] 조기 종료 로직

**상세:**
```typescript
async function runChecks(
  params: RunChecksParams
): Promise<RunChecksResult> {
  // 1. Worktree 존재 확인
  if (!await exists(params.worktree_path)) {
    return {
      passed: false,
      results: [],
      attempt: 1,
      error: "Worktree not found"
    };
  }

  // 2. Package Manager 감지
  const pm = await detectPackageManager(params.worktree_path);

  // 3. 체크 순서 정렬
  const orderedChecks = sortChecks(params.checks);

  // 4. 각 체크 실행 (조기 종료)
  const results: CheckResult[] = [];
  for (const check of orderedChecks) {
    const result = await executeCheck(
      params.worktree_path,
      check,
      pm,
      TIMEOUTS[check]
    );

    results.push(result);

    if (!result.passed) {
      // 조기 종료
      break;
    }
  }

  return {
    passed: results.every(r => r.passed),
    results,
    attempt: 1
  };
}
```

### Step 7: 테스트 작성
**산출물:**
- [ ] 단위 테스트 (명령어 생성, PM 감지 등)
- [ ] 통합 테스트 (실제 명령 실행)
- [ ] 재시도 로직 테스트
- [ ] 타임아웃 테스트
- [ ] 에러 케이스 테스트

## 테스트 전략

### 단위 테스트
- **도구:** Vitest
- **대상:**
  - `detectPackageManager()`: lockfile 감지 로직
  - `getCheckCommand()`: 명령어 매핑 정확성
  - `sortChecks()`: 체크 순서 정렬
  - `truncateOutput()`: 출력 길이 제한

### 통합 테스트
- **도구:** 실제 Worktree 환경
- **전략:**
  1. 테스트용 Worktree 생성 (beforeEach)
  2. 의도적으로 실패하는 코드 작성
  3. 체크 실행 및 결과 검증
  4. Worktree 정리 (afterEach)

### Mock 테스트
- **대상:** child_process.spawn
- **시나리오:**
  - 성공 시나리오 (exit code 0)
  - 실패 시나리오 (exit code 1)
  - 타임아웃 시나리오
  - 프로세스 크래시 시나리오

### E2E 테스트
- **시나리오:**
  1. 모든 체크 통과
  2. typecheck 실패 → 조기 종료
  3. test 실패 → 재시도 → 성공
  4. 3회 재시도 모두 실패

### 성능 테스트
- Typecheck: 60초 이내 완료
- Lint: 120초 이내 완료
- Test: 300초 이내 완료
- 재시도 오버헤드: 각 시도마다 1초 미만 추가

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| Flaky test로 인한 무한 재시도 | 중 | 최대 3회 제한, 이전 에러 분석 |
| 타임아웃 설정이 짧아 정상 테스트도 실패 | 중 | 타임아웃 설정 문서화, 환경 변수로 조정 가능하게 |
| Package.json 스크립트 미존재 | 중 | 폴백 명령어 제공, 명확한 에러 메시지 |
| 출력 로그가 너무 길어 이슈 코멘트 초과 | 저 | 5000자 제한, 파일 첨부 제안 |
| Windows/Linux 명령어 차이 | 중 | cross-platform 명령어 사용, CI에서 양쪽 테스트 |
| 네트워크 의존적 테스트 (npm install) | 중 | dependencies 설치 여부 확인, 캐싱 |
| 동시 실행 시 포트 충돌 | 저 | Worktree별 격리, 랜덤 포트 사용 권장 |

## 의존성

### 내부 의존성
- `common/types`: 공통 타입 정의
- `git/manage-worktree`: Worktree 경로 정보

### 외부 의존성
- Node.js 16+
- Package Manager: pnpm, yarn, 또는 npm

### 선택적 의존성
- Zod: 파라미터 검증
- execa: child_process 래퍼 (더 나은 에러 처리)

### 피의존성
- `workflow/code-fix-strategy`: 코드 수정 후 검증
- `workflow/orchestrator`: 자동화 워크플로우 통합

## 구현 우선순위

1. **High Priority:** Step 3 (체크 실행 엔진) - 핵심 기능
2. **High Priority:** Step 6 (메인 함수) - 통합
3. **Medium Priority:** Step 5 (재시도 로직) - 안정성
4. **Medium Priority:** Step 2 (PM 감지) - 호환성
5. **Low Priority:** 고급 기능 (커스텀 타임아웃, 병렬 실행 등)

## 구현 세부사항

### 체크 명령어 폴백 테이블

| Check Type | Script Name (우선순위) | Fallback Command |
|------------|------------------------|------------------|
| test | test, test:ci | `${pm} test` |
| typecheck | type-check, typecheck | `tsc --noEmit` |
| lint | lint | `eslint .` |

### 타임아웃 설정 상수

```typescript
const TIMEOUTS = {
  typecheck: 60_000,  // 60초
  lint: 120_000,       // 120초
  test: 300_000        // 300초
} as const;
```

### 출력 로그 처리

```typescript
function truncateOutput(output: string, maxLength: number = 5000): string {
  if (output.length <= maxLength) {
    return output;
  }

  return output.slice(0, maxLength) +
    "\n\n... (output truncated, see full logs in CI)";
}
```

## 참고 자료

- Node.js child_process: https://nodejs.org/api/child_process.html
- execa library: https://github.com/sindresorhus/execa
- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- ESLint Node.js API: https://eslint.org/docs/latest/integrate/nodejs-api
