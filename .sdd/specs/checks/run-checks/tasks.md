---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 9
completed: 0
---

# Run Checks 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|-----------|
| 🔴 HIGH | 4 | 8h |
| 🟡 MEDIUM | 4 | 8h |
| 🟢 LOW | 1 | 2h |

---

### run-checks-task-001: 기본 인터페이스 및 타입 정의

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
체크 실행에 필요한 TypeScript 타입 및 인터페이스 정의.

#### 완료 조건
- [ ] `RunChecksParams` 인터페이스 정의 (worktree_path, checks, max_retry)
- [ ] `RunChecksResult` 인터페이스 정의 (passed, results, attempt, previous_errors)
- [ ] `CheckResult` 인터페이스 정의 (check, passed, output, error, duration_ms)
- [ ] `PreviousError` 인터페이스 정의 (attempt, check, error, timestamp)
- [ ] `CheckType` union 타입 정의 ("test" | "typecheck" | "lint")
- [ ] 파라미터 검증 함수 구현 (Zod 사용)

---

### run-checks-task-002: Package Manager 감지 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** run-checks-task-001

#### 설명
프로젝트의 lockfile을 기반으로 사용 중인 package manager를 자동 감지.

#### 완료 조건
- [ ] `detectPackageManager()` 함수 구현
- [ ] pnpm-lock.yaml 존재 확인 → pnpm 반환
- [ ] yarn.lock 존재 확인 → yarn 반환
- [ ] 기본값 npm 반환 (폴백)
- [ ] fs.readdir 사용하여 파일 목록 조회
- [ ] 단위 테스트 작성 (각 PM별 시나리오)

---

### run-checks-task-003: 체크 명령어 매핑 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** run-checks-task-002

#### 설명
package.json의 scripts를 확인하고 적절한 체크 명령어를 생성.

#### 완료 조건
- [ ] `getCheckCommand()` 함수 구현
- [ ] package.json 읽기 및 파싱
- [ ] 체크 타입별 스크립트 우선순위 정의 (test: ["test", "test:ci"])
- [ ] 스크립트 존재 시 `${pm} run ${script}` 반환
- [ ] 스크립트 미존재 시 폴백 명령어 반환 (tsc --noEmit, eslint .)
- [ ] 명령어 배열 반환 (spawn에 사용)
- [ ] 단위 테스트 작성

---

### run-checks-task-004: 체크 명령어 실행 엔진 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** run-checks-task-003

#### 설명
child_process.spawn을 사용한 체크 명령어 실행 및 결과 캡처.

#### 완료 조건
- [ ] `executeCheck()` 함수 구현
- [ ] spawn으로 프로세스 실행
- [ ] stdout/stderr 스트리밍 캡처
- [ ] 타임아웃 설정 (typecheck: 60s, lint: 120s, test: 300s)
- [ ] 실행 시간 측정 (Date.now() 사용)
- [ ] 종료 코드 확인 (exit code 0 = passed)
- [ ] CheckResult 객체 반환
- [ ] 에러 처리 (프로세스 크래시, 타임아웃)

---

### run-checks-task-005: 재시도 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** run-checks-task-004

#### 설명
Flaky test 대응을 위한 재시도 메커니즘 및 이전 에러 누적.

#### 완료 조건
- [ ] `runChecksWithRetry()` 함수 구현
- [ ] 최대 재시도 횟수 파라미터 (기본값 3)
- [ ] 각 시도마다 전체 체크 실행
- [ ] 성공 시 즉시 반환 (attempt, previous_errors 포함)
- [ ] 실패 시 PreviousError 객체 생성 및 누적
- [ ] 최대 재시도 초과 시 max_retries_exceeded: true 반환
- [ ] 단위 테스트 작성 (1회 성공, 2회 재시도 후 성공, 최종 실패)

---

### run-checks-task-006: 메인 함수 및 체크 순서 관리 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** run-checks-task-005

#### 설명
체크 순서 정렬 및 조기 종료 로직을 포함한 메인 함수 구현.

#### 완료 조건
- [ ] `runChecks()` 메인 함수 구현
- [ ] Worktree 경로 존재 확인 (fs.access)
- [ ] Package Manager 감지 호출
- [ ] 체크 순서 정렬 (typecheck → lint → test)
- [ ] 각 체크 순차 실행 (조기 종료: 실패 시 즉시 중단)
- [ ] RunChecksResult 반환
- [ ] 로깅 추가 (각 체크 시작/종료)
- [ ] 통합 테스트 작성

---

### run-checks-task-007: 출력 로그 처리 및 포맷팅 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** run-checks-task-006

#### 설명
성공/실패 시나리오별 로그 처리 및 길이 제한 적용.

#### 완료 조건
- [ ] `truncateOutput()` 함수 구현 (최대 5000자)
- [ ] 성공 시 요약만 반환 (예: "✓ 12 tests passed in 2.3s")
- [ ] 실패 시 전체 로그 반환 (스택 트레이스 포함)
- [ ] 5000자 초과 시 "... (output truncated)" 메시지 추가
- [ ] ANSI 색상 코드 제거 (GitHub 이슈 코멘트용)
- [ ] 단위 테스트 작성

---

### run-checks-task-008: Mock 테스트 및 에러 케이스 작성

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** run-checks-task-007

#### 설명
child_process를 Mock하여 다양한 시나리오 테스트.

#### 완료 조건
- [ ] vitest.mock을 사용한 child_process Mock 설정
- [ ] 성공 시나리오 테스트 (exit code 0)
- [ ] 실패 시나리오 테스트 (exit code 1, stderr 있음)
- [ ] 타임아웃 시나리오 테스트
- [ ] 프로세스 크래시 시나리오 테스트
- [ ] Windows/Linux 경로 차이 테스트
- [ ] 모든 테스트 통과

---

### run-checks-task-009: E2E 테스트 및 성능 검증

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** run-checks-task-008

#### 설명
실제 Worktree 환경에서 전체 플로우 검증 및 성능 테스트.

#### 완료 조건
- [ ] 테스트용 Worktree 생성 (beforeEach)
- [ ] 의도적 타입 에러 코드 작성 → typecheck 실패 확인
- [ ] 의도적 린트 에러 코드 작성 → lint 실패 확인
- [ ] 의도적 테스트 실패 코드 작성 → test 실패 확인
- [ ] 모든 체크 통과 시나리오 검증
- [ ] 재시도 로직 검증 (flaky test 시뮬레이션)
- [ ] 성능 측정 (typecheck <60s, lint <120s, test <300s)
- [ ] Worktree 정리 (afterEach)
