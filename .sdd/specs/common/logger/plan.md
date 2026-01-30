---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Logger 구현 계획

## 기술 결정

### 결정 1: 로깅 라이브러리 선택
**선택:** pino
**근거:**
- 가장 빠른 Node.js JSON 로거 (비동기 I/O, 최소 직렬화 오버헤드)
- 구조화된 로깅 기본 지원 (JSON 형식)
- Child logger 지원으로 컨텍스트 관리 용이
- 광범위한 생태계 (pino-pretty for dev, transports for production)
- TypeScript 타입 정의 제공
**대안:**
- winston: 더 느리고 복잡한 API, 하지만 더 많은 기능
- bunyan: 유지보수 정체, pino가 후속 프로젝트
- 직접 구현: 성능과 안정성 보장 어려움

### 결정 2: 민감 정보 마스킹 방식
**선택:** pino의 redact 옵션 + 커스텀 serializer
**근거:**
- pino의 redact는 경로 기반 마스킹 지원 (예: `config.github_token`)
- serializer로 복잡한 객체 (Error, AutofixError) 커스텀 처리
- 중첩 객체 재귀 마스킹은 커스텀 함수로 구현
- 성능 최적화: 로깅 시점이 아닌 직렬화 시점에만 처리
**대안:**
- 수동 마스킹: 모든 로그 호출마다 수동 처리 필요, 누락 위험
- 별도 마스킹 레이어: 추가 직렬화 오버헤드

### 결정 3: 개발 환경 로그 포맷
**선택:** pino-pretty (조건부 사용)
**근거:**
- 개발 환경에서 가독성 좋은 로그 출력
- 프로덕션에서는 비활성화하여 성능 유지
- NODE_ENV 기반 자동 전환
**대안:**
- 항상 JSON: 개발 시 가독성 떨어짐
- 커스텀 포매터: 유지보수 부담

### 결정 4: 테스트 환경 로거
**선택:** MemoryLogger 구현 (pino 기반)
**근거:**
- 테스트 시 stdout 오염 방지
- 로그 검증 가능 (getLogs, getLogsByLevel 메서드)
- pino의 destination을 메모리 스트림으로 대체
**대안:**
- pino의 silent 레벨 사용: 로그 검증 불가능
- 별도 Logger 인터페이스 구현: 코드 중복

## 구현 단계

### Step 1: Logger 인터페이스 및 기본 설정
ILogger 인터페이스와 pino 기반 기본 구현을 작성한다.
**산출물:**
- [ ] `src/common/logger/types.ts` - 타입 정의
  - LogLevel, LogContext, ILogger 인터페이스
- [ ] `src/common/logger/config.ts` - 설정 관리
  - 기본 설정 (레벨, 포맷, redact 경로)
  - 환경변수 기반 설정 (LOG_LEVEL, NODE_ENV)
- [ ] `src/common/logger/logger.ts` - Pino 기반 Logger 클래스
  - info, warn, error, debug 메서드
  - child() 메서드로 컨텍스트 추가

### Step 2: 민감 정보 마스킹
민감 정보 자동 마스킹 로직을 구현한다.
**산출물:**
- [ ] `src/common/logger/redact.ts` - 마스킹 로직
  - `SENSITIVE_KEYS` 상수 (token, password, api_key, secret 등)
  - `createRedactPaths()` - pino redact 옵션 생성
  - `maskSensitiveFields(obj)` - 중첩 객체 재귀 마스킹
- [ ] `src/common/logger/serializers.ts` - 커스텀 serializer
  - Error 객체 serializer (stack, message 추출)
  - AutofixError serializer (code, details 포함)

### Step 3: 조건부 로깅 및 성능 최적화
로그 레벨 필터링 및 성능 최적화를 구현한다.
**산출물:**
- [ ] `src/common/logger/logger.ts` 확장
  - 조건부 로그 생성 지원 (lazy evaluation)
  - `logger.debug(() => expensiveOperation())` 형태 지원
- [ ] `src/common/logger/formatter.ts` - 포매터 설정
  - pino-pretty 조건부 적용 (NODE_ENV === 'development')
  - 타임스탬프 포맷 (ISO 8601)

### Step 4: 테스트 환경 지원
테스트용 MemoryLogger를 구현한다.
**산출물:**
- [ ] `src/common/logger/memory-logger.ts` - MemoryLogger 클래스
  - 메모리 스트림으로 로그 저장
  - getLogs(), getLogCount(), getLogsByLevel(), clear() 메서드
- [ ] `src/common/logger/factory.ts` - Logger 팩토리
  - `createLogger(options?)` - 환경에 맞는 Logger 인스턴스 생성
  - NODE_ENV === 'test'일 때 MemoryLogger 반환

### Step 5: 전역 Logger 및 유틸리티
전역 Logger 인스턴스와 헬퍼 함수를 구현한다.
**산출물:**
- [ ] `src/common/logger/global.ts` - 전역 Logger
  - 싱글톤 Logger 인스턴스
  - `setLogger(logger)`, `getLogger()` 함수
- [ ] `src/common/logger/utils.ts` - 유틸리티 함수
  - `truncateObject(obj, maxDepth, maxLength)` - 대용량 객체 처리
  - `formatDuration(ms)` - 실행 시간 포맷팅
- [ ] `src/common/logger/index.ts` - Public API export

### Step 6: 테스트 및 문서화
단위 테스트와 로깅 가이드를 작성한다.
**산출물:**
- [ ] `tests/common/logger/logger.test.ts` - Logger 기본 동작 테스트
- [ ] `tests/common/logger/redact.test.ts` - 민감정보 마스킹 테스트
- [ ] `tests/common/logger/memory-logger.test.ts` - MemoryLogger 테스트
- [ ] `README.md` - 로깅 가이드 및 베스트 프랙티스

## 테스트 전략
- 단위 테스트:
  - 각 로그 레벨 출력 검증
  - 레벨 필터링 동작 확인
  - 민감정보 마스킹 (중첩 객체, 배열 포함)
  - Child logger 컨텍스트 상속 검증
  - MemoryLogger의 getLogs 등 메서드 동작
- 통합 테스트:
  - 실제 AutofixError 로깅
  - 대용량 객체 로깅 성능
  - stdout/stderr 분리 확인
- 성능 테스트:
  - 10,000개 로그 출력 시 메모리 사용량
  - 조건부 로깅의 lazy evaluation 검증

## 리스크 분석
| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 대용량 로그로 인한 메모리/디스크 압박 | Medium | 로그 로테이션 설정, 최대 로그 크기 제한, truncate 로직 |
| 민감정보 마스킹 우회 (새로운 필드명) | High | 정규적인 보안 감사, 테스트 케이스 지속 추가, 포괄적 패턴 매칭 |
| pino-pretty로 인한 프로덕션 성능 저하 | Medium | NODE_ENV 확인 로직 추가, CI/CD에서 프로덕션 빌드 검증 |
| 순환 참조 객체 로깅 시 크래시 | Low | pino의 기본 순환 참조 처리 활용, 추가 안전장치 |
| 테스트 환경에서 로그 검증 누락 | Low | MemoryLogger 사용을 강제하는 테스트 유틸리티 제공 |

## 의존성
- 선행: common/types (LogLevel, LogContext 타입), common/error-handler (AutofixError)
- 후행: 모든 도메인 feature (로깅을 사용하는 모든 모듈)
