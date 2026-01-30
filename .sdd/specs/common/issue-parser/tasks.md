---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 16
completed: 0
---

# Issue Parser 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 7 | 14h |
| 🟡 MEDIUM | 6 | 10h |
| 🟢 LOW | 3 | 6h |
| **합계** | **16** | **30h** |

---

### issue-parser-task-001: 마크다운 AST 파싱 유틸리티

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
remark를 사용하여 Issue 본문을 AST(Abstract Syntax Tree)로 변환하는 기본 유틸리티를 구현한다. Heading 노드로 섹션을 구분한다.

#### 완료 조건
- [ ] `src/common/issue-parser/markdown-ast.ts` 파일 생성
- [ ] remark 및 unist-util-visit 의존성 추가
- [ ] parseMarkdown(body: string): Root 함수 구현
- [ ] remark().parse()로 AST 생성
- [ ] Section 타입 정의 (heading: string, nodes: Node[])
- [ ] findSection(ast: Root, heading: string): Section | null 함수 구현
- [ ] Heading 노드 대소문자 무관 매칭
- [ ] 다음 Heading까지의 모든 노드를 섹션에 포함

---

### issue-parser-task-002: Context 섹션 파서

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-parser-task-001, common/types (IssueContext)

#### 설명
Context 섹션에서 파일, 함수, 라인, 컴포넌트 정보를 추출한다. 볼드(**) 키워드를 기준으로 key-value를 파싱한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/context.ts` 파일 생성
- [ ] parseContextSection(section: Section): IssueContext 함수 구현
- [ ] 볼드 텍스트(강조) 노드 추출
- [ ] "파일:", "함수/클래스:", "라인:", "컴포넌트:" 키워드 인식
- [ ] 코드 블록(backtick) 내 텍스트 추출
- [ ] 누락 필드는 undefined로 설정
- [ ] 여러 파일이 언급된 경우 첫 번째 사용
- [ ] 라인 번호 파싱 (숫자 추출)

---

### issue-parser-task-003: Code Analysis 섹션 파서

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-parser-task-001

#### 설명
Code Analysis 섹션에서 코드 블록과 분석 내용을 추출한다. 언어 정보도 함께 파싱한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/code-analysis.ts` 파일 생성
- [ ] parseCodeAnalysisSection(section: Section): CodeAnalysis 함수 구현
- [ ] CodeAnalysis 타입 정의 (code: string, language?: string, analysis: string)
- [ ] 코드 블록(code) 노드 추출
- [ ] 언어 정보 추출 (예: ```typescript)
- [ ] 코드 블록 외의 텍스트를 analysis로 수집
- [ ] 여러 코드 블록이 있는 경우 첫 번째 사용
- [ ] 코드 블록이 없으면 빈 문자열

---

### issue-parser-task-004: Source 섹션 파서

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** issue-parser-task-001, common/types (IssueSource)

#### 설명
Source 섹션에서 이슈 출처(Sentry, Asana, Direct)와 참조 링크를 추출한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/source.ts` 파일 생성
- [ ] parseSourceSection(section: Section): IssueSource 함수 구현
- [ ] Origin 값 추출 ("Sentry" | "Asana" | "Direct")
- [ ] 링크(link) 노드에서 URL 추출
- [ ] Origin 키워드 대소문자 무관 매칭
- [ ] Origin이 없으면 기본값 "Direct"
- [ ] 여러 링크가 있는 경우 첫 번째를 reference로 사용

---

### issue-parser-task-005: Type 섹션 파서

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-parser-task-001

#### 설명
Type 섹션에서 이슈 타입을 추출한다. 체크박스 리스트에서 체크된 항목을 찾는다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/type.ts` 파일 생성
- [ ] parseTypeSection(section: Section): string 함수 구현
- [ ] 체크박스 리스트(listItem with checked: true) 노드 찾기
- [ ] "🔴 Sentry Error" → "error" 매핑
- [ ] "🟡 Asana Task" → "task" 매핑
- [ ] "🟢 Direct Issue" → "direct" 매핑
- [ ] 체크된 항목이 없으면 "unknown" 반환
- [ ] 여러 항목이 체크된 경우 첫 번째 사용

---

### issue-parser-task-006: Problem Description 섹션 파서

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-parser-task-001

#### 설명
Problem Description 섹션에서 에러 메시지, 발생 조건, 재현 빈도를 추출한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/problem-description.ts` 파일 생성
- [ ] parseProblemDescription(section: Section): ProblemDescription 함수 구현
- [ ] ProblemDescription 타입 정의 (error_message, conditions, frequency)
- [ ] "에러 메시지:", "발생 조건:", "재현 빈도:" 키워드 인식
- [ ] 코드 블록에서 에러 메시지 추출
- [ ] 불릿 리스트에서 조건 수집
- [ ] 빈도 텍스트 추출 (예: "항상", "가끔")
- [ ] 누락 필드는 빈 문자열 또는 빈 배열

---

### issue-parser-task-007: Suggested Fix 섹션 파서

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** issue-parser-task-001

#### 설명
Suggested Fix 섹션에서 수정 제안 내용과 참고 코드 위치를 추출한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/suggested-fix.ts` 파일 생성
- [ ] parseSuggestedFix(section: Section): SuggestedFix 함수 구현
- [ ] SuggestedFix 타입 정의 (suggestions: string[], references?: string[])
- [ ] 불릿 리스트 항목을 suggestions로 수집
- [ ] 파일 경로 패턴 매칭 (정규식)
- [ ] 인라인 코드(backtick) 내 파일 경로 추출
- [ ] references 배열에 파일 경로 수집
- [ ] suggestions가 비어있으면 빈 배열

---

### issue-parser-task-008: Acceptance Criteria 섹션 파서

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-parser-task-001

#### 설명
Acceptance Criteria 섹션에서 체크리스트 항목과 완료 상태를 파싱한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parsers/acceptance-criteria.ts` 파일 생성
- [ ] parseAcceptanceCriteria(section: Section): AcceptanceCriteria[] 함수 구현
- [ ] AcceptanceCriteria 타입 정의 (description: string, completed: boolean)
- [ ] 체크박스 리스트 항목 추출
- [ ] checked 상태 확인 (true/false)
- [ ] 각 항목의 텍스트를 description으로 사용
- [ ] 빈 리스트는 빈 배열 반환

---

### issue-parser-task-009: 메인 파서 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-parser-task-002~008

#### 설명
모든 섹션 파서를 통합하여 Issue 본문을 완전히 파싱하는 메인 함수를 구현한다.

#### 완료 조건
- [ ] `src/common/issue-parser/parser.ts` 파일 생성
- [ ] parseIssue(issueBody: string): ParsedIssue 함수 구현
- [ ] ParsedIssue 타입 정의 (모든 섹션 결과 포함)
- [ ] 마크다운 AST 파싱
- [ ] 각 섹션별 파서 호출
- [ ] 파싱 실패한 섹션 warnings 배열에 기록
- [ ] 필수 섹션 누락 시 경고 추가
- [ ] 빈 본문 처리 (IssueParseError throw)

---

### issue-parser-task-010: 에러 처리 및 fallback

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** issue-parser-task-009, common/error-handler (IssueParseError)

#### 설명
파싱 실패 시 fallback 전략을 구현한다. Partial 파싱을 지원하고 warnings를 제공한다.

#### 완료 조건
- [ ] 각 섹션 파서를 try-catch로 감싸기
- [ ] 섹션 파싱 실패 시 warnings 배열에 추가
- [ ] 파싱 실패한 필드는 undefined/빈 값으로 설정
- [ ] 완전 실패 조건 정의 (예: 모든 섹션 실패)
- [ ] 완전 실패 시 IssueParseError throw
- [ ] 잘못된 마크다운 형식 처리
- [ ] 매우 긴 Issue 본문 처리 (크기 제한 고려)

---

### issue-parser-task-011: 검증 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** issue-parser-task-009

#### 설명
파싱된 결과의 유효성을 검증하는 로직을 구현한다. 필수 필드와 형식을 확인한다.

#### 완료 조건
- [ ] `src/common/issue-parser/validators.ts` 파일 생성
- [ ] validateParsedIssue(parsed: ParsedIssue): ValidationResult 함수 구현
- [ ] 필수 필드 존재 확인 (예: context.file, problem_description)
- [ ] 파일 경로 형식 검증 (기본 패턴 매칭)
- [ ] 컴포넌트 이름 유효성 검사 (영문, 숫자, 하이픈, 슬래시)
- [ ] 라인 번호 유효성 검사 (양수)
- [ ] ValidationResult 타입 정의 (valid: boolean, errors: string[])

---

### issue-parser-task-012: Public API export

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** issue-parser-task-009~011

#### 설명
Issue Parser의 Public API를 정의하고 export한다. 메인 파서와 타입만 노출한다.

#### 완료 조건
- [ ] `src/common/issue-parser/index.ts` 파일 생성
- [ ] parseIssue 함수 export
- [ ] ParsedIssue 타입 export
- [ ] 각 섹션별 타입 export (IssueContext, ProblemDescription 등)
- [ ] 내부 파서 함수는 export하지 않음
- [ ] 파일 상단에 모듈 개요 JSDoc 추가

---

### issue-parser-task-013: 테스트 픽스처 준비

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
다양한 형태의 Issue 템플릿 샘플을 테스트 픽스처로 준비한다.

#### 완료 조건
- [ ] `tests/common/issue-parser/fixtures/` 디렉토리 생성
- [ ] `complete-template.md` - 모든 섹션이 완전한 템플릿
- [ ] `sentry-error.md` - Sentry 출처 에러 템플릿
- [ ] `asana-task.md` - Asana 작업 템플릿
- [ ] `partial-template.md` - 일부 섹션 누락
- [ ] `malformed.md` - 잘못된 마크다운 형식
- [ ] `minimal.md` - 최소 필수 정보만 포함

---

### issue-parser-task-014: 단위 테스트 - 개별 파서

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 3h
- **의존성:** issue-parser-task-002~008

#### 설명
각 섹션 파서의 입력/출력을 단위 테스트한다.

#### 완료 조건
- [ ] `tests/common/issue-parser/parsers/context.test.ts` 생성
- [ ] `tests/common/issue-parser/parsers/code-analysis.test.ts` 생성
- [ ] `tests/common/issue-parser/parsers/source.test.ts` 생성
- [ ] `tests/common/issue-parser/parsers/type.test.ts` 생성
- [ ] `tests/common/issue-parser/parsers/problem-description.test.ts` 생성
- [ ] `tests/common/issue-parser/parsers/suggested-fix.test.ts` 생성
- [ ] `tests/common/issue-parser/parsers/acceptance-criteria.test.ts` 생성
- [ ] 각 파서의 정상 케이스 및 에지 케이스 테스트

---

### issue-parser-task-015: 통합 테스트

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** issue-parser-task-009, issue-parser-task-013

#### 설명
실제 Issue 템플릿을 전체 파싱하는 통합 테스트를 작성한다.

#### 완료 조건
- [ ] `tests/common/issue-parser/parser.test.ts` 파일 생성
- [ ] 완전한 템플릿 파싱 테스트
- [ ] Sentry 출처 템플릿 파싱 테스트
- [ ] Asana 작업 템플릿 파싱 테스트
- [ ] 일부 누락 템플릿 파싱 및 warnings 검증
- [ ] 잘못된 형식 처리 테스트
- [ ] 빈 본문 에러 테스트
- [ ] 모든 픽스처 파일 사용

---

### issue-parser-task-016: README 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** issue-parser-task-001~012

#### 설명
Issue Parser 사용 가이드와 템플릿 형식 문서를 작성한다.

#### 완료 조건
- [ ] `src/common/issue-parser/README.md` 파일 생성
- [ ] 모듈 개요 및 remark 선택 이유 설명
- [ ] parseIssue() 사용 예제
- [ ] 지원하는 Issue 템플릿 형식 설명
- [ ] 각 섹션 형식 가이드 (Heading, 키워드)
- [ ] 파싱 실패 시 fallback 동작 설명
- [ ] warnings 배열 활용 가이드
- [ ] 템플릿 작성 베스트 프랙티스
