---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Common Types 구현 계획

## 기술 결정

### 결정 1: TypeScript 순수 타입 정의 방식
**선택:** interface와 type alias 혼합 사용
**근거:**
- interface는 확장 가능하고 구조적 타이핑에 적합 (Issue, PullRequest 등 데이터 구조)
- type alias는 유니온 타입과 제네릭에 적합 (Result<T,E>, WorktreeAction 등)
- 도메인별 확장 가능성을 고려하여 기본 엔티티는 interface로 정의
**대안:**
- 모두 interface로 통일: 유니온 타입 표현이 불편
- 모두 type alias로 통일: 선언 병합(declaration merging) 불가능

### 결정 2: Result 타입의 discriminated union 패턴
**선택:** success 필드를 discriminator로 사용
**근거:**
- TypeScript의 타입 가드가 자동으로 작동하여 타입 안전성 보장
- success === true일 때 data 필드 접근, false일 때 error 필드 접근을 컴파일러가 검증
- Rust의 Result 타입과 유사한 패턴으로 익숙함
**대안:**
- Either 모나드 패턴: 러닝 커브가 높고 추가 라이브러리 필요
- 예외 기반: 타입 시스템으로 에러 케이스를 표현할 수 없음

### 결정 3: Config 타입의 중첩 구조
**선택:** 도메인별 Config를 별도 타입으로 정의하고 최상위 Config에서 조합
**근거:**
- 각 도메인(GitHub, Asana, Worktree 등)의 독립적인 설정 관리 가능
- 타입 재사용성 증가 (GitHubConfig를 다른 곳에서도 사용 가능)
- 설정 검증 시 도메인별로 분리된 로직 작성 용이
**대안:**
- Flat한 단일 Config 타입: 네임스페이스 충돌 가능성, 관심사 분리 어려움
- Map 기반 동적 타입: 타입 안전성 상실

## 구현 단계

### Step 1: 기본 타입 정의
Issue, PullRequest, Config 관련 핵심 타입과 인터페이스를 정의한다.
**산출물:**
- [ ] `src/common/types/issue.ts` - Issue, IssueContext, IssueSource 타입
- [ ] `src/common/types/pull-request.ts` - PullRequest, CreatePRParams 타입
- [ ] `src/common/types/config.ts` - GitHubConfig, AsanaConfig, SentryConfig, WorktreeConfig, Config 타입

### Step 2: Result 타입 및 유틸리티 타입 정의
제네릭 Result 타입과 워크플로우 관련 유틸리티 타입을 정의한다.
**산출물:**
- [ ] `src/common/types/result.ts` - Result<T, E> 타입 및 타입 가드 함수
- [ ] `src/common/types/worktree.ts` - WorktreeInfo, WorktreeAction, CreateWorktreeParams 타입
- [ ] `src/common/types/check.ts` - CheckType, SingleCheckResult, CheckResult 타입

### Step 3: 고급 타입 및 그룹핑 타입 정의
이슈 그룹핑 및 복합 워크플로우 지원 타입을 정의한다.
**산출물:**
- [ ] `src/common/types/issue-group.ts` - IssueGroup, GroupBy 타입
- [ ] `src/common/types/index.ts` - 모든 타입을 re-export하는 배럴 파일

### Step 4: 타입 검증 및 문서화
JSDoc 주석을 추가하고 타입 정의의 정확성을 검증한다.
**산출물:**
- [ ] 모든 타입에 JSDoc 주석 추가 (필드 설명, 예제)
- [ ] `README.md` - 타입 사용 가이드 및 예제 코드
- [ ] 타입 테스트 파일 (컴파일 타임 검증용)

## 테스트 전략
- 단위 테스트: TypeScript 컴파일러를 활용한 타입 레벨 테스트
  - `ts-expect-error`로 잘못된 타입 사용 검증
  - 타입 가드 함수(Result 판별) 단위 테스트
- 통합 테스트: 실제 사용 시나리오 기반 타입 검증
  - Config 타입을 사용한 설정 로딩 시뮬레이션
  - Result 타입을 사용한 에러 핸들링 시뮬레이션

## 리스크 분석
| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 타입 정의가 너무 엄격하여 유연성 저하 | Medium | optional 필드를 적극 활용하고, Partial<T> 유틸리티 타입 제공 |
| 타입 변경 시 모든 도메인 영향 | High | 타입 버전 관리 정책 수립, 하위 호환성 유지, deprecated 타입 명확히 표시 |
| GitHub/Asana API 응답 구조 변경 | Medium | API 타입을 내부 타입으로 변환하는 어댑터 레이어 도입 |
| Result 타입 사용의 일관성 부족 | Low | ESLint 규칙 추가하여 Result 타입 사용 강제 |

## 의존성
- 선행: 없음 (이 feature가 모든 feature의 기반)
- 후행: config-loader, error-handler, issue-parser, logger (모두 이 타입에 의존)
