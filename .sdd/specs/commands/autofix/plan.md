---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# /autofix 구현 계획

## 기술 결정

### 결정 1: Worktree 기반 병렬 처리
**선택:** Git worktree를 사용하여 각 이슈 그룹을 독립된 작업 공간에서 처리
**근거:**
- 동일 저장소의 다른 브랜치를 동시에 작업 가능
- 브랜치 간 간섭 없이 병렬 처리 가능
- 파일 시스템 수준에서 격리되어 안전
- Git 네이티브 기능으로 안정적

### 결정 2: 이슈 그룹핑 전략
**선택:** Component 기반 그룹핑을 기본 전략으로 사용
**근거:**
- 관련 이슈를 하나의 PR로 통합하여 리뷰 효율성 증대
- 동일 컴포넌트 수정은 테스트 범위가 명확
- 파일 충돌 가능성이 낮음
- 향후 다른 전략(file-based, severity-based) 추가 가능

### 결정 3: Claude AI 기반 자동 수정
**선택:** 각 이슈에 대해 Claude AI가 분석 및 수정을 수행
**근거:**
- 컨텍스트 이해 및 적절한 수정 제안 능력
- 기존 코드 패턴을 학습하여 일관된 스타일 유지
- 복잡한 로직 수정도 가능
- 테스트 실패 시 피드백 루프로 개선

### 결정 4: 테스트 기반 검증
**선택:** 모든 수정은 로컬 테스트 통과를 필수 조건으로 함
**근거:**
- 자동 수정의 정확성 보장
- 회귀 버그 방지
- 테스트 실패 시 재시도 기회 제공
- CI/CD 통과 가능성 극대화

### 결정 5: 자동 PR 생성 및 업데이트
**선택:** 테스트 통과 후 자동으로 PR 생성 및 이슈 업데이트
**근거:**
- 수동 작업 최소화
- 일관된 PR 형식 유지
- 이슈와 PR의 자동 링크
- 진행 상황의 투명성

### 결정 6: 점진적 병렬 처리
**선택:** max_parallel 제한으로 동시 처리 수를 제어
**근거:**
- 시스템 리소스 보호
- API rate limit 준수
- 에러 발생 시 격리 및 복구 용이
- 사용자가 시스템 부하에 맞게 조정 가능

### 결정 7: 상태 추적 및 복구
**선택:** Worktree 상태를 파일에 저장하여 중단 시 복구 가능
**근거:**
- 비정상 종료(Ctrl+C, 시스템 오류) 시 worktree 누수 방지
- 재시작 시 정리 제안으로 깨끗한 상태 유지
- 처리 중인 이슈 상태 복구 가능

## 구현 단계

### Step 1: MCP 도구 구현

#### 1.1 list_issues
**산출물:**
- [ ] GitHub Issues API 연동
  - 라벨 필터: `auto-fix` 포함, `auto-fix-skip` 제외
  - 상태 필터: `state: open`
  - 페이지네이션 처리 (100개씩)
- [ ] 이슈 정보 파싱
  - number, title, labels, body
  - body에서 템플릿 섹션 추출 (Context, Problem Description)
- [ ] 캐싱 및 재시도
  - 동일 요청 중복 방지
  - 네트워크 에러 시 재시도

#### 1.2 group_issues
**산출물:**
- [ ] Component 기반 그룹핑 알고리즘
  - Issue body에서 "컴포넌트" 필드 추출
  - 동일 컴포넌트 이슈 그룹화
  - 컴포넌트 없는 이슈는 개별 그룹
- [ ] 그룹핑 제안 생성
  - 그룹 ID, 이슈 목록, 예상 브랜치명
  - 파일 충돌 가능성 분석 (같은 파일 수정 여부)
- [ ] 대체 전략 지원 (향후 확장)
  - file-based: 동일 파일 수정 이슈
  - severity-based: 우선순위 기반

#### 1.3 manage_worktree
**산출물:**
- [ ] create 액션
  - 브랜치명 생성: `fix/issue-{numbers}-{component}`
  - main 브랜치 기준으로 worktree 생성
  - 경로: `../worktrees/fix-issue-{timestamp}`
- [ ] cleanup 액션
  - Worktree 디렉토리 삭제
  - Git worktree remove
  - 브랜치 삭제 (선택적)
- [ ] 상태 관리
  - 활성 worktree 목록을 JSON 파일에 저장
  - 비정상 종료 시 복구를 위한 메타데이터 저장
- [ ] 에러 처리
  - 디스크 공간 부족
  - 권한 부족
  - 이미 존재하는 브랜치

#### 1.4 run_checks
**산출물:**
- [ ] 설정 기반 체크 실행
  - `autofix.config.yml`에서 체크 명령 로드
  - 기본값: `pnpm test`, `pnpm type-check`, `pnpm lint`
- [ ] 실행 환경 검증
  - package.json 존재 여부
  - pnpm 설치 여부
  - node_modules 존재 여부 (없으면 pnpm install)
- [ ] 출력 파싱
  - 성공/실패 판정
  - 실패 시 에러 로그 수집
  - 테스트 커버리지 정보 (선택적)
- [ ] 타임아웃 및 취소
  - 각 체크별 타임아웃 (5분)
  - 사용자 중단 시 프로세스 종료

#### 1.5 create_pr
**산출물:**
- [ ] PR 메타데이터 생성
  - title: `fix: {component} issues (#{numbers})`
  - body: 자동 생성 템플릿
    - 수정된 이슈 링크
    - 변경 사항 요약 (Claude 생성)
    - 테스트 결과
    - 체크리스트
  - base: `autofixing` 브랜치
  - head: `fix/issue-{numbers}-{component}`
- [ ] GitHub API 호출
  - PR 생성
  - 이슈와 PR 연결 (body에 "Fixes #123" 추가)
  - 라벨 추가: `auto-fix`, `ready-for-review`
- [ ] 실패 처리
  - 중복 PR 감지
  - 권한 부족
  - Merge conflict 감지

#### 1.6 update_issue
**산출물:**
- [ ] 코멘트 추가 기능
  - 진행 상황 업데이트: "🔄 처리 시작"
  - 성공: "✅ PR #{number} 생성"
  - 실패: "❌ 자동 수정 실패: {reason}"
  - 재시도: "🔄 재시도 중 (2/3)"
- [ ] 라벨 관리
  - 추가: `auto-fix-processing`, `auto-fix-failed`
  - 제거: `auto-fix-processing` (완료 시)
- [ ] 멱등성 보장
  - 동일 코멘트 중복 방지
  - 이미 존재하는 라벨 추가 스킵

### Step 2: CLI 파라미터 및 설정

#### 2.1 파라미터 파서
**산출물:**
- [ ] 옵션 정의
  - `--issues`: 쉼표 구분 번호 파싱 → number[]
  - `--all`: boolean 플래그
  - `--dry-run`: boolean 플래그
  - `--max-parallel`: number 파싱 및 검증 (1-10)
- [ ] 검증 로직
  - `--all`과 `--dry-run` 동시 사용 금지
  - `--issues`에 유효하지 않은 번호 감지
  - `--max-parallel` 범위 검증
- [ ] 도움말 생성
  - 사용법 예제
  - 옵션 설명

#### 2.2 설정 로더
**산출물:**
- [ ] `autofix.config.yml` 파싱
  - worktree.max_parallel
  - worktree.base_path
  - github.fix_branch
  - github.labels
  - checks 배열
- [ ] 스키마 검증 (Zod)
  - 필수 필드 체크
  - 타입 검증
  - 기본값 설정
- [ ] 환경 변수 오버라이드
  - GITHUB_TOKEN
  - AUTOFIX_MAX_PARALLEL

### Step 3: 이슈 조회 및 그룹핑

#### 3.1 이슈 조회 로직
**산출물:**
- [ ] 모드별 처리
  - `--issues` 지정: 해당 번호만 조회
  - `--all`: 모든 auto-fix 이슈 조회
  - 기본: 조회 후 사용자 선택
- [ ] 이슈 존재 검증
  - 지정된 번호가 실제로 존재하는지
  - auto-fix 라벨이 없으면 경고
- [ ] 필터링
  - `auto-fix-skip` 라벨 제외
  - closed 이슈 제외

#### 3.2 그룹핑 및 제안
**산출물:**
- [ ] `group_issues` MCP 도구 호출
  - 입력: 조회된 이슈 번호 배열
  - 출력: IssueGroup[] (id, issues[], component, branch_name)
- [ ] 사용자에게 제안 표시
  - 그룹별 이슈 목록
  - 예상 브랜치명
  - 예상 PR 개수
  - 총 처리 시간 추정
- [ ] 확인 프롬프트 (--all 아닌 경우)
  - "모든 이슈 처리" 선택
  - "특정 그룹 선택" 입력
  - "취소"

### Step 4: 병렬 처리 오케스트레이션

#### 4.1 병렬 처리 큐
**산출물:**
- [ ] 큐 매니저 구현
  - 대기 큐: 처리 대기 중인 그룹
  - 활성 큐: 현재 처리 중인 그룹 (max_parallel 제한)
  - 완료 큐: 처리 완료된 그룹 (성공/실패)
- [ ] 스케줄링 로직
  - 활성 슬롯이 비면 다음 그룹 시작
  - 파일 충돌 감지: 같은 파일 수정 그룹은 순차 처리
  - 우선순위: 독립적 그룹 우선
- [ ] 상태 추적
  - 각 그룹의 현재 단계
  - 진행률 계산 (n/total)
  - 예상 남은 시간

#### 4.2 단일 그룹 처리
**산출물:**
- [ ] 처리 파이프라인 구현
  ```typescript
  async function processGroup(group: IssueGroup): Promise<Result> {
    // 1. Worktree 생성
    const worktree = await manage_worktree("create", group.issues);

    // 2. 이슈 코멘트 (시작)
    await update_issue(group.issues[0], "🔄 처리 시작");

    // 3. Claude AI 분석 및 수정
    const fixes = await analyzeAndFixIssues(group.issues, worktree.path);

    // 4. 로컬 테스트
    const checkResult = await run_checks(worktree.path);

    if (checkResult.success) {
      // 5a. PR 생성
      const pr = await create_pr(worktree.branch, group);
      await update_issue(group.issues[0], `✅ PR #${pr.number} 생성`);
      return { success: true, pr };
    } else {
      // 5b. 재시도 (최대 3회)
      return retryWithFeedback(group, checkResult.errors);
    }
  }
  ```
- [ ] Claude AI 분석 프롬프트
  - 이슈 정보 전달 (템플릿 파싱)
  - 코드베이스 컨텍스트 제공
  - 수정 지침 및 제약사항
  - 출력 형식: 파일별 수정 내용
- [ ] 재시도 로직
  - 테스트 실패 로그를 Claude에게 피드백
  - "이전 수정이 이 에러를 발생시켰습니다. 수정해주세요."
  - 최대 3회 재시도
  - 매 시도마다 이슈에 진행 상황 코멘트

#### 4.3 실시간 진행 상황 출력
**산출물:**
- [ ] 멀티라인 진행 상황 UI
  - 각 활성 그룹의 현재 단계 표시
  - 트리 구조 포맷팅 (├──, └──)
  - 진행률 표시 ([1/3], [2/3])
- [ ] 이벤트 기반 업데이트
  - 단계 변경 시 출력 갱신
  - 성공/실패 시 결과 표시
  - 타임스탬프 포함 (선택적)

### Step 5: 에러 처리 및 정리

#### 5.1 에러 카테고리별 처리
**산출물:**
- [ ] GitHub API 에러
  - 재시도 3회 (지수 백오프)
  - rate limit 시 자동 대기
  - 권한 부족: 명확한 메시지 + 필요 권한 안내
- [ ] Worktree 생성 실패
  - 디스크 공간: 경고 + 해당 그룹 스킵
  - 권한 부족: 에러 + 종료
  - 브랜치 충돌: 자동 번호 증가 (fix-issue-123-1, fix-issue-123-2)
- [ ] 테스트 실패
  - 재시도 로직 진입 (최대 3회)
  - 최종 실패: 이슈에 실패 코멘트 + `auto-fix-failed` 라벨
- [ ] 네트워크 에러
  - 재시도 3회
  - 타임아웃 조정

#### 5.2 중단 처리 (Ctrl+C)
**산출물:**
- [ ] 시그널 핸들러 등록
  - SIGINT (Ctrl+C) 감지
  - 새로운 작업 시작 중단
  - 진행 중인 작업 완료 대기
- [ ] 정리 작업
  - 모든 worktree cleanup 호출
  - 처리 중인 이슈에 중단 코멘트
  - `auto-fix-processing` 라벨 제거
  - 상태 파일 삭제
- [ ] 재시작 지원
  - 중단된 이슈 목록 저장
  - 재시작 시 "이전에 중단된 작업이 있습니다. 계속하시겠습니까?" 프롬프트

#### 5.3 자동 정리 메커니즘
**산출물:**
- [ ] Worktree 상태 파일
  - 경로: `.autofix-state.json`
  - 내용: 활성 worktree 경로, 이슈 번호, 시작 시간
- [ ] 시작 시 검증
  - 상태 파일 존재 시 경고
  - "이전 작업이 정리되지 않았습니다. 정리하시겠습니까?"
  - 자동 정리 실행
- [ ] 강제 정리 명령
  - `/autofix cleanup`: 모든 남은 worktree 정리

### Step 6: 결과 출력 및 요약

#### 6.1 요약 리포트 생성
**산출물:**
- [ ] 통계 수집
  - 총 이슈 수
  - 성공한 이슈 수 + PR 링크
  - 실패한 이슈 수 + 실패 원인
  - 생성된 PR 수
  - 총 처리 시간
- [ ] 결과 포맷팅
  - 성공: ✅ 아이콘, 그린 텍스트 (선택적)
  - 실패: ❌ 아이콘, 레드 텍스트 (선택적)
  - 경고: ⚠️ 아이콘, 옐로우 텍스트 (선택적)
  - 섹션: 📊, 📤, ❌, 💡
- [ ] Next steps 제안
  - 실패한 이슈: 수동 확인 필요
  - 생성된 PR: 리뷰 요청
  - 성공률이 낮으면: 이슈 정보 품질 개선 제안

#### 6.2 Dry-run 출력
**산출물:**
- [ ] 계획 표시
  - 처리 대상 이슈 및 그룹
  - 생성될 브랜치명
  - 예상 PR 개수
  - 실행될 체크 목록
- [ ] 실제 작업 스킵 표시
  - "[DRY-RUN] Would create worktree..."
  - "[DRY-RUN] Would create PR..."
  - 모든 write 작업에 프리픽스
- [ ] 예상 시간 계산
  - 그룹당 평균 처리 시간 추정
  - 총 예상 시간 표시

### Step 7: 통합 및 엔드투엔드 테스트

**산출물:**
- [ ] 통합 테스트 시나리오
  1. 정상 플로우: 5개 이슈, 3개 그룹, 모두 성공
  2. 재시도 성공: 첫 시도 실패, 재시도 성공
  3. 부분 실패: 일부 성공, 일부 실패
  4. 중단 및 정리: Ctrl+C 후 재시작
  5. Dry-run: 실제 변경 없이 계획 출력
- [ ] Mock 서버 구축
  - Mock GitHub API (이슈, PR, 코멘트)
  - Mock Git 저장소
  - Mock 테스트 명령 (성공/실패 시뮬레이션)
- [ ] 성능 벤치마크
  - 1개 이슈: < 2분
  - 10개 이슈 (병렬 3): < 10분
  - 메모리 사용량: < 500MB

## 테스트 전략

### 단위 테스트
**범위:**
- [ ] 파라미터 파싱
  - 유효/무효 조합
  - 기본값 설정
- [ ] 그룹핑 알고리즘
  - component 기반 그룹핑 정확성
  - edge case (컴포넌트 없는 이슈)
- [ ] 브랜치명 생성
  - 포맷 검증
  - 충돌 해결 (번호 증가)
- [ ] 에러 메시지 생성
  - 각 카테고리별 메시지 검증

**도구:** Jest + TypeScript

### 통합 테스트
**범위:**
- [ ] MCP 도구 체인
  - list_issues → group_issues → manage_worktree → run_checks → create_pr
  - Mock API 서버 사용
- [ ] 병렬 처리 큐
  - max_parallel 제한 검증
  - 파일 충돌 감지 및 순차 처리
- [ ] 재시도 로직
  - 3회 재시도 후 실패
  - 중간에 성공 시 조기 종료
- [ ] 중단 및 복구
  - SIGINT 핸들링
  - worktree 정리
  - 상태 파일 복구

**도구:** Jest + nock + mock-fs

### E2E 테스트
**범위:**
- [ ] 실제 Git 저장소 사용
  - Test 리포지토리 준비
  - 실제 이슈 생성
- [ ] 전체 워크플로우 실행
  - /autofix --issues 123,124
  - 성공 케이스 검증
- [ ] PR 및 이슈 업데이트 확인
  - PR이 올바른 base로 생성되었는지
  - 이슈에 코멘트가 추가되었는지
  - 라벨이 올바르게 적용되었는지

**도구:** Playwright + 실제 GitHub Test 리포지토리

### 수동 테스트 체크리스트
- [ ] 인터랙티브 모드에서 그룹 선택
- [ ] 대량 이슈 확인 프롬프트 (>5)
- [ ] 병렬 처리 진행 상황 표시
- [ ] Ctrl+C로 중단 및 정리
- [ ] 재시작 시 복구 프롬프트
- [ ] Dry-run 출력 검증
- [ ] 생성된 PR 포맷 확인
- [ ] 테스트 실패 시 재시도 동작
- [ ] 모든 worktree 정리 확인

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| **Claude AI 수정 품질** | 높음 | - 명확한 프롬프트 엔지니어링<br>- 테스트 기반 검증 (불합격 시 재시도)<br>- 최대 3회 재시도로 품질 개선 기회<br>- 실패 시 사람 개입 |
| **Git Worktree 누수** | 중간 | - 상태 파일로 추적<br>- 시작 시 정리 검증<br>- SIGINT 핸들러로 정리 보장<br>- 강제 정리 명령 제공 |
| **디스크 공간 부족** | 중간 | - Worktree 생성 전 공간 체크<br>- 처리 완료 즉시 정리<br>- max_parallel 제한으로 동시 사용량 제어 |
| **API Rate Limit** | 중간 | - GitHub/Anthropic API rate limit 모니터링<br>- 자동 대기 및 재시도<br>- 배치 API 호출 최소화 |
| **병렬 처리 충돌** | 낮음 | - 파일 충돌 감지 알고리즘<br>- 충돌 가능성 있는 그룹은 순차 처리<br>- 독립적 그룹 우선 스케줄링 |
| **테스트 환경 불일치** | 중간 | - 환경 검증 (package.json, pnpm, node_modules)<br>- 누락 시 자동 설치 또는 명확한 에러<br>- 테스트 타임아웃 설정 |
| **대량 이슈 성능 저하** | 낮음 | - 배치 처리 및 중간 결과 출력<br>- max_parallel 조정 가능<br>- 메모리 모니터링 및 자동 조정 |
| **민감 정보 노출** | 높음 | - PR 생성 전 민감 정보 스캔<br>- 토큰, API 키 패턴 감지<br>- 감지 시 마스킹 또는 경고 |
| **브랜치 충돌** | 낮음 | - 브랜치명에 타임스탬프 포함<br>- 충돌 시 번호 증가<br>- 최대 10회 시도 후 에러 |

## 의존성

### 외부 의존성
- **GitHub API**: REST API v3
  - SDK: `@octokit/rest` (^20.0.0)
  - 인증: Personal Access Token (PAT)
  - 권한: `repo` (PR 생성, 이슈 업데이트)
- **Anthropic Claude API**: Claude Sonnet/Opus
  - SDK: `@anthropic-ai/sdk` (^0.20.0)
  - 인증: API Key
  - 용도: 이슈 분석 및 코드 수정
- **Git**: v2.25+
  - Worktree 기능 사용
  - 로컬 설치 필수

### 내부 의존성
- **MCP SDK**: TypeScript MCP 도구 프레임워크
- **설정 시스템**: `autofix.config.yml` 로더
- **GitHub Issue 템플릿**: /triage에서 생성된 이슈 형식

### 개발 의존성
- TypeScript 5.x
- Jest 29.x (테스트)
- nock 13.x (HTTP mocking)
- mock-fs 5.x (파일 시스템 mocking)
- yaml 2.x (설정 파싱)
- zod 3.x (스키마 검증)
- chalk 5.x (컬러 출력)

### 순서 의존성
**이 커맨드가 의존하는 선행 작업:**
- `/triage` 커맨드: GitHub Issue가 먼저 생성되어야 함
- `autofixing` 브랜치: PR 타겟 브랜치가 존재해야 함
- MCP 도구 인프라: 모든 필요한 MCP 도구가 구현되어야 함
- autofix.config.yml: 설정 파일이 준비되어야 함

**이 커맨드 이후 작업:**
- PR 리뷰 및 머지: 생성된 PR은 사람이 리뷰
- Issue 클로즈: PR 머지 시 자동 클로즈 (GitHub 기능)
