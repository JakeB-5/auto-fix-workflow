---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Issue Parser 구현 계획

## 기술 결정

### 결정 1: 마크다운 파싱 라이브러리 선택
**선택:** remark + unist-util-visit
**근거:**
- remark는 마크다운을 AST(Abstract Syntax Tree)로 파싱하여 구조적 탐색 가능
- unist-util-visit로 AST 노드를 쉽게 순회하며 필요한 섹션 추출
- 플러그인 생태계가 풍부하여 확장 용이
- 잘못된 마크다운에도 robust하게 동작
**대안:**
- 정규식 기반 파싱: 복잡한 중첩 구조 처리 어려움, 유지보수 힘듦
- marked + cheerio: HTML로 변환 후 파싱은 오버헤드
- 직접 파서 구현: 마크다운 표준 처리 복잡

### 결정 2: 섹션 인식 전략
**선택:** Heading 노드를 기준으로 섹션 구분
**근거:**
- GitHub Issue 템플릿은 `## Context`, `## Problem Description` 등 Heading으로 구분됨
- Heading 노드 이후의 모든 컨텐츠를 해당 섹션으로 인식 (다음 Heading 전까지)
- 대소문자 무관 매칭으로 템플릿 변형 허용
**대안:**
- 고정 라인 번호: 템플릿 변경 시 깨짐
- HTML 주석 마커: Issue 작성자가 수정하면 동작 안함

### 결정 3: Context 필드 추출 방식
**선택:** 볼드(**) 키워드 기반 key-value 파싱
**근거:**
- GitHub 템플릿 관례: `**파일**: \`src/file.ts\`` 형태
- 볼드 텍스트 다음의 콜론(:)까지를 키로, 이후를 값으로 추출
- 코드 블록(backtick) 안의 텍스트는 자동으로 추출
**대안:**
- 테이블 파싱: 템플릿에 테이블이 없으면 동작 안함
- YAML frontmatter: Issue 작성 UX 저하

### 결정 4: 파싱 실패 시 fallback 전략
**선택:** Partial 파싱 + warnings 반환
**근거:**
- 일부 필드만 추출 가능해도 유용한 정보 제공
- 누락된 필드는 undefined/빈 문자열로 설정
- warnings 배열에 파싱 실패한 섹션 기록
- 완전 실패 시에만 IssueParseError throw
**대안:**
- 엄격한 검증 (all or nothing): 템플릿 약간만 벗어나도 실패
- 조용히 무시: 디버깅 어려움

## 구현 단계

### Step 1: 마크다운 AST 파싱 유틸리티
remark를 사용하여 Issue 본문을 AST로 변환하는 기본 유틸리티를 구현한다.
**산출물:**
- [ ] `src/common/issue-parser/markdown-ast.ts` - AST 파싱
  - `parseMarkdown(body: string): Root` - remark로 AST 생성
  - `findSection(ast: Root, heading: string): Section` - Heading 노드로 섹션 찾기
  - Section 타입 정의 (heading, content 노드 배열)

### Step 2: Context 섹션 파서
Context 섹션에서 파일, 함수, 라인, 컴포넌트 정보를 추출한다.
**산출물:**
- [ ] `src/common/issue-parser/parsers/context.ts`
  - `parseContextSection(section: Section): IssueContext`
  - 볼드 키워드 추출 (파일, 함수/클래스, 라인, 컴포넌트)
  - 코드 블록 내 텍스트 추출
  - 누락 필드 처리

### Step 3: Code Analysis 및 Source 파서
코드 분석 섹션과 출처 정보를 파싱한다.
**산출물:**
- [ ] `src/common/issue-parser/parsers/code-analysis.ts`
  - `parseCodeAnalysisSection(section: Section): CodeAnalysis`
  - 코드 블록 추출 (언어 정보 포함)
- [ ] `src/common/issue-parser/parsers/source.ts`
  - `parseSourceSection(section: Section): IssueSource`
  - Origin 값 추출 ("Sentry" | "Asana" | "Direct")
  - Reference 링크 추출

### Step 4: Type 및 Problem Description 파서
이슈 타입과 문제 설명을 파싱한다.
**산출물:**
- [ ] `src/common/issue-parser/parsers/type.ts`
  - `parseTypeSection(section: Section): string`
  - 체크박스 리스트에서 체크된 항목 찾기
  - "🔴 Sentry Error" → "error" 매핑
- [ ] `src/common/issue-parser/parsers/problem-description.ts`
  - `parseProblemDescription(section: Section): ProblemDescription`
  - 에러 메시지, 발생 조건, 재현 빈도 추출

### Step 5: Suggested Fix 및 Acceptance Criteria 파서
수정 제안과 완료 조건을 파싱한다.
**산출물:**
- [ ] `src/common/issue-parser/parsers/suggested-fix.ts`
  - `parseSuggestedFix(section: Section): SuggestedFix`
  - 불릿 리스트 항목 추출
  - 참고 코드 위치 추출 (파일 경로 패턴 매칭)
- [ ] `src/common/issue-parser/parsers/acceptance-criteria.ts`
  - `parseAcceptanceCriteria(section: Section): AcceptanceCriteria[]`
  - 체크리스트 항목 및 체크 상태 파싱

### Step 6: 메인 파서 통합 및 에러 처리
모든 파서를 통합하고 에러 처리 로직을 구현한다.
**산출물:**
- [ ] `src/common/issue-parser/parser.ts` - 메인 파서
  - `parseIssue(issueBody: string): ParsedIssue`
  - 모든 섹션 파서 호출 및 결과 조합
  - 빈 본문, 잘못된 형식 처리
  - warnings 배열 생성
- [ ] `src/common/issue-parser/validators.ts` - 검증 로직
  - 필수 필드 검증
  - 컴포넌트 이름 유효성 검사
- [ ] `src/common/issue-parser/index.ts` - Public API export

### Step 7: 테스트 및 문서화
다양한 템플릿 변형에 대한 테스트를 작성한다.
**산출물:**
- [ ] `tests/common/issue-parser/fixtures/` - 테스트 픽스처
  - 완전한 템플릿, 일부 누락 템플릿, 잘못된 형식
- [ ] `tests/common/issue-parser/parser.test.ts` - 통합 테스트
- [ ] `tests/common/issue-parser/parsers/` - 개별 파서 단위 테스트
- [ ] `README.md` - Issue 템플릿 형식 가이드

## 테스트 전략
- 단위 테스트:
  - 각 섹션 파서별 입력/출력 검증
  - 코드 블록 추출 (언어 정보 포함)
  - 볼드 키워드 파싱
  - 체크박스 리스트 파싱
- 통합 테스트:
  - 실제 GitHub Issue 템플릿 전체 파싱
  - Sentry, Asana, Direct 출처별 템플릿
  - 필드 누락 시나리오
  - 잘못된 마크다운 형식
- 에지 케이스:
  - 빈 섹션, 중복 Heading, 중첩된 코드 블록
  - 특수문자 포함된 파일 경로
  - 매우 긴 에러 메시지

## 리스크 분석
| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| Issue 템플릿 변경 시 파서 동작 불가 | High | 템플릿 버전 관리, 호환성 테스트 자동화, 유연한 매칭 로직 |
| 사용자가 템플릿을 임의로 수정 | Medium | Partial 파싱 지원, warnings 제공, 최소 정보만으로 동작 |
| 마크다운 파싱 성능 문제 (매우 긴 Issue) | Low | Issue 크기 제한, 파싱 타임아웃 설정 |
| 언어별 코드 블록 인식 실패 | Medium | 언어 정보 없는 코드 블록도 허용, 내용 기반 추론 |
| 정규식 기반 패턴 매칭의 한계 | Medium | AST 기반 접근으로 구조적 파싱, 정규식은 보조적 사용 |

## 의존성
- 선행: common/types (Issue, IssueContext 등 타입), common/error-handler (IssueParseError)
- 후행: github-integration (파싱된 Issue 사용), issue-grouping (Context 기반 그룹핑)
