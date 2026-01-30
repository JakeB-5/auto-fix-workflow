---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# List Issues 구현 계획

## 기술 결정

### 결정 1: GitHub Octokit 라이브러리 사용
**선택:** @octokit/rest 라이브러리
**근거:**
- GitHub API 공식 클라이언트로 타입 안전성 보장
- Rate Limit, 인증, 페이지네이션 등 복잡한 처리 자동화
- 에러 핸들링이 표준화되어 있어 MCP 에러 코드 매핑 용이

### 결정 2: 컴포넌트 정보 추출 방식
**선택:** 정규식 기반 파싱
**근거:**
- 이슈 본문의 "### Context" 섹션에서 "- **컴포넌트**: {value}" 패턴 추출
- Markdown 파싱 라이브러리보다 가볍고 빠름
- 단순한 패턴 매칭으로 충분하며, 실패 시 빈 문자열 반환으로 안전

### 결정 3: 우선순위 판단 로직
**선택:** 라벨 우선 → 컨텍스트 → 기본값 순서
**근거:**
- 라벨 "priority:high/medium/low" 존재 시 우선 사용
- 라벨 없으면 이슈 본문의 "긴급", "critical" 등 키워드 검색
- 모두 없으면 기본값 "medium" 반환

### 결정 4: 캐싱 전략 미사용
**선택:** 매 요청마다 GitHub API 호출
**근거:**
- 이슈 상태는 실시간으로 변경되므로 캐싱이 오히려 부정확성 유발
- MCP Tool은 stateless이므로 캐시 관리 복잡도 증가
- Rate Limit은 GitHub PAT 수준에서 관리 (시간당 5000회 충분)

## 구현 단계

### Step 1: 타입 정의 및 인터페이스 작성
**산출물:**
- [ ] `types/github.ts`: ListIssuesParams, ListIssuesResult 인터페이스 정의
- [ ] `types/common.ts`: GithubError, RateLimitInfo 공통 타입 정의

**작업 내용:**
- spec.md의 Interface 섹션을 TypeScript 타입으로 변환
- 내부 사용을 위한 RawGithubIssue 타입 추가 (Octokit 응답 형태)

### Step 2: GitHub API 클라이언트 유틸리티 구현
**산출물:**
- [ ] `utils/github-client.ts`: Octokit 초기화 및 인증 처리
- [ ] `utils/error-mapper.ts`: GitHub API 에러를 MCP 에러 코드로 매핑

**작업 내용:**
- 환경변수에서 GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO 읽기
- 인증 실패, Rate Limit, 권한 에러 처리
- 재시도 로직 (Rate Limit 429 응답 시 reset 시간까지 대기)

### Step 3: 이슈 본문 파싱 유틸리티 구현
**산출물:**
- [ ] `utils/issue-parser.ts`: extractComponent, extractPriority 함수

**작업 내용:**
- `extractComponent(body: string): string` 구현
  - 정규식: `/### Context[\s\S]*?- \*\*컴포넌트\*\*:\s*([^\n]+)/`
  - 매칭 실패 시 빈 문자열 반환
- `extractPriority(labels: string[], body: string): "high" | "medium" | "low"` 구현
  - 1단계: labels에서 "priority:X" 패턴 검색
  - 2단계: body에서 "긴급", "critical" 키워드 검색 → "high"
  - 3단계: 기본값 "medium" 반환

### Step 4: List Issues Tool 핵심 로직 구현
**산출물:**
- [ ] `tools/list-issues.ts`: listIssues 함수 및 Tool 등록

**작업 내용:**
- `listIssues(params: ListIssuesParams): Promise<ListIssuesResult>` 구현
  - 파라미터 기본값 설정 (labels: ["auto-fix"], exclude_labels: ["auto-fix-skip"], state: "open", limit: 50)
  - Octokit의 `octokit.issues.listForRepo()` 호출
  - 응답 필터링 (exclude_labels 제외 로직)
  - 각 이슈에 대해 extractComponent, extractPriority 적용
  - 결과 변환 및 반환

### Step 5: 에러 핸들링 및 엣지 케이스 처리
**산출물:**
- [ ] 모든 시나리오의 에러 핸들링 코드

**작업 내용:**
- GitHub API 401 → MCP "AUTHENTICATION_FAILED"
- GitHub API 429 → MCP "RATE_LIMIT_EXCEEDED" (reset 시간 포함)
- GitHub API 403 → MCP "PERMISSION_DENIED"
- GitHub API 500/503 → MCP "EXTERNAL_SERVICE_ERROR"
- 빈 결과 처리 (issues: [], total: 0)

### Step 6: MCP Tool 등록 및 통합
**산출물:**
- [ ] `index.ts`: list_issues Tool 등록
- [ ] MCP 서버에 Tool 메타데이터 추가

**작업 내용:**
- MCP Tool Descriptor 작성 (이름, 설명, 파라미터 스키마)
- JSON Schema validation 추가 (선택사항)

## 테스트 전략

### Unit Tests
- `issue-parser.ts` 함수별 테스트
  - extractComponent: 정상 케이스, 누락 케이스, 다양한 Markdown 형식
  - extractPriority: 라벨 우선순위, 본문 키워드, 기본값
- `error-mapper.ts`: GitHub API 에러 코드별 매핑 검증

### Integration Tests
- Mock Octokit을 사용한 listIssues 함수 테스트
  - 정상 응답 처리
  - 페이지네이션 (50개 이상 이슈)
  - exclude_labels 필터링 로직
  - 에러 응답 처리 (401, 403, 429)

### Manual Testing (실제 GitHub 레포지토리)
- 실제 레포지토리에서 auto-fix 라벨 이슈 조회
- Rate Limit 도달 시 동작 확인
- 다양한 이슈 템플릿 형식 파싱 테스트

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| GitHub API Rate Limit 초과 | 높음 | 429 응답 시 reset 시간까지 대기 후 재시도, 에러 메시지에 reset 시간 포함하여 사용자에게 안내 |
| 이슈 본문 형식이 불규칙함 | 중간 | 정규식 매칭 실패 시 기본값 반환 (component: "", priority: "medium"), 에러 발생 안함 |
| PAT 권한 불충분 | 중간 | 명확한 에러 메시지로 필요 권한(repo:read) 안내 |
| 대용량 이슈 목록 처리 | 낮음 | limit 파라미터로 제한 (기본 50개), GitHub API는 페이지당 100개 제한이므로 한 번에 처리 가능 |
| exclude_labels 필터링 성능 | 낮음 | GitHub API는 labels로 필터링만 가능하므로 exclude는 클라이언트 측에서 처리, 50개 이하이므로 성능 영향 미미 |

## 의존성

### 선행 의존성
- `common/types`: 공통 타입 정의 (MCP 에러 코드, GitHub 설정)
- `common/error-handler`: MCP 에러 변환 유틸리티
- 환경 변수 설정: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

### 후행 의존성 (이 기능을 사용하는 곳)
- `get-issue`: list-issues로 찾은 이슈 번호를 상세 조회
- `orchestrator`: 전체 워크플로우에서 처리할 이슈 목록 조회
- `asana-sync`: Asana 태스크와 매칭할 GitHub 이슈 검색

### 외부 라이브러리
- `@octokit/rest`: ^20.0.0
- `@octokit/auth-token`: ^4.0.0 (인증)

## 구현 순서 요약

1. 타입 정의 (Step 1)
2. GitHub 클라이언트 유틸리티 (Step 2) ← 의존성 필요
3. 이슈 파싱 유틸리티 (Step 3)
4. 핵심 로직 (Step 4)
5. 에러 핸들링 (Step 5)
6. MCP 통합 (Step 6)
