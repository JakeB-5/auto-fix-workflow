---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 6
completed: 0
---

# List Issues 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 4 | 6h |
| 🟡 MEDIUM | 2 | 3h |
| 🟢 LOW | 0 | 0h |

---

### list-issues-task-001: 타입 정의 및 인터페이스 작성

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
ListIssuesParams, ListIssuesResult 인터페이스를 TypeScript로 정의합니다. spec.md의 Interface 섹션을 기반으로 타입을 작성하며, 내부 사용을 위한 RawGithubIssue 타입도 추가합니다.

#### 완료 조건
- [ ] `types/github.ts` 파일에 ListIssuesParams 인터페이스 정의
- [ ] ListIssuesResult 인터페이스 정의
- [ ] RawGithubIssue 타입 추가 (Octokit 응답 형태)
- [ ] `types/common.ts`에 GithubError, RateLimitInfo 타입 정의
- [ ] 모든 타입이 spec.md 명세와 일치하는지 검증

---

### list-issues-task-002: GitHub API 클라이언트 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** list-issues-task-001

#### 설명
Octokit 초기화 및 인증 처리를 담당하는 GitHub 클라이언트 유틸리티를 구현합니다. 환경변수에서 GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO를 읽고, Rate Limit 처리 및 재시도 로직을 포함합니다.

#### 완료 조건
- [ ] `utils/github-client.ts` 파일에 Octokit 초기화 함수 구현
- [ ] 환경변수 검증 로직 추가
- [ ] `utils/error-mapper.ts`에 GitHub API 에러를 MCP 에러 코드로 매핑하는 함수 구현
- [ ] Rate Limit 429 응답 시 reset 시간까지 대기 후 재시도 로직 구현
- [ ] 401, 403, 500/503 에러 처리 구현

---

### list-issues-task-003: 이슈 본문 파싱 유틸리티 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
이슈 본문에서 컴포넌트 정보와 우선순위를 추출하는 파싱 유틸리티를 구현합니다. 정규식 기반으로 "### Context" 섹션의 컴포넌트 필드를 추출하고, 라벨과 본문 키워드를 기반으로 우선순위를 판단합니다.

#### 완료 조건
- [ ] `utils/issue-parser.ts` 파일 생성
- [ ] extractComponent(body: string): string 함수 구현
- [ ] 정규식 패턴 `/### Context[\s\S]*?- \*\*컴포넌트\*\*:\s*([^\n]+)/` 검증
- [ ] extractPriority(labels: string[], body: string): "high" | "medium" | "low" 함수 구현
- [ ] 라벨 우선 → 본문 키워드 → 기본값 순서 로직 구현
- [ ] 매칭 실패 시 안전한 기본값 반환 검증

---

### list-issues-task-004: List Issues Tool 핵심 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** list-issues-task-002, list-issues-task-003

#### 설명
listIssues 함수의 핵심 로직을 구현합니다. Octokit을 사용하여 GitHub API를 호출하고, exclude_labels 필터링을 적용하며, 각 이슈에 대해 컴포넌트 및 우선순위 정보를 추출합니다.

#### 완료 조건
- [ ] `tools/list-issues.ts` 파일에 listIssues 함수 구현
- [ ] 파라미터 기본값 설정 (labels: ["auto-fix"], state: "open", limit: 50)
- [ ] octokit.issues.listForRepo() 호출 및 응답 처리
- [ ] exclude_labels 필터링 로직 구현
- [ ] extractComponent, extractPriority 함수 호출하여 결과 매핑
- [ ] 빈 결과 처리 (issues: [], total: 0)

---

### list-issues-task-005: 에러 핸들링 및 엣지 케이스 처리

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** list-issues-task-004

#### 설명
모든 에러 시나리오와 엣지 케이스에 대한 처리를 구현합니다. GitHub API 에러를 MCP 에러 코드로 변환하고, Rate Limit 초과 시 reset 시간을 포함한 에러 메시지를 생성합니다.

#### 완료 조건
- [ ] GitHub API 401 → MCP "AUTHENTICATION_FAILED" 매핑
- [ ] GitHub API 429 → MCP "RATE_LIMIT_EXCEEDED" 매핑 (reset 시간 포함)
- [ ] GitHub API 403 → MCP "PERMISSION_DENIED" 매핑
- [ ] GitHub API 500/503 → MCP "EXTERNAL_SERVICE_ERROR" 매핑
- [ ] 에러 메시지에 필요 권한 안내 포함
- [ ] 빈 결과 시나리오 테스트

---

### list-issues-task-006: MCP Tool 등록 및 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** list-issues-task-004, list-issues-task-005

#### 설명
list_issues Tool을 MCP 서버에 등록하고, Tool 메타데이터 및 JSON Schema validation을 추가합니다. 단위 테스트와 통합 테스트를 작성하여 모든 기능이 정상 작동하는지 검증합니다.

#### 완료 조건
- [ ] `index.ts`에 list_issues Tool 등록
- [ ] MCP Tool Descriptor 작성 (이름, 설명, 파라미터 스키마)
- [ ] JSON Schema validation 추가
- [ ] 단위 테스트 작성 (issue-parser.ts, error-mapper.ts)
- [ ] 통합 테스트 작성 (Mock Octokit 사용)
- [ ] Manual Testing으로 실제 GitHub API 동작 검증
