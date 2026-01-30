---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Manage Worktree 구현 계획

## 기술 결정

### 결정 1: Git Worktree 명령어 래퍼 구현
**선택:** Node.js의 `child_process.exec`을 사용하여 git worktree 명령어를 직접 실행
**근거:**
- Git worktree는 네이티브 Git 명령어로 안정적이고 성능이 좋음
- Node.js 라이브러리(simple-git 등)보다 직접 제어가 용이
- 에러 메시지를 직접 파싱하여 더 명확한 에러 처리 가능
- 추가 의존성 없이 구현 가능

### 결정 2: Worktree 경로 구조
**선택:** 프로젝트 루트 디렉토리 외부의 `../worktrees/` 디렉토리에 생성
**근거:**
- 메인 레포지토리와 격리되어 안전성 보장
- 디렉토리 충돌 방지
- Worktree는 일시적이므로 `.gitignore` 관리 불필요
- 병렬 처리 시 서로 간섭하지 않음

### 결정 3: 브랜치명 자동 생성 규칙
**선택:** `fix/issue-{number}` 또는 `fix/issue-{n1}-{n2}-{n3}` 패턴 사용
**근거:**
- 브랜치명에서 이슈 번호를 명확히 식별 가능
- GitHub의 자동 링크 기능 활용 가능
- 여러 이슈 그룹화 시에도 일관성 유지
- 슬래시(/)로 브랜치 네임스페이스 구분

### 결정 4: 병렬 처리 제한 방식
**선택:** 메모리 기반 카운터와 worktree list 조회 조합
**근거:**
- `git worktree list` 명령으로 실제 생성된 worktree 확인
- 최대 3개 제한으로 시스템 자원 보호
- 간단한 구현으로 충분히 안전함
- 추후 환경 변수나 설정 파일로 확장 가능

### 결정 5: 에러 처리 전략
**선택:** 모든 Git 명령어 실행 후 stdout/stderr 파싱 및 구조화된 에러 반환
**근거:**
- Git 명령어의 exit code만으로는 정확한 원인 파악 어려움
- 사용자에게 명확한 에러 메시지 전달 필요
- 재시도 가능 여부 판단에 필요
- 디버깅 및 로깅 용이

## 구현 단계

### Step 1: 기본 인터페이스 및 타입 정의
**산출물:**
- [ ] `ManageWorktreeParams` 인터페이스 정의
- [ ] `ManageWorktreeResult` 인터페이스 정의
- [ ] `WorktreeInfo` 인터페이스 정의
- [ ] 파라미터 검증 함수 구현

**상세:**
- TypeScript로 타입 안전성 보장
- Zod 또는 joi를 사용한 런타임 검증
- 에러 메시지 상수 정의

### Step 2: Git Worktree 생성 기능
**산출물:**
- [ ] `createWorktree()` 함수 구현
- [ ] 브랜치명 생성 로직 구현 (`generateBranchName()`)
- [ ] Worktree 경로 생성 로직 구현 (`generateWorktreePath()`)
- [ ] 중복 브랜치 체크 기능
- [ ] 병렬 처리 제한 검증

**상세:**
```typescript
async function createWorktree(
  issues: number[],
  branchName?: string
): Promise<ManageWorktreeResult> {
  // 1. 병렬 처리 제한 체크
  // 2. 브랜치명 생성 또는 검증
  // 3. Worktree 경로 생성
  // 4. git worktree add 실행
  // 5. 결과 반환
}
```

### Step 3: Git Worktree 정리 기능
**산출물:**
- [ ] `cleanupWorktree()` 함수 구현
- [ ] Worktree 존재 확인 로직
- [ ] 안전한 삭제 처리 (브랜치 보존)

**상세:**
```typescript
async function cleanupWorktree(
  issues: number[]
): Promise<ManageWorktreeResult> {
  // 1. Worktree 경로 계산
  // 2. Worktree 존재 확인
  // 3. git worktree remove 실행
  // 4. 성공/실패 반환 (실패해도 에러 아님)
}
```

### Step 4: Git Worktree 목록 조회 기능
**산출물:**
- [ ] `listWorktrees()` 함수 구현
- [ ] `git worktree list` 출력 파싱 로직
- [ ] Issue 번호 추출 로직 (브랜치명에서)

**상세:**
```typescript
async function listWorktrees(): Promise<ManageWorktreeResult> {
  // 1. git worktree list --porcelain 실행
  // 2. 출력 파싱하여 WorktreeInfo[] 생성
  // 3. 브랜치명에서 이슈 번호 추출
  // 4. 결과 반환
}
```

### Step 5: 통합 및 메인 함수 구현
**산출물:**
- [ ] `manageWorktree()` 메인 함수 구현
- [ ] Action 타입별 라우팅
- [ ] 공통 에러 처리 로직
- [ ] 로깅 추가

**상세:**
```typescript
async function manageWorktree(
  params: ManageWorktreeParams
): Promise<ManageWorktreeResult> {
  // 파라미터 검증
  validateParams(params);

  // Action별 분기
  switch (params.action) {
    case "create":
      return createWorktree(params.issues!, params.branch_name);
    case "cleanup":
      return cleanupWorktree(params.issues!);
    case "list":
      return listWorktrees();
  }
}
```

### Step 6: 테스트 작성
**산출물:**
- [ ] 단위 테스트 (각 함수별)
- [ ] 통합 테스트 (실제 Git 명령 실행)
- [ ] 에러 케이스 테스트
- [ ] 병렬 처리 제한 테스트

**테스트 시나리오:**
- Worktree 생성 성공
- 중복 브랜치 에러
- 최대 병렬 수 초과 에러
- Worktree 정리 성공
- 존재하지 않는 Worktree 정리 (성공)
- Worktree 목록 조회 (빈 목록 포함)

## 테스트 전략

### 단위 테스트
- **도구:** Vitest 또는 Jest
- **대상:**
  - `generateBranchName()`: 브랜치명 생성 규칙 검증
  - `generateWorktreePath()`: 경로 생성 규칙 검증
  - `parseWorktreeList()`: Git 출력 파싱 로직 검증
  - `validateParams()`: 파라미터 검증 로직

### 통합 테스트
- **도구:** 실제 Git 레포지토리 환경
- **전략:**
  1. 임시 Git 레포지토리 생성 (beforeEach)
  2. Worktree 생성/조회/삭제 실행
  3. Git 명령어로 실제 상태 확인
  4. 임시 레포지토리 정리 (afterEach)

### E2E 테스트
- **시나리오:**
  1. 단일 이슈 Worktree 생성 → 작업 → 정리
  2. 다중 이슈 그룹 Worktree 생성 → 작업 → 정리
  3. 병렬 처리 (3개 Worktree 동시 생성)
  4. 최대 병렬 수 초과 시도 (에러 확인)

### 성능 테스트
- Worktree 생성 시간: 2초 이내
- Worktree 삭제 시간: 1초 이내
- 목록 조회 시간: 500ms 이내

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| Git 버전 호환성 문제 | 중 | Git 2.5+ 요구, 설치 가이드 제공 |
| Worktree 경로 충돌 | 중 | 타임스탬프 추가 또는 UUID 사용 고려 |
| 디스크 공간 부족 | 저 | 최대 병렬 수 제한 (3개) |
| Windows 경로 문제 | 중 | path.resolve() 사용, 테스트 커버리지 확보 |
| 브랜치 삭제 정책 불명확 | 저 | 브랜치 유지로 통일, 문서화 |
| 동시 실행 Race Condition | 중 | Worktree 이름에 PID 추가 또는 잠금 메커니즘 |
| Git 명령 실패 시 복구 | 중 | 트랜잭션 로직 없음, 수동 정리 가이드 제공 |

## 의존성

### 내부 의존성
- `common/types`: 공통 타입 정의 (Issue, Config 등)

### 외부 의존성
- Node.js 16+
- Git 2.5+ (worktree 명령 지원)
- TypeScript 4.9+

### 선택적 의존성
- Zod: 런타임 타입 검증 (또는 joi)
- Vitest: 테스트 프레임워크

### 피의존성 (이 모듈을 사용하는 모듈)
- `workflow/code-fix-strategy`: 코드 수정 전 Worktree 생성
- `workflow/orchestrator`: 병렬 이슈 처리 오케스트레이션

## 구현 우선순위

1. **High Priority:** Step 2 (Worktree 생성) - 핵심 기능
2. **High Priority:** Step 3 (Worktree 정리) - 리소스 관리 필수
3. **Medium Priority:** Step 4 (목록 조회) - 디버깅 및 모니터링
4. **Medium Priority:** Step 6 (테스트) - 안정성 확보
5. **Low Priority:** 고급 기능 (경로 충돌 방지 UUID 등)

## 참고 자료

- Git Worktree 공식 문서: https://git-scm.com/docs/git-worktree
- Node.js child_process: https://nodejs.org/api/child_process.html
- 유사 구현 사례: [gh-worktree](https://github.com/topics/git-worktree)
