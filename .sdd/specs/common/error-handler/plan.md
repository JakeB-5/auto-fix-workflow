---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Error Handler 구현 계획

## 기술 결정

### 결정 1: 에러 클래스 상속 구조
**선택:** AutofixError를 베이스로 한 단일 상속 계층
**근거:**
- Error 클래스를 확장하여 표준 에러 프로토콜 준수
- 모든 도메인 에러가 AutofixError를 상속하여 일관된 인터페이스 제공
- instanceof 체크로 타입 가드 가능
- 스택 트레이스 보존 (Error.captureStackTrace 활용)
**대안:**
- 각 도메인별 독립 베이스 클래스: 공통 처리 로직 중복
- 에러 객체 (클래스 없음): 타입 안전성 낮음, 스택 트레이스 관리 어려움

### 결정 2: 에러 코드 체계
**선택:** `{DOMAIN}_{ERROR_TYPE}` 형식의 문자열 리터럴 유니온 타입
**근거:**
- 도메인 프리픽스로 에러 출처 명확히 식별 (CONFIG_, GITHUB_, ASANA_ 등)
- TypeScript 타입 시스템이 허용된 코드만 사용하도록 강제
- 문자열이라 로그/API 응답에 직접 사용 가능
- 에러 코드 자동완성 지원
**대안:**
- 숫자 코드: 가독성 낮음, 코드 충돌 위험
- Symbol: 직렬화 불가능
- 계층형 코드 (CONFIG.FILE_NOT_FOUND): 타입 정의 복잡

### 결정 3: 에러 직렬화 전략
**선택:** toJSON() 메서드 구현
**근거:**
- JSON.stringify()가 자동으로 toJSON() 호출
- 민감 정보 마스킹을 직렬화 시점에 적용
- API 응답, 로그 전송에 바로 사용 가능
- 순환 참조 방지 (cause 체인 처리)
**대안:**
- 별도 serializer 함수: 사용 시 명시적 호출 필요, 누락 가능성
- toString() 오버라이드: JSON 형식 아님

### 결정 4: 민감 정보 마스킹
**선택:** 에러 details 필드에서 키워드 기반 마스킹
**근거:**
- token, password, api_key, secret 등의 키를 자동 탐지
- 중첩 객체 재귀 탐색으로 깊은 필드도 마스킹
- 로깅 시점이 아닌 에러 생성 시점에 마스킹하여 누출 방지
**대안:**
- 로거에서 마스킹: 에러 객체 자체는 민감정보 포함, 다른 경로로 누출 가능
- 수동 마스킹: 개발자가 직접 처리, 누락 위험

## 구현 단계

### Step 1: 베이스 에러 클래스 정의
AutofixError 베이스 클래스와 에러 코드 타입을 정의한다.
**산출물:**
- [ ] `src/common/error-handler/base-error.ts` - AutofixError 클래스
  - code, message, details 필드
  - Error 클래스 상속 및 스택 트레이스 보존
  - toJSON() 메서드 구현
- [ ] `src/common/error-handler/error-codes.ts` - ErrorCode 타입 정의
  - 모든 에러 코드를 문자열 리터럴 유니온으로 정의

### Step 2: Config 관련 에러 클래스
Config 도메인의 구체적인 에러 클래스를 구현한다.
**산출물:**
- [ ] `src/common/error-handler/config-errors.ts`
  - ConfigFileNotFoundError
  - ConfigParseError
  - ConfigValidationError

### Step 3: API 관련 에러 클래스
GitHub 및 Asana API 에러 클래스를 구현한다.
**산출물:**
- [ ] `src/common/error-handler/github-errors.ts`
  - GitHubAPIError
  - IssueNotFoundError
  - GitHubRateLimitError
- [ ] `src/common/error-handler/asana-errors.ts`
  - AsanaAPIError
  - TaskNotFoundError
  - TaskAnalysisError

### Step 4: Worktree 및 파싱 에러 클래스
Git Worktree 및 데이터 파싱 에러 클래스를 구현한다.
**산출물:**
- [ ] `src/common/error-handler/worktree-errors.ts`
  - WorktreeCreateError
  - WorktreeCleanupError
  - WorktreeAlreadyExistsError
- [ ] `src/common/error-handler/parsing-errors.ts`
  - IssueParseError
  - YAMLParseError

### Step 5: 체크 실패 에러 및 유틸리티
코드 체크 관련 에러와 에러 처리 유틸리티를 구현한다.
**산출물:**
- [ ] `src/common/error-handler/check-errors.ts`
  - CheckFailedError
  - TestFailedError
  - LintFailedError
- [ ] `src/common/error-handler/utils.ts` - 유틸리티 함수
  - `maskSensitiveData(obj: any): any` - 민감 정보 마스킹
  - `isAutofixError(error: unknown): error is AutofixError` - 타입 가드
  - `formatErrorForLogging(error: Error): object` - 로깅용 포맷
- [ ] `src/common/error-handler/index.ts` - Public API export

### Step 6: 테스트 및 문서화
단위 테스트와 에러 핸들링 가이드를 작성한다.
**산출물:**
- [ ] `tests/common/error-handler/base-error.test.ts` - 베이스 에러 테스트
- [ ] `tests/common/error-handler/serialization.test.ts` - 직렬화 테스트
- [ ] `tests/common/error-handler/masking.test.ts` - 민감정보 마스킹 테스트
- [ ] `README.md` - 에러 핸들링 가이드 및 베스트 프랙티스

## 테스트 전략
- 단위 테스트:
  - 각 에러 클래스의 인스턴스 생성 및 필드 검증
  - toJSON() 직렬화 결과 검증
  - 민감정보 마스킹 동작 검증 (중첩 객체 포함)
  - 스택 트레이스 보존 확인
  - 타입 가드 함수 동작 검증
- 통합 테스트:
  - 실제 사용 시나리오에서 에러 생성 및 전파
  - 에러 체인 (cause) 처리 검증
  - 로거와의 통합 테스트
- 에지 케이스:
  - 순환 참조 객체 직렬화
  - 매우 긴 스택 트레이스
  - null/undefined details

## 리스크 분석
| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 에러 코드 중복 또는 오타 | Medium | 코드 생성 시 자동 검증 스크립트, 타입 정의에서 관리 |
| 민감정보 마스킹 누락 (새로운 키워드) | High | 정규적인 보안 감사, 테스트에 다양한 키워드 포함 |
| 에러 스택이 너무 길어 성능 저하 | Low | 스택 트레이스 최대 길이 제한, 설정 가능하게 구현 |
| 직렬화 시 순환 참조로 인한 크래시 | Medium | WeakSet으로 방문 객체 추적, 순환 감지 시 참조 끊기 |
| 에러 메시지가 사용자에게 불친절 | Medium | 각 에러 클래스에 명확한 해결 방법 포함, 예제 제공 |

## 의존성
- 선행: common/types (ErrorCode 타입 등)
- 후행: common/logger (에러 로깅), 모든 도메인 feature (에러 throw)
