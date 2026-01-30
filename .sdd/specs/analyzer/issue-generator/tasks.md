---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 13
completed: 0
---

# Issue Generator 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|----------|
| 🔴 HIGH | 6 | 12h |
| 🟡 MEDIUM | 5 | 10h |
| 🟢 LOW | 2 | 4h |
| **합계** | **13** | **26h** |

---

### issue-generator-task-001: 프로젝트 초기화 및 GitHub 클라이언트 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
프로젝트 기본 구조를 설정하고 GitHub API 통신을 위한 Octokit 클라이언트 래퍼를 구현합니다.

#### 완료 조건
- [ ] `src/analyzer/issue-generator/` 디렉토리 생성
- [ ] `types.ts` 파일 생성 (`IssueTemplate`, `IssueGenerationInput`, `IssueGenerationResult`)
- [ ] `.env.example` 파일 생성 (`GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`)
- [ ] Octokit 클라이언트 초기화 헬퍼
- [ ] `GitHubClient.ts` 클래스 구현
- [ ] `createIssue(template: IssueTemplate)` 메서드 구현
- [ ] Rate limiting 처리 및 재시도 로직
- [ ] 에러 타입 정의 (`GitHubAPIError`, `RateLimitError`)
- [ ] Label 존재 확인 및 자동 생성 로직

---

### issue-generator-task-002: 마크다운 템플릿 시스템 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-generator-task-001

#### 설명
Template Literals 기반 마크다운 템플릿 시스템을 구축하고 각 섹션별 렌더링 헬퍼를 구현합니다.

#### 완료 조건
- [ ] `templates/` 디렉토리 생성
- [ ] `issueTemplate.ts` 파일 생성
- [ ] `generateIssueBody(input: IssueGenerationInput): string` 메서드 구현
- [ ] 섹션별 헬퍼 함수:
  - `renderTypeSection(source: string): string`
  - `renderContextSection(location?: CodeLocation): string`
  - `renderCodeAnalysis(code?: string): string`
  - `renderSuggestedFix(patterns: string[]): string`
  - `renderAcceptanceCriteria(type: string, scenarios: string[]): string`
- [ ] 마크다운 이스케이프 유틸리티
- [ ] 템플릿 스냅샷 테스트

---

### issue-generator-task-003: Type 자동 판단 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-generator-task-002

#### 설명
입력 데이터를 분석하여 Issue Type (Sentry Error, Bug Report, Feature Request)을 자동으로 판단합니다.

#### 완료 조건
- [ ] `TypeDetector.ts` 클래스 생성
- [ ] `detectIssueType(input: IssueGenerationInput): IssueType` 메서드 구현
- [ ] 판단 규칙 구현:
  - Sentry 소스 → `🔴 Sentry Error`
  - 에러 메시지 존재 → `🐛 Bug Report`
  - 에러 없음 → `✨ Feature Request`
- [ ] 체크박스 형식 반환: `- [x] 🐛 Bug Report`
- [ ] 단위 테스트 (각 타입별 케이스)

---

### issue-generator-task-004: Context 섹션 생성기 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-generator-task-003

#### 설명
코드 위치 정보를 마크다운으로 렌더링하는 Context 섹션 생성기를 구현합니다. 단일/다중 파일 처리를 지원합니다.

#### 완료 조건
- [ ] `ContextRenderer.ts` 클래스 생성
- [ ] `renderSingleFile(location: CodeLocation): string` 메서드 구현
- [ ] `renderMultipleFiles(locations: CodeLocation[]): string` 메서드 구현
- [ ] 컴포넌트 라벨 포맷팅
- [ ] 누락 필드 생략 로직 (빈 값 대신 제외)
- [ ] 신뢰도 점수 표시
- [ ] 테이블 형식 렌더링

---

### issue-generator-task-005: Code Analysis 섹션 생성기 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-generator-task-004

#### 설명
Read 도구를 사용하여 에러 발생 지점의 코드 스니펫을 추출하고 마크다운 코드 블록으로 렌더링합니다.

#### 완료 조건
- [ ] `CodeAnalysisRenderer.ts` 클래스 생성
- [ ] `extractCodeSnippet(file: string, line: number): Promise<string>` 메서드 구현
- [ ] Read 도구 통합 (line offset/limit 활용)
- [ ] Context window: 에러 라인 ±5줄
- [ ] 라인 번호 주석 추가 (코드 블록 내부)
- [ ] 들여쓰기 유지 및 포맷팅
- [ ] 파일 접근 불가 시 fallback (에러 메시지 스니펫 사용)
- [ ] 코드 블록 언어 자동 감지 (파일 확장자 기반)

---

### issue-generator-task-006: Suggested Fix Direction 생성기 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-generator-task-005

#### 설명
에러 패턴을 분석하여 자동으로 수정 방향을 제안하는 시스템을 구현합니다.

#### 완료 조건
- [ ] `FixSuggester.ts` 클래스 생성
- [ ] 에러 패턴 맵 정의:
  - "Cannot read property" → Optional chaining, null 체크
  - "is not a function" → 함수 존재 체크
  - "Maximum call stack" → 재귀 종료 조건
  - 기타 일반 패턴 5개 이상
- [ ] `suggestFix(errorMessage: string): string[]` 메서드 구현
- [ ] 패턴 매칭 함수 (정규식 기반)
- [ ] 참조 파일 힌트 추가 (task-analyzer 제공 시)
- [ ] 제안 없으면 섹션 생략 로직
- [ ] 패턴 확장 가능성 확보

---

### issue-generator-task-007: Acceptance Criteria 생성기 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-generator-task-006

#### 설명
Issue Type과 재현 시나리오를 기반으로 Acceptance Criteria를 자동 생성합니다.

#### 완료 조건
- [ ] `CriteriaGenerator.ts` 클래스 생성
- [ ] Type별 기본 Criteria 정의:
  - Bug/Sentry: "에러 미발생", "테스트 통과", "재현 시나리오 정상"
  - Feature: "기능 구현", "기존 기능 영향 없음", "테스트 추가"
- [ ] `addScenarioCriteria(scenarios: string[]): string[]` 메서드 구현
- [ ] 재현 시나리오 기반 추가 Criteria 생성
- [ ] 체크박스 리스트 형식 반환
- [ ] 중복 제거 로직

---

### issue-generator-task-008: Labels 자동 설정 시스템 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-generator-task-007

#### 설명
GitHub Label을 자동으로 생성, 정규화, 할당하는 시스템을 구현합니다.

#### 완료 조건
- [ ] `LabelManager.ts` 클래스 생성
- [ ] 기본 라벨 `auto-fix` 추가 로직
- [ ] 소스별 라벨 추가 (`sentry`, `asana`)
- [ ] 컴포넌트 라벨 정규화:
  - `normalizeComponentLabel(component: string): string`
  - "canvas core" → "component:canvas-core"
- [ ] 우선순위 라벨 매핑 (Asana custom field)
- [ ] Label 검증 (최대 50자, 특수문자 제거)
- [ ] GitHub Label 존재 확인 및 자동 생성
- [ ] 색상 코드 할당 (컴포넌트별)

---

### issue-generator-task-009: Issue Title 생성기 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-generator-task-008

#### 설명
소스와 에러 정보를 기반으로 명확하고 간결한 Issue Title을 생성합니다.

#### 완료 조건
- [ ] `TitleGenerator.ts` 클래스 생성
- [ ] Sentry 에러 타이틀 템플릿: `[Sentry] ${errorType}: ${errorMessage}`
- [ ] Asana 버그 타이틀 템플릿: `[Asana] ${taskTitle}`
- [ ] 파일명 추가 옵션 (간결성 유지): `[Sentry] TypeError in Editor.tsx`
- [ ] 최대 256자 제한 준수
- [ ] 초과 시 truncate 로직 (마지막 단어 유지)
- [ ] 특수문자 이스케이프
- [ ] 단위 테스트 (길이, 형식)

---

### issue-generator-task-010: IssueGenerator 메인 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-generator-task-009

#### 설명
모든 생성기를 조합하여 완전한 GitHub Issue를 생성하는 메인 orchestrator를 구현합니다.

#### 완료 조건
- [ ] `IssueGenerator.ts` 메인 클래스 생성
- [ ] `generate(input: IssueGenerationInput): Promise<IssueGenerationResult>` 메서드 구현
- [ ] 검증 로직:
  - `can_auto_convert: false` → `InsufficientDataError`
  - 필수 필드 누락 체크
- [ ] 모든 렌더러 조합 및 템플릿 생성
- [ ] GitHub Issue 생성 API 호출
- [ ] 실패 시 Asana 코멘트 작성 (선택적)
- [ ] 성공 시 Issue URL 반환
- [ ] 에러 핸들링 및 롤백 로직

---

### issue-generator-task-011: 단위 테스트 작성 (컴포넌트별)

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-generator-task-010

#### 설명
각 생성기 컴포넌트에 대한 독립적인 단위 테스트를 작성하여 정확성을 검증합니다.

#### 완료 조건
- [ ] `TypeDetector.test.ts` 작성
- [ ] `ContextRenderer.test.ts` 작성 (스냅샷 테스트)
- [ ] `CodeAnalysisRenderer.test.ts` 작성
- [ ] `FixSuggester.test.ts` 작성 (10개 이상 패턴)
- [ ] `LabelManager.test.ts` 작성
- [ ] `TitleGenerator.test.ts` 작성 (최대 길이, 특수문자)
- [ ] `CriteriaGenerator.test.ts` 작성
- [ ] Mock GitHub API 응답 fixture
- [ ] 코드 커버리지 > 85% 달성

---

### issue-generator-task-012: 통합 테스트 및 실제 GitHub Issue 생성 검증

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** issue-generator-task-011

#### 설명
실제 GitHub 테스트 리포지토리에 Issue를 생성하여 전체 플로우를 검증합니다.

#### 완료 조건
- [ ] `integration.test.ts` 파일 생성
- [ ] GitHub 테스트 리포지토리 설정 (샌드박스)
- [ ] High confidence 케이스 테스트 (완전한 정보)
- [ ] Medium confidence 케이스 테스트 (부분 정보)
- [ ] Low confidence 케이스 테스트 (`InsufficientDataError` 예상)
- [ ] 생성된 Issue 마크다운 검증 (렌더링 오류 없음)
- [ ] Label 생성 및 할당 확인
- [ ] GitHub API 모킹 (nock 또는 octokit mock)
- [ ] 마크다운 파싱 검증 (marked 또는 remark)

---

### issue-generator-task-013: 문서화 및 리스크 완화

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** issue-generator-task-012

#### 설명
API 문서를 작성하고 plan.md에서 식별된 리스크를 완화합니다.

#### 완료 조건
- [ ] `common/types/issue-generator.ts` 타입 정의 파일 생성
- [ ] JSDoc 주석 추가 (모든 public 메서드)
- [ ] README.md 작성 (사용법, 예제)
- [ ] 환경 변수 설정 가이드
- [ ] GitHub Rate Limit 모니터링 로직
- [ ] Secondary Rate Limit 대응 (배치 처리 지연)
- [ ] 마크다운 이스케이프 유틸리티 강화
- [ ] Issue body 최대 65536자 검증
- [ ] 코드 스니펫 길이 제한 (필요 시 truncate)
- [ ] Label 생성 권한 확인 및 fallback
- [ ] 에러 복구 전략 문서화
