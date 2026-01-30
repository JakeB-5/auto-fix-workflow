---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 15
completed: 0
---

# Error Handler 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 6 | 12h |
| 🟡 MEDIUM | 6 | 10h |
| 🟢 LOW | 3 | 4h |
| **합계** | **15** | **26h** |

---

### error-handler-task-001: AutofixError 베이스 클래스 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
모든 도메인 에러의 베이스가 되는 AutofixError 클래스를 구현한다. Error 클래스를 상속하며 code, message, details 필드를 포함한다. 스택 트레이스를 보존한다.

#### 완료 조건
- [ ] `src/common/error-handler/base-error.ts` 파일 생성
- [ ] AutofixError 클래스 정의 (extends Error)
- [ ] code 필드 추가 (ErrorCode 타입)
- [ ] message, details 필드 추가
- [ ] Error.captureStackTrace 호출로 스택 보존
- [ ] constructor에서 name 속성 설정
- [ ] toJSON() 메서드 기본 구현

---

### error-handler-task-002: ErrorCode 타입 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
모든 에러 코드를 문자열 리터럴 유니온 타입으로 정의한다. 도메인 프리픽스로 출처를 명확히 하고 TypeScript의 타입 안전성을 활용한다.

#### 완료 조건
- [ ] `src/common/error-handler/error-codes.ts` 파일 생성
- [ ] Config 도메인 코드 정의 (CONFIG_FILE_NOT_FOUND, CONFIG_PARSE_ERROR, CONFIG_VALIDATION_ERROR)
- [ ] GitHub 도메인 코드 정의 (GITHUB_API_ERROR, ISSUE_NOT_FOUND, GITHUB_RATE_LIMIT)
- [ ] Asana 도메인 코드 정의 (ASANA_API_ERROR, TASK_NOT_FOUND, TASK_ANALYSIS_ERROR)
- [ ] Worktree 도메인 코드 정의 (WORKTREE_CREATE_ERROR, WORKTREE_CLEANUP_ERROR, WORKTREE_ALREADY_EXISTS)
- [ ] Parsing 도메인 코드 정의 (ISSUE_PARSE_ERROR, YAML_PARSE_ERROR)
- [ ] Check 도메인 코드 정의 (CHECK_FAILED, TEST_FAILED, LINT_FAILED)
- [ ] ErrorCode 타입을 유니온으로 export

---

### error-handler-task-003: toJSON 직렬화 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** error-handler-task-001

#### 설명
AutofixError의 toJSON() 메서드를 구현하여 에러를 JSON으로 직렬화한다. 민감 정보 마스킹과 순환 참조 처리를 포함한다.

#### 완료 조건
- [ ] toJSON() 메서드 구현
- [ ] code, message, stack 필드 포함
- [ ] details 객체 직렬화
- [ ] cause 체인 처리 (순환 참조 방지)
- [ ] 민감 정보 마스킹 적용 (maskSensitiveData 호출)
- [ ] JSON.stringify() 호환성 확인
- [ ] 최대 직렬화 깊이 제한 (예: 5 레벨)

---

### error-handler-task-004: 민감 정보 마스킹 유틸리티

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
에러 details에서 token, password, api_key, secret 등의 민감 정보를 자동으로 마스킹하는 유틸리티를 구현한다. 중첩 객체를 재귀적으로 탐색한다.

#### 완료 조건
- [ ] `src/common/error-handler/utils.ts` 파일 생성
- [ ] maskSensitiveData(obj: any): any 함수 구현
- [ ] SENSITIVE_KEYS 상수 정의 (token, password, api_key, secret, auth 등)
- [ ] 중첩 객체 재귀 탐색
- [ ] 민감 키 발견 시 값을 '***REDACTED***'로 대체
- [ ] 배열 내부 객체도 처리
- [ ] 순환 참조 방지 (WeakSet 활용)
- [ ] 원본 객체 변경하지 않음 (immutable)

---

### error-handler-task-005: 에러 타입 가드 및 포맷팅 유틸리티

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** error-handler-task-001

#### 설명
에러 타입을 확인하는 타입 가드와 로깅용 포맷팅 함수를 구현한다. instanceof 체크와 더 안전한 duck typing을 제공한다.

#### 완료 조건
- [ ] isAutofixError(error: unknown): error is AutofixError 함수 구현
- [ ] instanceof AutofixError 체크
- [ ] duck typing 체크 (code, message 필드 존재 확인)
- [ ] formatErrorForLogging(error: Error): object 함수 구현
- [ ] AutofixError는 toJSON() 사용
- [ ] 일반 Error는 message, stack 추출
- [ ] unknown 에러는 String() 변환

---

### error-handler-task-006: Config 에러 클래스 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** error-handler-task-001, error-handler-task-002

#### 설명
Config 도메인의 구체적인 에러 클래스를 구현한다. 각 에러는 명확한 메시지와 해결 방법을 제공한다.

#### 완료 조건
- [ ] `src/common/error-handler/config-errors.ts` 파일 생성
- [ ] ConfigFileNotFoundError 클래스 구현
- [ ] ConfigParseError 클래스 구현 (YAML 라인 번호 포함)
- [ ] ConfigValidationError 클래스 구현 (Zod 에러 변환)
- [ ] 각 에러에 적절한 errorCode 할당
- [ ] 에러 메시지에 해결 방법 포함
- [ ] details 필드에 추가 정보 (파일 경로, 라인 번호 등)

---

### error-handler-task-007: GitHub API 에러 클래스 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** error-handler-task-001, error-handler-task-002

#### 설명
GitHub API 호출 실패를 처리하는 에러 클래스를 구현한다. API 응답 코드와 메시지를 포함한다.

#### 완료 조건
- [ ] `src/common/error-handler/github-errors.ts` 파일 생성
- [ ] GitHubAPIError 클래스 구현 (status, response 필드)
- [ ] IssueNotFoundError 클래스 구현
- [ ] GitHubRateLimitError 클래스 구현 (reset_at 필드)
- [ ] 각 에러에 errorCode 할당
- [ ] GitHub API 응답을 details에 포함 (민감 정보 제외)
- [ ] rate limit 에러는 재시도 시간 계산

---

### error-handler-task-008: Asana API 에러 클래스 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** error-handler-task-001, error-handler-task-002

#### 설명
Asana API 호출 및 작업 분석 실패를 처리하는 에러 클래스를 구현한다.

#### 완료 조건
- [ ] `src/common/error-handler/asana-errors.ts` 파일 생성
- [ ] AsanaAPIError 클래스 구현
- [ ] TaskNotFoundError 클래스 구현
- [ ] TaskAnalysisError 클래스 구현 (분석 실패 이유)
- [ ] 각 에러에 errorCode 할당
- [ ] Asana task ID를 details에 포함
- [ ] API 응답 구조 직렬화

---

### error-handler-task-009: Worktree 에러 클래스 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** error-handler-task-001, error-handler-task-002

#### 설명
Git Worktree 작업 실패를 처리하는 에러 클래스를 구현한다.

#### 완료 조건
- [ ] `src/common/error-handler/worktree-errors.ts` 파일 생성
- [ ] WorktreeCreateError 클래스 구현
- [ ] WorktreeCleanupError 클래스 구현
- [ ] WorktreeAlreadyExistsError 클래스 구현
- [ ] 각 에러에 errorCode 할당
- [ ] worktree 경로와 branch 정보를 details에 포함
- [ ] git 명령 출력을 details에 포함

---

### error-handler-task-010: Parsing 및 Check 에러 클래스 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** error-handler-task-001, error-handler-task-002

#### 설명
데이터 파싱 및 코드 체크 실패를 처리하는 에러 클래스를 구현한다.

#### 완료 조건
- [ ] `src/common/error-handler/parsing-errors.ts` 파일 생성
- [ ] IssueParseError 클래스 구현 (파싱 실패한 섹션 정보)
- [ ] YAMLParseError 클래스 구현 (라인 번호)
- [ ] `src/common/error-handler/check-errors.ts` 파일 생성
- [ ] CheckFailedError 클래스 구현 (실패한 체크 타입)
- [ ] TestFailedError 클래스 구현 (실패한 테스트 목록)
- [ ] LintFailedError 클래스 구현 (lint 오류 목록)

---

### error-handler-task-011: Public API export

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** error-handler-task-001~010

#### 설명
Error Handler의 Public API를 정의하고 export한다. 모든 에러 클래스와 유틸리티 함수를 노출한다.

#### 완료 조건
- [ ] `src/common/error-handler/index.ts` 파일 생성
- [ ] AutofixError 및 모든 에러 클래스 export
- [ ] ErrorCode 타입 export
- [ ] 유틸리티 함수 export (maskSensitiveData, isAutofixError 등)
- [ ] 네임스페이스 그룹핑 고려
- [ ] 파일 상단에 모듈 개요 JSDoc 추가

---

### error-handler-task-012: 단위 테스트 - 베이스 에러 및 직렬화

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** error-handler-task-001, error-handler-task-003

#### 설명
AutofixError의 기본 동작과 toJSON() 직렬화를 테스트한다.

#### 완료 조건
- [ ] `tests/common/error-handler/base-error.test.ts` 파일 생성
- [ ] 에러 인스턴스 생성 및 필드 검증
- [ ] 스택 트레이스 보존 확인
- [ ] toJSON() 직렬화 결과 검증
- [ ] JSON.stringify() 호환성 확인
- [ ] 순환 참조 처리 테스트
- [ ] cause 체인 테스트

---

### error-handler-task-013: 단위 테스트 - 민감정보 마스킹

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** error-handler-task-004

#### 설명
민감 정보 마스킹 로직을 다양한 케이스로 테스트한다.

#### 완료 조건
- [ ] `tests/common/error-handler/masking.test.ts` 파일 생성
- [ ] 단일 레벨 객체 마스킹 테스트
- [ ] 중첩 객체 마스킹 테스트
- [ ] 배열 내부 객체 마스킹 테스트
- [ ] 민감 키가 없는 경우 테스트
- [ ] 순환 참조 객체 테스트
- [ ] 원본 객체 불변성 확인

---

### error-handler-task-014: 통합 테스트 - 실제 사용 시나리오

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** error-handler-task-006~010

#### 설명
실제 워크플로우에서 에러 생성, 전파, 로깅을 시뮬레이션한다.

#### 완료 조건
- [ ] `tests/common/error-handler/integration.test.ts` 파일 생성
- [ ] Config 로딩 실패 시나리오
- [ ] GitHub API 호출 실패 시나리오
- [ ] 에러 체인 (cause) 전파 테스트
- [ ] 로거와의 통합 (formatErrorForLogging)
- [ ] 타입 가드 동작 확인

---

### error-handler-task-015: README 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** error-handler-task-001~011

#### 설명
Error Handler 사용 가이드를 작성한다. 에러 처리 베스트 프랙티스를 포함한다.

#### 완료 조건
- [ ] `src/common/error-handler/README.md` 파일 생성
- [ ] 모듈 개요 및 목적 설명
- [ ] AutofixError 사용 예제
- [ ] 각 도메인별 에러 클래스 설명
- [ ] 커스텀 에러 클래스 생성 가이드
- [ ] toJSON()과 로깅 통합 예제
- [ ] 민감 정보 마스킹 가이드
- [ ] ErrorCode 목록 문서화
