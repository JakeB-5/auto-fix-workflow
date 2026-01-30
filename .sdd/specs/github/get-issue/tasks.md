---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 6
completed: 0
---

# Get Issue 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 4 | 7h |
| 🟡 MEDIUM | 2 | 3h |
| 🟢 LOW | 0 | 0h |

---

### get-issue-task-001: 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
GetIssueParams, GetIssueResult, ParsedContext 인터페이스를 TypeScript로 정의합니다. spec.md의 Interface 섹션을 기반으로 타입을 작성하며, Comment 타입도 추가합니다.

#### 완료 조건
- [ ] `types/github.ts` 파일에 GetIssueParams 인터페이스 정의
- [ ] GetIssueResult 인터페이스 정의
- [ ] ParsedContext 인터페이스 정의 (모든 필드 optional)
- [ ] Comment 타입 정의 (id, author, body, created_at)
- [ ] 모든 타입이 spec.md 명세와 일치하는지 검증

---

### get-issue-task-002: Markdown 파싱 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** get-issue-task-001

#### 설명
marked 라이브러리를 사용하여 이슈 본문의 Auto-Fix Issue 템플릿을 파싱하는 유틸리티를 구현합니다. 헤딩 기반 섹션 추출 및 필드별 정보 추출을 지원하며, 파싱 실패 시 Graceful Degradation을 제공합니다.

#### 완료 조건
- [ ] marked 라이브러리 설치
- [ ] `utils/markdown-parser.ts` 파일 생성
- [ ] parseIssueTemplate(body: string): ParsedContext 함수 구현
- [ ] extractSections(ast) 함수로 헤딩 기반 섹션 추출
- [ ] extractType, extractSource, extractField 등 개별 필드 추출 함수 구현
- [ ] 파싱 실패 시 빈 객체 반환하고 에러 미발생 확인
- [ ] Auto-Fix Issue 템플릿 및 Sentry Issue 템플릿 파싱 테스트

---

### get-issue-task-003: 관련 이슈 추출 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
이슈 본문의 "Related Issues" 섹션에서 #123 형식의 이슈 번호를 추출하는 유틸리티를 구현합니다. 정규식 기반으로 간단하고 빠르게 처리합니다.

#### 완료 조건
- [ ] `utils/related-issues-parser.ts` 파일 생성
- [ ] extractRelatedIssues(body: string): number[] 함수 구현
- [ ] 정규식 `/#(\d+)/g` 패턴으로 이슈 번호 추출
- [ ] "Related Issues" 섹션이 없을 경우 빈 배열 반환
- [ ] 다양한 형식 테스트 ("- #120", "#120, #121", 섹션 없음)

---

### get-issue-task-004: Get Issue Tool 핵심 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** get-issue-task-002, get-issue-task-003

#### 설명
getIssue 함수의 핵심 로직을 구현합니다. GitHub API로 이슈 기본 정보를 조회하고, 본문 파싱 및 관련 이슈 추출을 수행하며, 조건부로 코멘트를 조회합니다.

#### 완료 조건
- [ ] `tools/get-issue.ts` 파일에 getIssue 함수 구현
- [ ] 파라미터 검증 (issue_number 필수)
- [ ] octokit.issues.get() 호출 및 응답 처리
- [ ] parseIssueTemplate, extractRelatedIssues 함수 호출
- [ ] include_comments: true일 때만 octokit.issues.listComments() 호출
- [ ] 코멘트 데이터 매핑 (id, author, body, created_at)
- [ ] 결과 객체 반환 (모든 필드 포함)

---

### get-issue-task-005: 에러 핸들링

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** get-issue-task-004

#### 설명
모든 에러 시나리오에 대한 처리를 구현합니다. GitHub API 에러를 MCP 에러 코드로 변환하고, 템플릿 파싱 실패 시에도 안전하게 처리합니다.

#### 완료 조건
- [ ] GitHub API 404 → MCP "NOT_FOUND" 매핑
- [ ] GitHub API 401 → MCP "AUTHENTICATION_FAILED" 매핑
- [ ] GitHub API 403 → MCP "PERMISSION_DENIED" 매핑
- [ ] GitHub API 500/503 → MCP "EXTERNAL_SERVICE_ERROR" 매핑
- [ ] 템플릿 파싱 실패 시 에러 없이 빈 parsed_context 반환 검증
- [ ] 에러 메시지에 명확한 설명 포함

---

### get-issue-task-006: MCP Tool 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** get-issue-task-004, get-issue-task-005

#### 설명
get_issue Tool을 MCP 서버에 등록하고, Tool 메타데이터 및 스키마를 추가합니다. 단위 테스트 및 통합 테스트를 작성하여 모든 기능을 검증합니다.

#### 완료 조건
- [ ] `index.ts`에 get_issue Tool 등록
- [ ] Tool 메타데이터 및 파라미터 스키마 작성
- [ ] 단위 테스트 작성 (markdown-parser.ts, related-issues-parser.ts)
- [ ] 통합 테스트 작성 (Mock Octokit 사용)
- [ ] include_comments: true/false 동작 검증
- [ ] Manual Testing으로 실제 GitHub API 동작 확인
