---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 12
completed: 0
---

# Common Types 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 4 | 8h |
| 🟡 MEDIUM | 5 | 8h |
| 🟢 LOW | 3 | 4h |
| **합계** | **12** | **20h** |

---

### types-task-001: Issue 및 PullRequest 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
GitHub Issue와 Pull Request를 표현하는 핵심 인터페이스를 정의한다. Issue 인터페이스는 GitHub API 응답 구조와 호환되며, 확장 가능한 interface로 정의한다.

#### 완료 조건
- [ ] `src/common/types/issue.ts` 파일 생성
- [ ] Issue 인터페이스 정의 (id, number, title, body, state, labels, assignees)
- [ ] IssueContext 인터페이스 정의 (파일, 함수, 라인, 컴포넌트)
- [ ] IssueSource 인터페이스 정의 (origin, reference)
- [ ] `src/common/types/pull-request.ts` 파일 생성
- [ ] PullRequest 인터페이스 정의
- [ ] CreatePRParams 타입 정의
- [ ] 모든 인터페이스에 JSDoc 주석 추가

---

### types-task-002: Config 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
도메인별 Config 타입을 별도로 정의하고 최상위 Config에서 조합하는 중첩 구조를 구현한다. 각 도메인(GitHub, Asana, Sentry, Worktree)의 독립적인 설정 관리가 가능하도록 한다.

#### 완료 조건
- [ ] `src/common/types/config.ts` 파일 생성
- [ ] GitHubConfig 인터페이스 정의 (owner, repo, token, branch)
- [ ] AsanaConfig 인터페이스 정의 (workspace_id, project_id, token)
- [ ] SentryConfig 인터페이스 정의 (org, project, auth_token)
- [ ] WorktreeConfig 인터페이스 정의 (base_path, cleanup_policy)
- [ ] 최상위 Config 인터페이스에서 도메인별 Config 조합
- [ ] 필수/선택 필드 구분 (optional 활용)
- [ ] JSDoc 주석으로 각 필드 설명 추가

---

### types-task-003: Result 타입 및 타입 가드 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
TypeScript의 discriminated union 패턴을 사용하여 Result<T, E> 타입을 정의한다. success 필드를 discriminator로 사용하여 타입 가드가 자동으로 작동하도록 한다.

#### 완료 조건
- [ ] `src/common/types/result.ts` 파일 생성
- [ ] Result<T, E> 타입 정의 (success: true/false로 구분)
- [ ] 성공 케이스: { success: true, data: T }
- [ ] 실패 케이스: { success: false, error: E }
- [ ] isSuccess(result) 타입 가드 함수 구현
- [ ] isFailure(result) 타입 가드 함수 구현
- [ ] unwrap(result) 헬퍼 함수 구현 (실패 시 throw)
- [ ] JSDoc 주석으로 사용 예제 추가

---

### types-task-004: Worktree 관련 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
Git Worktree 기능을 추상화하는 타입을 정의한다. WorktreeInfo는 현재 상태를 표현하고, WorktreeAction은 가능한 작업을 표현한다.

#### 완료 조건
- [ ] `src/common/types/worktree.ts` 파일 생성
- [ ] WorktreeInfo 인터페이스 정의 (path, branch, is_main, issue_number)
- [ ] WorktreeAction 타입 정의 (create, switch, remove 유니온)
- [ ] CreateWorktreeParams 인터페이스 정의
- [ ] SwitchWorktreeParams 인터페이스 정의
- [ ] RemoveWorktreeParams 인터페이스 정의
- [ ] JSDoc 주석 추가

---

### types-task-005: Check 타입 정의

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** types-task-003 (Result 타입)

#### 설명
코드 체크(lint, test, build) 결과를 표현하는 타입을 정의한다. CheckResult는 Result 타입을 활용하여 성공/실패를 명확히 구분한다.

#### 완료 조건
- [ ] `src/common/types/check.ts` 파일 생성
- [ ] CheckType 타입 정의 ("lint" | "test" | "build")
- [ ] SingleCheckResult 인터페이스 정의 (type, passed, output, duration)
- [ ] CheckResult 타입 정의 (Result<SingleCheckResult[], CheckFailure> 활용)
- [ ] CheckFailure 인터페이스 정의 (failed_checks, summary)
- [ ] JSDoc 주석 추가

---

### types-task-006: IssueGroup 타입 정의

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** types-task-001 (Issue 타입)

#### 설명
여러 Issue를 그룹화하여 관리하는 타입을 정의한다. 파일, 함수, 컴포넌트 등 다양한 기준으로 그룹핑할 수 있도록 한다.

#### 완료 조건
- [ ] `src/common/types/issue-group.ts` 파일 생성
- [ ] GroupBy 타입 정의 ("file" | "function" | "component" | "error_type")
- [ ] IssueGroup 인터페이스 정의 (key, criteria, issues, priority)
- [ ] GroupPriority 타입 정의 ("high" | "medium" | "low")
- [ ] IssueGroupResult 인터페이스 정의 (groups, total_issues, grouped_by)
- [ ] JSDoc 주석 추가

---

### types-task-007: 배럴 파일 생성 및 re-export

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** types-task-001~006 (모든 타입 정의)

#### 설명
모든 타입을 하나의 진입점에서 import할 수 있도록 배럴 파일을 작성한다. 네임스페이스 충돌을 방지하고 import 경로를 단순화한다.

#### 완료 조건
- [ ] `src/common/types/index.ts` 파일 생성
- [ ] 모든 타입 파일 re-export
- [ ] 네임스페이스 그룹핑 (예: export * as IssueTypes from './issue')
- [ ] 주요 타입은 named export로 직접 노출
- [ ] 파일 상단에 모듈 개요 JSDoc 주석 추가

---

### types-task-008: JSDoc 문서화 - Issue 및 Config

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** types-task-001, types-task-002

#### 설명
Issue와 Config 관련 타입에 상세한 JSDoc 주석을 추가하여 IDE 자동완성과 타입 힌트를 개선한다. 사용 예제를 포함한다.

#### 완료 조건
- [ ] Issue 인터페이스에 각 필드 설명 추가
- [ ] IssueContext 사용 예제 JSDoc 추가
- [ ] Config 인터페이스에 각 도메인 설명 추가
- [ ] GitHubConfig 필드별 설명 및 예제 값 추가
- [ ] AsanaConfig, SentryConfig도 동일하게 문서화
- [ ] 선택 필드(optional)에 대한 기본값 설명

---

### types-task-009: JSDoc 문서화 - Result 및 Worktree

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** types-task-003, types-task-004

#### 설명
Result 타입과 Worktree 타입에 사용 예제가 포함된 JSDoc을 추가한다. 특히 Result 타입의 타입 가드 활용법을 명확히 설명한다.

#### 완료 조건
- [ ] Result 타입에 Rust Result 패턴 설명 추가
- [ ] isSuccess, isFailure 타입 가드 사용 예제
- [ ] unwrap 함수의 주의사항 문서화
- [ ] WorktreeInfo 필드별 설명 추가
- [ ] WorktreeAction 각 액션별 사용 시나리오 설명
- [ ] CreateWorktreeParams 예제 추가

---

### types-task-010: 타입 테스트 파일 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** types-task-001~006 (모든 타입 정의)

#### 설명
TypeScript 컴파일러를 활용한 타입 레벨 테스트를 작성한다. @ts-expect-error를 사용하여 잘못된 타입 사용을 검증한다.

#### 완료 조건
- [ ] `tests/common/types/type-tests.ts` 파일 생성
- [ ] Result 타입의 타입 가드 동작 검증
- [ ] Config 타입의 필수 필드 검증
- [ ] @ts-expect-error로 잘못된 할당 테스트
- [ ] 타입 추론 정확성 테스트 (typeof, ReturnType 등)
- [ ] 컴파일 통과 확인

---

### types-task-011: README 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** types-task-001~007 (모든 타입 구현)

#### 설명
Common Types 모듈의 사용 가이드 문서를 작성한다. 각 타입의 목적, 사용법, 예제 코드를 포함한다.

#### 완료 조건
- [ ] `src/common/types/README.md` 파일 생성
- [ ] 모듈 개요 및 목적 설명
- [ ] 주요 타입별 설명 및 예제 코드
- [ ] Result 패턴 사용법 가이드
- [ ] Config 구조 설명 및 예제
- [ ] IssueContext를 활용한 Issue 파싱 예제
- [ ] 타입 확장 가이드 (새 도메인 Config 추가 등)

---

### types-task-012: 타입 검증 통합 테스트

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** types-task-001~007, types-task-010

#### 설명
실제 사용 시나리오를 시뮬레이션하여 타입 정의의 정확성을 검증한다. Config 로딩, Result 에러 핸들링 등을 테스트한다.

#### 완료 조건
- [ ] `tests/common/types/integration.test.ts` 파일 생성
- [ ] Config 타입으로 설정 로딩 시뮬레이션
- [ ] Result 타입으로 에러 핸들링 시뮬레이션
- [ ] Issue 타입과 IssueContext 연동 테스트
- [ ] WorktreeAction별 파라미터 검증
- [ ] 모든 테스트 통과 확인
