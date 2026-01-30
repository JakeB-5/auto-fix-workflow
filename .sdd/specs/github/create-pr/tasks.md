---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 9
completed: 0
---

# Create PR 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 5 | 10h |
| 🟡 MEDIUM | 4 | 6h |
| 🟢 LOW | 0 | 0h |

---

### create-pr-task-001: 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
CreatePRParams, CreatePRResult 인터페이스를 TypeScript로 정의합니다. spec.md의 Interface 섹션을 기반으로 타입을 작성하며, TestResults 타입도 추가합니다.

#### 완료 조건
- [ ] `types/github.ts` 파일에 CreatePRParams 인터페이스 정의
- [ ] CreatePRResult 인터페이스 정의
- [ ] TestResult 인터페이스 정의 (passed, output, warnings)
- [ ] test_results 객체 타입 정의 (test, typecheck, lint)
- [ ] 모든 타입이 spec.md 명세와 일치하는지 검증

---

### create-pr-task-002: PR 제목 자동 생성 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** create-pr-task-001

#### 설명
이슈 정보를 기반으로 PR 제목을 자동 생성하는 유틸리티를 구현합니다. 단일 이슈와 그룹 이슈를 구분하여 적절한 형식을 사용합니다.

#### 완료 조건
- [ ] `utils/pr-title-generator.ts` 파일 생성
- [ ] IssueDetail 인터페이스 정의 (number, title, component)
- [ ] generatePRTitle(issues: IssueDetail[]): string 함수 구현
- [ ] 단일 이슈: "fix: {title} (#{number})" 형식
- [ ] 그룹 이슈: "fix: {component} issues ({numbers})" 형식
- [ ] 공통 컴포넌트 추출 로직 구현

---

### create-pr-task-003: PR 본문 자동 생성 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** create-pr-task-001

#### 설명
이슈 정보, 변경사항, 테스트 결과를 기반으로 PR 본문을 자동 생성하는 유틸리티를 구현합니다. Markdown 체크리스트 형식으로 테스트 결과를 표시합니다.

#### 완료 조건
- [ ] `utils/pr-body-generator.ts` 파일 생성
- [ ] PRBodyParams 인터페이스 정의
- [ ] generatePRBody(params: PRBodyParams): string 함수 구현
- [ ] formatTestResults 헬퍼 함수 구현 (✅/❌ emoji 사용)
- [ ] "Closes #issue_number" 형식으로 이슈 링크 생성
- [ ] 변경사항 섹션 형식화
- [ ] 테스트 결과 없음/경고 포함 시나리오 처리

---

### create-pr-task-004: 변경사항 자동 추출 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
Git diff를 사용하여 브랜치의 변경사항을 자동으로 추출하는 유틸리티를 구현합니다. 각 파일의 첫 번째 커밋 메시지를 description으로 사용합니다.

#### 완료 조건
- [ ] `utils/git-changes-extractor.ts` 파일 생성
- [ ] extractChanges(branch, target): Promise<{file, description}[]> 함수 구현
- [ ] git diff로 변경된 파일 목록 추출
- [ ] parseDiffOutput 함수로 diff 출력 파싱
- [ ] git log로 각 파일의 커밋 메시지 추출
- [ ] execGit 헬퍼 함수 구현 (child_process 사용)

---

### create-pr-task-005: 라벨 자동 생성 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** 없음 (get-issue 완성 후)

#### 설명
원본 이슈의 라벨을 상속하고 기본 라벨을 추가하는 로직을 구현합니다. component 및 priority 라벨을 자동으로 복사합니다.

#### 완료 조건
- [ ] `utils/pr-label-generator.ts` 파일 생성
- [ ] generatePRLabels(issueNumbers: number[]): Promise<string[]> 함수 구현
- [ ] 기본 라벨 "auto-fix", "bot" 추가
- [ ] getIssue를 사용하여 원본 이슈 라벨 조회
- [ ] "component:", "priority:" 라벨 필터링 및 상속
- [ ] Set을 사용한 중복 제거

---

### create-pr-task-006: Git 유틸리티 함수 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
브랜치 존재 확인, 변경사항 확인, 중복 PR 체크를 수행하는 Git 유틸리티 함수를 구현합니다. GitHub API와 Git CLI를 조합하여 사용합니다.

#### 완료 조건
- [ ] `utils/git-helper.ts` 파일 생성
- [ ] checkBranchExists(branch: string): Promise<boolean> 함수 구현
- [ ] checkHasChanges(branch, target): Promise<boolean> 함수 구현
- [ ] checkExistingPR(branch, target): Promise<number | null> 함수 구현
- [ ] execGit 헬퍼 함수 구현 (에러 처리 포함)
- [ ] GitHub API로 open PR 조회 (head, base 필터)

---

### create-pr-task-007: Create PR Tool 핵심 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** create-pr-task-002, create-pr-task-003, create-pr-task-004, create-pr-task-005, create-pr-task-006

#### 설명
createPR 함수의 핵심 로직을 구현합니다. 파라미터 검증, 브랜치 확인, 중복 PR 체크, 이슈 정보 조회, PR 생성, 라벨 추가를 순차적으로 수행합니다.

#### 완료 조건
- [ ] `tools/create-pr.ts` 파일에 createPR 함수 구현
- [ ] 필수 파라미터 검증 (branch, issues)
- [ ] checkBranchExists로 브랜치 존재 확인
- [ ] checkHasChanges로 변경사항 확인
- [ ] checkExistingPR로 중복 PR 체크
- [ ] getIssue로 이슈 상세 정보 조회
- [ ] 제목/본문 자동 생성 또는 커스텀 값 사용
- [ ] octokit.pulls.create() 호출
- [ ] octokit.issues.addLabels()로 라벨 추가
- [ ] 결과 객체 반환

---

### create-pr-task-008: 에러 핸들링

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1.5h
- **의존성:** create-pr-task-007

#### 설명
모든 에러 시나리오에 대한 처리를 구현합니다. 브랜치 없음, 변경사항 없음, 중복 PR, GitHub API 에러를 처리합니다.

#### 완료 조건
- [ ] 브랜치 없음 → MCP "NOT_FOUND" 에러
- [ ] 변경사항 없음 → MCP "NO_CHANGES" 에러
- [ ] 중복 PR → MCP "DUPLICATE" 에러 (기존 PR 번호 포함)
- [ ] GitHub API 403 → MCP "PERMISSION_DENIED" 매핑
- [ ] GitHub API 500/503 → MCP "EXTERNAL_SERVICE_ERROR" 매핑
- [ ] Git 명령 실패 시 명확한 에러 메시지 반환

---

### create-pr-task-009: MCP Tool 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2.5h
- **의존성:** create-pr-task-007, create-pr-task-008

#### 설명
create_pr Tool을 MCP 서버에 등록하고, Tool 메타데이터 및 스키마를 추가합니다. 단위 테스트 및 통합 테스트를 작성하여 모든 기능을 검증합니다.

#### 완료 조건
- [ ] `index.ts`에 create_pr Tool 등록
- [ ] Tool 메타데이터 및 파라미터 스키마 작성
- [ ] 단위 테스트 작성 (pr-title-generator.ts, pr-body-generator.ts, git-changes-extractor.ts, pr-label-generator.ts)
- [ ] 통합 테스트 작성 (Mock Octokit, Mock Git)
- [ ] 커스텀 title/body 제공 시나리오 검증
- [ ] 중복 PR 방지 동작 확인
- [ ] Manual Testing으로 실제 GitHub 및 Git 동작 확인
