---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Config Loader 구현 계획

## 기술 결정

### 결정 1: YAML 파싱 라이브러리 선택
**선택:** js-yaml
**근거:**
- 가장 널리 사용되는 YAML 파서 (npm 주간 다운로드 20M+)
- TypeScript 타입 정의 제공 (@types/js-yaml)
- 에러 메시지가 명확하고 라인 번호 정보 제공
- 성능과 안정성이 검증됨
**대안:**
- yaml: 더 최신이지만 생태계가 js-yaml보다 작음
- 직접 파싱: 구현 복잡도와 유지보수 부담

### 결정 2: 스키마 검증 라이브러리 선택
**선택:** Zod
**근거:**
- TypeScript-first 설계로 타입 추론이 자동으로 동작
- 명확하고 읽기 쉬운 에러 메시지 제공
- 런타임 검증과 타입 정의를 동시에 해결
- 변환(transform) 기능으로 기본값 설정 및 환경변수 오버라이드 처리 가능
**대안:**
- Joi: TypeScript 지원이 약함, 타입 추론 불가
- Yup: Zod보다 번들 크기가 크고 타입 안전성이 낮음
- ajv: JSON Schema 기반이라 가독성이 떨어짐

### 결정 3: 환경변수 매핑 규칙
**선택:** `PREFIX_NESTED_KEY` 형태 (예: `GITHUB_OWNER`)
**근거:**
- 환경변수 네이밍 컨벤션을 따름 (대문자, 언더스코어)
- 중첩 구조를 평탄화하여 직관적 (github.owner → GITHUB_OWNER)
- dotenv와 호환성 유지
**대안:**
- Dot notation (GITHUB.OWNER): 쉘 환경에서 일부 문제 발생 가능
- 커스텀 매핑 파일: 관리 복잡도 증가

### 결정 4: 캐싱 전략
**선택:** 메모리 내 싱글톤 캐시
**근거:**
- 설정은 프로세스 라이프사이클 동안 변경되지 않음
- 파일 I/O 반복 방지로 성능 향상
- 강제 리로드 옵션으로 테스트 시 유연성 제공
**대안:**
- 캐싱 없음: 매번 파일 읽기로 성능 저하
- 파일 시스템 watch: 복잡도 증가, 대부분 불필요

## 구현 단계

### Step 1: Config 스키마 정의
Zod를 사용하여 Config 타입의 검증 스키마를 정의한다.
**산출물:**
- [ ] `src/common/config-loader/schema.ts` - Zod 스키마 정의
  - GitHubConfigSchema, AsanaConfigSchema, SentryConfigSchema 등
  - 기본값 설정 (default() 메서드)
  - 필수/선택 필드 구분

### Step 2: YAML 파싱 및 환경변수 통합
YAML 파일을 로딩하고 환경변수로 오버라이드하는 로직을 구현한다.
**산출물:**
- [ ] `src/common/config-loader/parser.ts` - YAML 파싱 함수
  - `loadYamlFile(path: string): unknown`
  - 파일 없음/파싱 에러 처리
- [ ] `src/common/config-loader/env-override.ts` - 환경변수 매핑
  - `applyEnvOverrides(config: unknown): unknown`
  - 중첩 경로 변환 (GITHUB_OWNER → github.owner)

### Step 3: Config 로더 메인 로직
캐싱과 검증을 포함한 메인 로더 함수를 구현한다.
**산출물:**
- [ ] `src/common/config-loader/loader.ts` - 메인 로더
  - `loadConfig(options?: { reload?: boolean }): Config`
  - 싱글톤 캐시 구현
  - Zod 검증 실행
- [ ] `src/common/config-loader/index.ts` - Public API export

### Step 4: 에러 처리 및 헬퍼 함수
설정 로딩 관련 에러 클래스와 유틸리티를 구현한다.
**산출물:**
- [ ] `src/common/config-loader/errors.ts` - 커스텀 에러 클래스
  - ConfigFileNotFoundError, ConfigParseError, ConfigValidationError
- [ ] `src/common/config-loader/utils.ts` - 유틸리티 함수
  - `getConfigPath(): string` - 프로젝트 루트에서 설정 파일 경로 찾기
  - `validateConfigFile(path: string): boolean` - 설정 파일 존재 및 권한 체크

### Step 5: 테스트 및 문서화
단위 테스트와 사용 예제를 작성한다.
**산출물:**
- [ ] `tests/common/config-loader/loader.test.ts` - 단위 테스트
- [ ] `tests/fixtures/` - 테스트용 설정 파일 샘플
- [ ] `README.md` - 설정 파일 형식 및 사용법 가이드

## 테스트 전략
- 단위 테스트:
  - YAML 파싱 성공/실패 케이스
  - 환경변수 오버라이드 동작 검증
  - Zod 검증 에러 메시지 확인
  - 캐싱 동작 검증 (reload 옵션 포함)
- 통합 테스트:
  - 실제 autofix.config.yml 파일 로딩
  - 다양한 설정 조합 검증
  - 기본값 적용 확인
- 에러 시나리오 테스트:
  - 파일 없음, 권한 없음, 잘못된 YAML, 스키마 위반

## 리스크 분석
| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 설정 파일 위치 찾기 실패 (monorepo 등) | Medium | 명시적 경로 옵션 제공, 상위 디렉토리 탐색 로직 |
| 환경변수 충돌 (다른 도구와 동일 prefix) | Low | AUTOFIX_ prefix 추가 고려, 문서화 강화 |
| Zod 검증 에러 메시지가 사용자에게 불친절 | Medium | 커스텀 에러 메시지 매핑, 예제 포함된 에러 안내 |
| 대용량 설정 파일 성능 문제 | Low | 설정 파일 크기 제한 정책, 검증 타임아웃 설정 |
| YAML 파싱 시 임의 코드 실행 취약점 | High | js-yaml의 safe load 사용, schema: 'DEFAULT_SAFE_SCHEMA' |

## 의존성
- 선행: common/types (Config 타입 정의 필요)
- 후행: 모든 도메인 feature (설정을 사용하는 모든 모듈)
