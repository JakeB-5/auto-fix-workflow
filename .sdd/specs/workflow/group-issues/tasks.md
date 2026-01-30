---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 10
completed: 0
---

# Group Issues 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|-----------|
| 🔴 HIGH | 4 | 10h |
| 🟡 MEDIUM | 4 | 8h |
| 🟢 LOW | 2 | 4h |

---

### group-issues-task-001: 기본 인터페이스 및 타입 정의

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** 없음

#### 설명
그룹화에 필요한 TypeScript 타입 및 인터페이스 정의.

#### 완료 조건
- [ ] `GroupIssuesParams` 인터페이스 정의 (issues, group_by, max_group_size)
- [ ] `GroupIssuesResult` 인터페이스 정의 (groups)
- [ ] `IssueGroup` 인터페이스 정의 (key, issues, suggested_branch)
- [ ] `IssueDetail` 내부 타입 정의 (number, title, body, labels)
- [ ] `GroupBy` union 타입 정의 ("component" | "file" | "label")
- [ ] 파라미터 검증 함수 구현 (Zod 사용)

---

### group-issues-task-002: GitHub API 연동 및 이슈 정보 수집

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** group-issues-task-001

#### 설명
Octokit을 사용하여 GitHub 이슈 상세 정보를 병렬로 조회.

#### 완료 조건
- [ ] Octokit 초기화 함수 구현 (환경변수에서 token 읽기)
- [ ] `fetchIssueDetails()` 함수 구현
- [ ] Promise.all을 사용한 병렬 API 호출
- [ ] IssueDetail 객체 배열 생성 (number, title, body, labels)
- [ ] 메모리 기반 캐싱 구현 (Map 사용)
- [ ] 에러 처리 (404, rate limit, 네트워크 에러)
- [ ] 단위 테스트 작성 (Mock API 응답)

---

### group-issues-task-003: 컴포넌트 정보 추출 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** group-issues-task-002

#### 설명
이슈 템플릿 및 타이틀에서 컴포넌트명을 추출하는 다중 패턴 파싱 구현.

#### 완료 조건
- [ ] `extractComponent()` 함수 구현
- [ ] YAML frontmatter 파싱 (js-yaml 사용)
- [ ] "Context.컴포넌트:" 패턴 정규식
- [ ] "Component:" 패턴 정규식
- [ ] 타이틀 패턴 "[컴포넌트명]" 정규식
- [ ] 폴백: null 반환 (컴포넌트 정보 없음)
- [ ] 단위 테스트 작성 (각 패턴별 시나리오)

---

### group-issues-task-004: 파일 경로 추출 로직 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** group-issues-task-002

#### 설명
이슈 본문에서 파일 경로 및 코드 블록의 import 문을 추출.

#### 완료 조건
- [ ] `extractFilePaths()` 함수 구현
- [ ] 파일 경로 정규식 패턴 (src/**/*.{ts,tsx,js,jsx})
- [ ] 코드 블록 추출 정규식 (```...```)
- [ ] import/from 문 파싱 정규식
- [ ] 상대 경로 및 절대 경로 필터링
- [ ] 중복 제거 (Set 사용)
- [ ] 단위 테스트 작성 (다양한 경로 패턴)

---

### group-issues-task-005: 그룹화 알고리즘 구현 (컴포넌트, 파일, 라벨)

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** group-issues-task-003, group-issues-task-004

#### 설명
세 가지 그룹화 전략을 구현하고 Map 자료구조로 효율적으로 관리.

#### 완료 조건
- [ ] `groupByComponent()` 함수 구현 (extractComponent 활용)
- [ ] `groupByFile()` 함수 구현 (중복 허용, 여러 그룹 가능)
- [ ] `groupByLabel()` 함수 구현 (라벨별 그룹핑)
- [ ] "unknown" 그룹 처리 (정보 없는 이슈)
- [ ] Map<string, number[]> 반환 (그룹 키 → 이슈 번호 배열)
- [ ] 빈 그룹 필터링
- [ ] 단위 테스트 작성 (각 그룹화 전략별)

---

### group-issues-task-006: 브랜치명 생성 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** group-issues-task-005

#### 설명
이슈 개수와 그룹 키에 따라 적절한 브랜치명을 자동 생성.

#### 완료 조건
- [ ] `generateBranchName()` 함수 구현
- [ ] 1개 이슈: `fix/issue-{N}` 형식
- [ ] 2-3개 이슈: `fix/issue-{N1}-{N2}-{N3}` 형식
- [ ] 4개 이상: `fix/{group-key}-issues` 형식
- [ ] `sanitize()` 함수 구현 (kebab-case 변환, 특수문자 제거)
- [ ] 브랜치명 길이 제한 50자 처리 (truncate)
- [ ] 단위 테스트 작성 (모든 케이스)

---

### group-issues-task-007: 메인 함수 및 그룹 크기 검증 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** group-issues-task-006

#### 설명
전체 그룹화 워크플로우를 통합하고 최대 그룹 크기 검증 추가.

#### 완료 조건
- [ ] `groupIssues()` 메인 함수 구현
- [ ] 파라미터 검증 호출
- [ ] 이슈 상세 정보 조회 (fetchIssueDetails)
- [ ] group_by 파라미터별 분기 (component, file, label)
- [ ] IssueGroup 객체 배열 생성
- [ ] 최대 그룹 크기 체크 (기본값 5, 초과 시 경고 로그)
- [ ] 그룹 정렬 (크기 기준 내림차순)
- [ ] GroupIssuesResult 반환

---

### group-issues-task-008: 단위 테스트 작성

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** group-issues-task-007

#### 설명
각 함수의 정확성을 검증하는 단위 테스트 작성.

#### 완료 조건
- [ ] extractComponent() 테스트 (YAML, Context, Component, 타이틀 패턴)
- [ ] extractFilePaths() 테스트 (다양한 경로 형식)
- [ ] generateBranchName() 테스트 (1개, 2-3개, 4개 이상)
- [ ] sanitize() 테스트 (특수문자, 대소문자, 공백 처리)
- [ ] groupByComponent/File/Label 테스트
- [ ] 테스트 커버리지 80% 이상

---

### group-issues-task-009: 통합 테스트 및 Mock API 테스트

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** group-issues-task-008

#### 설명
GitHub API를 Mock하여 전체 그룹화 플로우 검증.

#### 완료 조건
- [ ] MSW 또는 nock을 사용한 GitHub API Mock 설정
- [ ] 정상 API 응답 시나리오 테스트
- [ ] 404 에러 시나리오 테스트
- [ ] Rate limit 초과 시나리오 테스트
- [ ] 네트워크 타임아웃 시나리오 테스트
- [ ] 캐싱 동작 검증 (중복 호출 방지)
- [ ] 모든 테스트 통과

---

### group-issues-task-010: E2E 테스트 및 성능 검증

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** group-issues-task-009

#### 설명
실제 GitHub 테스트 레포지토리를 사용한 E2E 테스트 및 성능 측정.

#### 완료 조건
- [ ] 테스트용 이슈 생성 (beforeAll, 최소 10개)
- [ ] 컴포넌트 기반 그룹화 E2E 테스트
- [ ] 파일 기반 그룹화 E2E 테스트 (중복 허용 확인)
- [ ] 라벨 기반 그룹화 E2E 테스트
- [ ] 최대 그룹 크기 초과 경고 검증
- [ ] 성능 측정 (50개 이슈 그룹화 <5초)
- [ ] 테스트 이슈 정리 (afterAll)
