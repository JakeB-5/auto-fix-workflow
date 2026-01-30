---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 14
completed: 0
---

# Logger 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 5 | 10h |
| 🟡 MEDIUM | 6 | 10h |
| 🟢 LOW | 3 | 4h |
| **합계** | **14** | **24h** |

---

### logger-task-001: Logger 타입 및 인터페이스 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** common/types

#### 설명
ILogger 인터페이스와 LogLevel, LogContext 등의 타입을 정의한다. pino의 API와 호환되며 확장 가능한 구조로 설계한다.

#### 완료 조건
- [ ] `src/common/logger/types.ts` 파일 생성
- [ ] LogLevel 타입 정의 ("trace" | "debug" | "info" | "warn" | "error" | "fatal")
- [ ] LogContext 인터페이스 정의 (추가 메타데이터)
- [ ] ILogger 인터페이스 정의 (info, warn, error, debug, child 메서드)
- [ ] LogOptions 인터페이스 정의 (level, pretty, redact)
- [ ] JSDoc 주석 추가

---

### logger-task-002: 기본 설정 관리

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** logger-task-001

#### 설명
Logger의 기본 설정을 관리하는 모듈을 구현한다. 환경변수(LOG_LEVEL, NODE_ENV)를 읽어 설정을 조정한다.

#### 완료 조건
- [ ] `src/common/logger/config.ts` 파일 생성
- [ ] DEFAULT_LOG_LEVEL 상수 정의 (개발: debug, 프로덕션: info)
- [ ] getLogLevel(): LogLevel 함수 구현 (환경변수 LOG_LEVEL 읽기)
- [ ] isPrettyMode(): boolean 함수 구현 (NODE_ENV === 'development')
- [ ] getRedactPaths(): string[] 함수 구현 (민감 필드 경로)
- [ ] 설정 검증 (잘못된 LOG_LEVEL 값 처리)

---

### logger-task-003: Pino 기반 Logger 클래스 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** logger-task-001, logger-task-002

#### 설명
ILogger 인터페이스를 구현하는 Pino 기반 Logger 클래스를 작성한다. info, warn, error, debug 메서드와 child() 메서드를 제공한다.

#### 완료 조건
- [ ] `src/common/logger/logger.ts` 파일 생성
- [ ] Logger 클래스 정의 (implements ILogger)
- [ ] pino 인스턴스 초기화 (level, redact 옵션)
- [ ] info(msg, context?) 메서드 구현
- [ ] warn(msg, context?) 메서드 구현
- [ ] error(msg, error?, context?) 메서드 구현
- [ ] debug(msg, context?) 메서드 구현
- [ ] child(context) 메서드 구현 (pino.child 호출)
- [ ] 조건부 로깅 지원 (lazy evaluation)

---

### logger-task-004: 민감 정보 마스킹 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
로그에서 token, password, api_key 등의 민감 정보를 자동으로 마스킹하는 로직을 구현한다. pino의 redact 옵션과 커스텀 마스킹을 조합한다.

#### 완료 조건
- [ ] `src/common/logger/redact.ts` 파일 생성
- [ ] SENSITIVE_KEYS 상수 정의 (token, password, api_key, secret, auth 등)
- [ ] createRedactPaths(): string[] 함수 구현 (pino redact 경로)
- [ ] maskSensitiveFields(obj: any): any 함수 구현 (재귀 마스킹)
- [ ] 중첩 객체 및 배열 처리
- [ ] 순환 참조 방지
- [ ] 원본 객체 불변성 유지

---

### logger-task-005: 커스텀 Serializer 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** common/error-handler (AutofixError)

#### 설명
Error 객체와 AutofixError를 로그에 출력하기 위한 커스텀 serializer를 구현한다. pino의 serializers 옵션에 등록한다.

#### 완료 조건
- [ ] `src/common/logger/serializers.ts` 파일 생성
- [ ] errorSerializer(error: Error): object 함수 구현
- [ ] 일반 Error는 message, stack 추출
- [ ] AutofixError는 toJSON() 호출하여 code, details 포함
- [ ] cause 체인 처리
- [ ] pino 설정에 serializers 등록

---

### logger-task-006: 조건부 포맷팅 (pino-pretty) 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** logger-task-002, logger-task-003

#### 설명
개발 환경에서는 가독성 좋은 pino-pretty를 사용하고, 프로덕션에서는 JSON 형식을 사용하도록 조건부 포맷팅을 구현한다.

#### 완료 조건
- [ ] `src/common/logger/formatter.ts` 파일 생성
- [ ] createTransport(pretty: boolean): TransportOptions 함수 구현
- [ ] NODE_ENV === 'development'일 때 pino-pretty 활성화
- [ ] pino-pretty 옵션 설정 (colorize, translateTime)
- [ ] 프로덕션에서는 표준 JSON 출력
- [ ] 타임스탬프 포맷 (ISO 8601)

---

### logger-task-007: MemoryLogger 구현 (테스트용)

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** logger-task-001

#### 설명
테스트 환경에서 사용할 MemoryLogger를 구현한다. 로그를 메모리에 저장하여 검증 가능하게 하고 stdout 오염을 방지한다.

#### 완료 조건
- [ ] `src/common/logger/memory-logger.ts` 파일 생성
- [ ] MemoryLogger 클래스 정의 (implements ILogger)
- [ ] 로그를 배열에 저장하는 destination 구현
- [ ] getLogs(): LogEntry[] 메서드 구현
- [ ] getLogCount(): number 메서드 구현
- [ ] getLogsByLevel(level: LogLevel): LogEntry[] 메서드 구현
- [ ] clear(): void 메서드 구현
- [ ] pino destination을 메모리 스트림으로 설정

---

### logger-task-008: Logger 팩토리 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** logger-task-003, logger-task-007

#### 설명
환경에 맞는 Logger 인스턴스를 생성하는 팩토리 함수를 구현한다. 테스트 환경에서는 MemoryLogger를 반환한다.

#### 완료 조건
- [ ] `src/common/logger/factory.ts` 파일 생성
- [ ] createLogger(options?: LogOptions): ILogger 함수 구현
- [ ] NODE_ENV === 'test'일 때 MemoryLogger 반환
- [ ] 그 외에는 일반 Logger 반환
- [ ] options로 설정 오버라이드 가능
- [ ] 싱글톤 패턴 고려 (optional)

---

### logger-task-009: 전역 Logger 인스턴스 관리

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** logger-task-008

#### 설명
전역에서 접근 가능한 Logger 인스턴스를 관리하는 모듈을 구현한다. setLogger, getLogger 함수를 제공한다.

#### 완료 조건
- [ ] `src/common/logger/global.ts` 파일 생성
- [ ] 전역 변수 globalLogger 선언
- [ ] getLogger(): ILogger 함수 구현 (globalLogger 반환, 없으면 생성)
- [ ] setLogger(logger: ILogger): void 함수 구현
- [ ] 초기화 지연 (lazy initialization)
- [ ] 테스트에서 쉽게 교체 가능하도록 설계

---

### logger-task-010: 유틸리티 함수 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
로깅에 유용한 유틸리티 함수를 구현한다. 대용량 객체 처리, 실행 시간 포맷팅 등을 제공한다.

#### 완료 조건
- [ ] `src/common/logger/utils.ts` 파일 생성
- [ ] truncateObject(obj: any, maxDepth: number, maxLength: number): any 함수 구현
- [ ] 재귀 깊이 제한
- [ ] 문자열 길이 제한
- [ ] formatDuration(ms: number): string 함수 구현 (예: "1.23s", "456ms")
- [ ] createLogContext(data: object): LogContext 함수 구현
- [ ] 타임스탬프 자동 추가

---

### logger-task-011: Public API export

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** logger-task-001~010

#### 설명
Logger의 Public API를 정의하고 export한다. 사용자는 이 파일을 통해 Logger를 사용한다.

#### 완료 조건
- [ ] `src/common/logger/index.ts` 파일 생성
- [ ] getLogger, setLogger 함수 export
- [ ] createLogger 함수 export
- [ ] ILogger, LogLevel, LogContext 타입 export
- [ ] 내부 구현은 export하지 않음
- [ ] 파일 상단에 모듈 개요 JSDoc 추가

---

### logger-task-012: 단위 테스트 - Logger 기본 동작

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** logger-task-003, logger-task-007

#### 설명
Logger의 기본 동작을 테스트한다. 각 로그 레벨, 레벨 필터링, child logger를 검증한다.

#### 완료 조건
- [ ] `tests/common/logger/logger.test.ts` 파일 생성
- [ ] MemoryLogger로 테스트 설정
- [ ] info, warn, error, debug 메서드 출력 검증
- [ ] 로그 레벨 필터링 테스트 (debug 비활성화 시 출력 안됨)
- [ ] child logger 컨텍스트 상속 검증
- [ ] 조건부 로깅 (lazy evaluation) 테스트

---

### logger-task-013: 단위 테스트 - 민감정보 마스킹

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** logger-task-004

#### 설명
민감 정보 마스킹 로직을 테스트한다. 다양한 객체 구조에서 마스킹을 검증한다.

#### 완료 조건
- [ ] `tests/common/logger/redact.test.ts` 파일 생성
- [ ] 단일 레벨 객체 마스킹 테스트
- [ ] 중첩 객체 마스킹 테스트
- [ ] 배열 내부 객체 마스킹 테스트
- [ ] pino redact 옵션 적용 확인
- [ ] 민감 키가 없는 경우 테스트

---

### logger-task-014: README 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** logger-task-001~011

#### 설명
Logger 사용 가이드를 작성한다. 기본 사용법, 설정, 베스트 프랙티스를 포함한다.

#### 완료 조건
- [ ] `src/common/logger/README.md` 파일 생성
- [ ] 모듈 개요 및 pino 선택 이유 설명
- [ ] getLogger() 사용 예제
- [ ] child logger 사용 예제
- [ ] 환경변수 설정 가이드 (LOG_LEVEL)
- [ ] Error 로깅 예제
- [ ] 민감 정보 마스킹 가이드
- [ ] 테스트에서 MemoryLogger 사용 예제
- [ ] 성능 최적화 팁 (조건부 로깅)
