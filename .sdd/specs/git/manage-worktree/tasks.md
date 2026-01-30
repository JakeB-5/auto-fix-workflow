---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 8
completed: 0
---

# Manage Worktree 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|-----------|
| 🔴 HIGH | 3 | 6h |
| 🟡 MEDIUM | 3 | 6h |
| 🟢 LOW | 2 | 4h |

---

### manage-worktree-task-001: 기본 인터페이스 및 타입 정의

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
TypeScript 타입 시스템을 활용한 안전한 인터페이스 정의 및 런타임 파라미터 검증 구현.

#### 완료 조건
- [ ] `ManageWorktreeParams` 인터페이스 정의 (action, issues, branch_name 필드)
- [ ] `ManageWorktreeResult` 인터페이스 정의 (success, worktree_path, branch, error 필드)
- [ ] `WorktreeInfo` 인터페이스 정의 (path, branch, issues 필드)
- [ ] Zod 스키마를 사용한 파라미터 검증 함수 구현
- [ ] 에러 메시지 상수 정의 (ERRORS 객체)
- [ ] 타입 정의 파일 생성 및 export

---

### manage-worktree-task-002: Git Worktree 생성 기능 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** manage-worktree-task-001

#### 설명
핵심 기능인 Git Worktree 생성 로직 구현. 브랜치명 생성, 경로 설정, git 명령어 실행 포함.

#### 완료 조건
- [ ] `generateBranchName()` 함수 구현 (fix/issue-{n} 또는 fix/issue-{n1}-{n2} 패턴)
- [ ] `generateWorktreePath()` 함수 구현 (../worktrees/{branch-name} 경로)
- [ ] `createWorktree()` 함수 구현 (child_process.exec 사용)
- [ ] 중복 브랜치명 체크 로직 (git branch --list)
- [ ] 병렬 처리 제한 검증 (git worktree list로 현재 개수 확인, 최대 3개)
- [ ] stdout/stderr 파싱 및 구조화된 에러 처리
- [ ] 생성 성공 시 WorktreeInfo 반환

---

### manage-worktree-task-003: Git Worktree 정리 기능 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** manage-worktree-task-002

#### 설명
리소스 관리를 위한 Worktree 정리 기능. 브랜치는 보존하고 Worktree만 제거.

#### 완료 조건
- [ ] `cleanupWorktree()` 함수 구현
- [ ] Worktree 존재 확인 로직 (git worktree list --porcelain 파싱)
- [ ] `git worktree remove` 명령어 실행
- [ ] 브랜치 보존 처리 (브랜치는 삭제하지 않음)
- [ ] Worktree 미존재 시에도 성공으로 처리 (idempotent)
- [ ] 에러 발생 시 명확한 에러 메시지 반환

---

### manage-worktree-task-004: Git Worktree 목록 조회 기능 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** manage-worktree-task-002

#### 설명
디버깅 및 모니터링을 위한 Worktree 목록 조회 기능. 브랜치명에서 이슈 번호 추출.

#### 완료 조건
- [ ] `listWorktrees()` 함수 구현
- [ ] `git worktree list --porcelain` 명령어 실행 및 출력 파싱
- [ ] WorktreeInfo 배열 생성 (path, branch, issues)
- [ ] 브랜치명에서 이슈 번호 추출 정규식 (fix/issue-{n} 패턴 파싱)
- [ ] 빈 목록도 정상적으로 반환
- [ ] 파싱 에러 시 명확한 에러 메시지

---

### manage-worktree-task-005: 통합 및 메인 함수 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** manage-worktree-task-002, manage-worktree-task-003, manage-worktree-task-004

#### 설명
모든 하위 기능을 통합하는 메인 함수 및 action별 라우팅 로직 구현.

#### 완료 조건
- [ ] `manageWorktree()` 메인 함수 구현
- [ ] 파라미터 검증 호출
- [ ] action 타입별 분기 (create, cleanup, list)
- [ ] 공통 에러 처리 로직 (try-catch)
- [ ] 로깅 추가 (각 작업 시작/종료 로그)
- [ ] ManageWorktreeResult 형식으로 통일된 반환값 보장

---

### manage-worktree-task-006: 단위 테스트 작성

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** manage-worktree-task-005

#### 설명
각 함수의 동작을 검증하는 단위 테스트 작성. Git 명령어는 Mock 사용.

#### 완료 조건
- [ ] `generateBranchName()` 테스트 (1개, 2-3개, 4개 이상 이슈)
- [ ] `generateWorktreePath()` 테스트 (경로 생성 규칙)
- [ ] `parseWorktreeList()` 테스트 (git worktree list --porcelain 출력 파싱)
- [ ] `validateParams()` 테스트 (유효/무효 파라미터)
- [ ] child_process Mock 설정 (execSync, exec)
- [ ] 테스트 커버리지 80% 이상

---

### manage-worktree-task-007: 통합 테스트 작성

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** manage-worktree-task-006

#### 설명
실제 Git 레포지토리 환경에서 Worktree 생성/정리/조회 전체 플로우 검증.

#### 완료 조건
- [ ] 임시 Git 레포지토리 생성 (beforeEach)
- [ ] Worktree 생성 테스트 (단일/다중 이슈)
- [ ] Worktree 목록 조회 테스트
- [ ] Worktree 정리 테스트
- [ ] 병렬 처리 제한 테스트 (3개 초과 시도)
- [ ] 중복 브랜치 에러 테스트
- [ ] 임시 레포지토리 정리 (afterEach)
- [ ] 모든 테스트 통과

---

### manage-worktree-task-008: 에러 케이스 및 E2E 테스트 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** manage-worktree-task-007

#### 설명
엣지 케이스 및 전체 워크플로우 시나리오 테스트.

#### 완료 조건
- [ ] Git 미설치 환경 테스트 (에러 메시지 확인)
- [ ] Git 버전 호환성 테스트 (2.5 이상)
- [ ] Windows 경로 테스트 (경로 구분자 처리)
- [ ] 디스크 공간 부족 시뮬레이션 (에러 처리)
- [ ] 동시 실행 race condition 테스트
- [ ] E2E 시나리오: 생성 → 작업 → 정리 전체 플로우
- [ ] 모든 테스트 통과 및 문서화
