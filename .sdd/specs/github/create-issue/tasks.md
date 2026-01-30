---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 8
completed: 0
---

# Create Issue 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 5 | 9h |
| 🟡 MEDIUM | 2 | 3h |
| 🟢 LOW | 1 | 1.5h |

---

### create-issue-task-001: 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
CreateIssueParams, CreateIssueResult 인터페이스를 TypeScript로 정의합니다. spec.md의 Interface 섹션을 기반으로 타입을 작성하며, AsanaUpdateResult 타입도 추가합니다.

#### 완료 조건
- [ ] `types/github.ts` 파일에 CreateIssueParams 인터페이스 정의
- [ ] CreateIssueResult 인터페이스 정의
- [ ] AsanaUpdateResult 타입 추가 (success, tag_added, comment_added, error)
- [ ] 모든 타입이 spec.md 명세와 일치하는지 검증

---

### create-issue-task-002: 템플릿 생성 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** create-issue-task-001

#### 설명
Auto-Fix Issue 템플릿을 자동 생성하는 유틸리티를 구현합니다. Template Literal 기반으로 Markdown 템플릿을 생성하며, 동적 데이터 삽입 및 선택적 필드 처리를 지원합니다.

#### 완료 조건
- [ ] `utils/issue-template-generator.ts` 파일 생성
- [ ] IssueTemplateData 인터페이스 정의
- [ ] generateAutoFixIssueBody(data: IssueTemplateData): string 함수 구현
- [ ] typeToEmoji, typeToLabel, sourceToLabel 헬퍼 함수 구현
- [ ] 선택적 필드 누락 시 섹션 생략 로직 구현
- [ ] 버그 리포트, Sentry 이슈, Asana 이슈 템플릿 생성 테스트

---

### create-issue-task-003: 라벨 자동 생성 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** create-issue-task-001

#### 설명
이슈 생성 시 자동으로 라벨을 추가하는 로직을 구현합니다. 기본 라벨, 소스 기반 라벨, 커스텀 라벨을 병합하며 중복을 제거합니다.

#### 완료 조건
- [ ] `utils/label-generator.ts` 파일 생성
- [ ] generateLabels(params: CreateIssueParams): string[] 함수 구현
- [ ] 기본 라벨 "auto-fix" 항상 추가
- [ ] asana_task_id 존재 시 "asana" 라벨 자동 추가
- [ ] body에 "sentry.io" 포함 시 "sentry" 라벨 자동 추가
- [ ] params.labels의 커스텀 라벨 추가
- [ ] Set을 사용한 중복 제거 구현

---

### create-issue-task-004: 중복 이슈 체크 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음 (list-issues, get-issue 완성 후)

#### 설명
동일한 Asana Task ID로 이미 생성된 이슈가 있는지 확인하는 로직을 구현합니다. list_issues와 get_issue를 사용하여 중복 여부를 판단합니다.

#### 완료 조건
- [ ] `utils/duplicate-checker.ts` 파일 생성
- [ ] checkDuplicateIssue(asana_task_id: string): Promise<number | null> 함수 구현
- [ ] listIssues로 auto-fix 라벨 이슈 조회
- [ ] 각 이슈의 본문에서 asana_task_id 매칭 확인
- [ ] 중복 발견 시 이슈 번호 반환, 없으면 null 반환
- [ ] asana_task_id 미제공 시 건너뛰기 로직 구현

---

### create-issue-task-005: Asana 연동 로직 구현 (선택사항)

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1.5h
- **의존성:** 없음

#### 설명
Asana API를 사용하여 태그 추가 및 코멘트 작성을 구현합니다. 비블로킹 방식으로 처리하며, 실패 시 경고만 반환합니다.

#### 완료 조건
- [ ] `integrations/asana-client.ts` 파일 생성
- [ ] updateAsanaTask(taskId, issueNumber, issueUrl): Promise<AsanaUpdateResult> 함수 구현
- [ ] Asana 태그 "triaged" 추가
- [ ] Asana 코멘트에 GitHub Issue 링크 추가
- [ ] try-catch로 에러 처리 (에러 시 success: false, error 메시지 반환)
- [ ] ASANA_ACCESS_TOKEN 환경변수 검증

---

### create-issue-task-006: Create Issue Tool 핵심 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** create-issue-task-002, create-issue-task-003, create-issue-task-004

#### 설명
createIssue 함수의 핵심 로직을 구현합니다. 파라미터 검증, 중복 체크, 라벨 생성, GitHub Issue 생성, Asana 업데이트를 순차적으로 수행합니다.

#### 완료 조건
- [ ] `tools/create-issue.ts` 파일에 createIssue 함수 구현
- [ ] 필수 파라미터 검증 (title, body)
- [ ] checkDuplicateIssue 호출 및 중복 시 에러 발생
- [ ] generateLabels 호출하여 라벨 생성
- [ ] octokit.issues.create() 호출
- [ ] updateAsanaTask 호출 (비블로킹)
- [ ] 결과 객체 반환 (issue_number, url, labels, asana_updated)

---

### create-issue-task-007: 에러 핸들링

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1.5h
- **의존성:** create-issue-task-006

#### 설명
모든 에러 시나리오에 대한 처리를 구현합니다. 필수 파라미터 누락, 중복 이슈, GitHub API 에러, 존재하지 않는 라벨 등을 처리합니다.

#### 완료 조건
- [ ] 필수 파라미터 누락 → MCP "INVALID_PARAMS" 에러
- [ ] 중복 이슈 발견 → MCP "DUPLICATE" 에러 (기존 이슈 번호 포함)
- [ ] GitHub API 403 → MCP "PERMISSION_DENIED" 매핑
- [ ] GitHub API 500/503 → MCP "EXTERNAL_SERVICE_ERROR" 매핑
- [ ] 존재하지 않는 라벨 → 경고 반환 (Issue 생성은 유지)
- [ ] Asana 업데이트 실패 시 경고만 반환 (롤백 없음)

---

### create-issue-task-008: MCP Tool 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** create-issue-task-006, create-issue-task-007

#### 설명
create_issue Tool을 MCP 서버에 등록하고, Tool 메타데이터 및 스키마를 추가합니다. 단위 테스트 및 통합 테스트를 작성하여 모든 기능을 검증합니다.

#### 완료 조건
- [ ] `index.ts`에 create_issue Tool 등록
- [ ] Tool 메타데이터 및 파라미터 스키마 작성
- [ ] 단위 테스트 작성 (issue-template-generator.ts, label-generator.ts, duplicate-checker.ts)
- [ ] 통합 테스트 작성 (Mock Octokit, Mock Asana)
- [ ] 중복 방지 동작 검증
- [ ] Manual Testing으로 실제 GitHub 및 Asana 연동 확인
