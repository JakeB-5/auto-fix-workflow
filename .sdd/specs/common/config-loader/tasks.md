---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 14
completed: 0
---

# Config Loader 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|----------|
| 🔴 HIGH | 5 | 10h |
| 🟡 MEDIUM | 6 | 10h |
| 🟢 LOW | 3 | 4h |
| **합계** | **14** | **24h** |

---

### config-loader-task-001: Zod 스키마 정의

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** common/types (Config 타입)

#### 설명
Zod를 사용하여 Config 타입의 런타임 검증 스키마를 정의한다. TypeScript 타입 정의와 런타임 검증을 동시에 해결하며, 기본값 설정과 변환 로직을 포함한다.

#### 완료 조건
- [ ] `src/common/config-loader/schema.ts` 파일 생성
- [ ] GitHubConfigSchema 정의 (owner, repo, token 필수)
- [ ] AsanaConfigSchema 정의 (workspace_id, project_id, token)
- [ ] SentryConfigSchema 정의 (org, project, auth_token 선택)
- [ ] WorktreeConfigSchema 정의 (base_path, cleanup_policy 기본값)
- [ ] 최상위 ConfigSchema에서 도메인별 스키마 조합
- [ ] default() 메서드로 기본값 설정
- [ ] transform()으로 문자열 트림, 대소문자 정규화 등 처리

---

### config-loader-task-002: YAML 파싱 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
js-yaml을 사용하여 autofix.config.yml 파일을 파싱한다. 파일 없음, 파싱 에러, 권한 문제 등을 처리한다. 보안을 위해 safe load를 사용한다.

#### 완료 조건
- [ ] `src/common/config-loader/parser.ts` 파일 생성
- [ ] loadYamlFile(path: string): unknown 함수 구현
- [ ] js-yaml의 safeLoad 사용 (arbitrary code execution 방지)
- [ ] 파일 없음 시 ConfigFileNotFoundError throw
- [ ] YAML 파싱 에러 시 ConfigParseError throw (라인 번호 포함)
- [ ] 파일 읽기 권한 에러 처리
- [ ] 빈 파일 처리 (빈 객체 반환)

---

### config-loader-task-003: 환경변수 오버라이드 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** config-loader-task-002

#### 설명
환경변수를 통해 YAML 설정을 오버라이드하는 로직을 구현한다. PREFIX_NESTED_KEY 형태를 중첩 객체 경로로 변환한다 (예: GITHUB_OWNER → github.owner).

#### 완료 조건
- [ ] `src/common/config-loader/env-override.ts` 파일 생성
- [ ] applyEnvOverrides(config: unknown): unknown 함수 구현
- [ ] GITHUB_, ASANA_, SENTRY_, WORKTREE_ prefix 인식
- [ ] 언더스코어를 중첩 경로로 변환 (GITHUB_OWNER → github.owner)
- [ ] 환경변수 값 타입 변환 (문자열 → 숫자, 불린 등)
- [ ] 존재하지 않는 경로는 무시
- [ ] 환경변수 우선순위 (env > yaml)

---

### config-loader-task-004: 메인 로더 및 캐싱 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** config-loader-task-001, config-loader-task-002, config-loader-task-003

#### 설명
YAML 파싱, 환경변수 오버라이드, Zod 검증을 통합하는 메인 로더를 구현한다. 싱글톤 패턴으로 캐싱하여 중복 로딩을 방지한다.

#### 완료 조건
- [ ] `src/common/config-loader/loader.ts` 파일 생성
- [ ] loadConfig(options?: { reload?: boolean }): Config 함수 구현
- [ ] 싱글톤 캐시 변수 (cachedConfig) 선언
- [ ] reload 옵션으로 캐시 무시 기능
- [ ] YAML 로딩 → 환경변수 오버라이드 → Zod 검증 순서로 처리
- [ ] 검증 실패 시 ConfigValidationError throw
- [ ] 검증 성공 시 캐시에 저장 및 반환

---

### config-loader-task-005: Public API export

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1h
- **의존성:** config-loader-task-004

#### 설명
Config Loader의 Public API를 정의하고 export한다. 내부 구현은 숨기고 필요한 함수와 타입만 노출한다.

#### 완료 조건
- [ ] `src/common/config-loader/index.ts` 파일 생성
- [ ] loadConfig 함수 export
- [ ] ConfigSchema export (외부에서 확장 가능하도록)
- [ ] 커스텀 에러 클래스 export
- [ ] 내부 구현 함수는 export하지 않음
- [ ] 파일 상단에 모듈 개요 JSDoc 추가

---

### config-loader-task-006: 커스텀 에러 클래스 정의

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** common/error-handler (AutofixError)

#### 설명
Config 로딩 관련 에러를 명확히 구분하기 위한 커스텀 에러 클래스를 정의한다. 각 에러는 해결 방법을 포함한 메시지를 제공한다.

#### 완료 조건
- [ ] `src/common/config-loader/errors.ts` 파일 생성
- [ ] ConfigFileNotFoundError 클래스 구현
- [ ] ConfigParseError 클래스 구현 (라인 번호 포함)
- [ ] ConfigValidationError 클래스 구현 (Zod 에러 변환)
- [ ] 각 에러에 errorCode 할당 (CONFIG_FILE_NOT_FOUND 등)
- [ ] 에러 메시지에 해결 방법 포함
- [ ] Zod ValidationError를 사용자 친화적 메시지로 변환

---

### config-loader-task-007: 설정 파일 경로 찾기 유틸리티

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
프로젝트 루트에서 autofix.config.yml 파일을 찾는 유틸리티를 구현한다. 현재 디렉토리부터 상위로 탐색하며 monorepo 구조도 지원한다.

#### 완료 조건
- [ ] `src/common/config-loader/utils.ts` 파일 생성
- [ ] getConfigPath(startDir?: string): string 함수 구현
- [ ] 현재 디렉토리부터 상위로 autofix.config.yml 탐색
- [ ] .git 디렉토리 발견 시 탐색 중단 (repo root)
- [ ] 파일 발견 못하면 ConfigFileNotFoundError throw
- [ ] 명시적 경로 옵션 제공 (환경변수 AUTOFIX_CONFIG_PATH)
- [ ] validateConfigFile(path: string): boolean 함수 구현

---

### config-loader-task-008: 설정 파일 검증 유틸리티

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** config-loader-task-007

#### 설명
설정 파일의 존재 여부, 읽기 권한, 기본 형식을 검증하는 유틸리티를 구현한다.

#### 완료 조건
- [ ] validateConfigFile(path: string): boolean 구현
- [ ] 파일 존재 확인 (fs.existsSync)
- [ ] 읽기 권한 확인 (fs.accessSync with R_OK)
- [ ] 파일 크기 제한 확인 (예: 1MB 이하)
- [ ] 확장자 검증 (.yml 또는 .yaml)
- [ ] 검증 실패 시 구체적인 에러 메시지

---

### config-loader-task-009: 기본값 설정 전략 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** config-loader-task-001

#### 설명
필수 필드와 선택 필드를 구분하고 선택 필드에 대한 합리적인 기본값을 설정한다. Zod의 default()와 optional()을 활용한다.

#### 완료 조건
- [ ] GitHubConfig의 기본 branch 값 설정 ("main")
- [ ] WorktreeConfig의 기본 base_path 설정 ("./worktrees")
- [ ] WorktreeConfig의 기본 cleanup_policy 설정 ("auto")
- [ ] SentryConfig 전체를 optional로 설정
- [ ] 기본값 문서화 (JSDoc 또는 README)
- [ ] 기본값 테스트 작성

---

### config-loader-task-010: 단위 테스트 - YAML 파싱

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** config-loader-task-002

#### 설명
YAML 파싱 함수의 성공/실패 케이스를 테스트한다. 다양한 에러 시나리오를 커버한다.

#### 완료 조건
- [ ] `tests/common/config-loader/parser.test.ts` 파일 생성
- [ ] 정상 YAML 파싱 테스트
- [ ] 잘못된 YAML 문법 테스트 (파싱 에러)
- [ ] 파일 없음 테스트
- [ ] 읽기 권한 없음 테스트 (mock)
- [ ] 빈 파일 테스트
- [ ] 매우 큰 파일 테스트 (크기 제한)

---

### config-loader-task-011: 단위 테스트 - 환경변수 오버라이드

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** config-loader-task-003

#### 설명
환경변수로 YAML 설정을 오버라이드하는 로직을 테스트한다. 다양한 prefix와 중첩 경로를 검증한다.

#### 완료 조건
- [ ] `tests/common/config-loader/env-override.test.ts` 파일 생성
- [ ] GITHUB_OWNER 환경변수로 github.owner 오버라이드 테스트
- [ ] 여러 도메인 환경변수 동시 적용 테스트
- [ ] 존재하지 않는 경로 환경변수 무시 테스트
- [ ] 타입 변환 테스트 (숫자, 불린)
- [ ] 환경변수 우선순위 테스트 (env > yaml)

---

### config-loader-task-012: 통합 테스트 - 전체 로딩 플로우

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** config-loader-task-004, config-loader-task-010, config-loader-task-011

#### 설명
YAML 로딩부터 환경변수 오버라이드, Zod 검증, 캐싱까지 전체 플로우를 통합 테스트한다.

#### 완료 조건
- [ ] `tests/common/config-loader/loader.test.ts` 파일 생성
- [ ] 실제 autofix.config.yml 파일로 로딩 테스트
- [ ] 캐싱 동작 검증 (두 번째 호출은 캐시에서)
- [ ] reload 옵션 테스트 (캐시 무시)
- [ ] Zod 검증 성공/실패 케이스
- [ ] 다양한 설정 조합 테스트

---

### config-loader-task-013: 테스트 픽스처 준비

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
테스트에 사용할 다양한 형태의 설정 파일 샘플을 준비한다.

#### 완료 조건
- [ ] `tests/fixtures/autofix.config.valid.yml` 생성 (완전한 설정)
- [ ] `tests/fixtures/autofix.config.minimal.yml` 생성 (최소 필수 필드만)
- [ ] `tests/fixtures/autofix.config.invalid.yml` 생성 (스키마 위반)
- [ ] `tests/fixtures/autofix.config.malformed.yml` 생성 (YAML 문법 오류)
- [ ] `tests/fixtures/autofix.config.partial.yml` 생성 (일부 필드 누락)

---

### config-loader-task-014: README 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** config-loader-task-001~012

#### 설명
Config Loader 사용 가이드를 작성한다. 설정 파일 형식, 환경변수 사용법, 예제 코드를 포함한다.

#### 완료 조건
- [ ] `src/common/config-loader/README.md` 파일 생성
- [ ] autofix.config.yml 형식 설명
- [ ] 각 Config 도메인별 필드 설명
- [ ] 환경변수 오버라이드 가이드 (GITHUB_OWNER 예제)
- [ ] loadConfig() 사용 예제
- [ ] 에러 처리 가이드
- [ ] 기본값 목록 문서화
