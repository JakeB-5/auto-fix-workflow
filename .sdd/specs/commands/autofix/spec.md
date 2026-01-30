---
status: draft
created: 2026-01-30
domain: commands
feature: autofix
depends: [github/list-issues, workflow/group-issues, git/manage-worktree, checks/run-checks, github/create-pr, github/update-issue]
---

# /autofix Slash Command

> GitHub Issue 자동 수정 워크플로우를 시작하는 슬래시 커맨드

---

## Requirement: REQ-CMD-001 - 기본 실행 (모든 auto-fix 이슈)

사용자가 파라미터 없이 `/autofix`를 실행하면 모든 auto-fix 라벨 이슈를 처리해야 한다(SHALL).

### Scenario: 파라미터 없이 실행

- **GIVEN** 사용자가 Claude Code에서 작업 중이고
- **WHEN** `/autofix`를 입력하면
- **THEN** `auto-fix` 라벨이 있고 `auto-fix-skip` 라벨이 없는 모든 open 이슈를 조회해야 함
- **AND** 조회된 이슈 목록과 그룹핑 제안을 사용자에게 표시해야 함
- **AND** 사용자 확인 후 처리를 시작해야 함

### Scenario: 처리 대상 이슈 없음

- **GIVEN** `auto-fix` 라벨 이슈가 없고
- **WHEN** `/autofix`를 실행하면
- **THEN** "처리 대상 이슈가 없습니다" 메시지를 출력해야 함
- **AND** 워크플로우를 종료해야 함

---

## Requirement: REQ-CMD-002 - 특정 이슈 지정

사용자가 `--issues` 옵션으로 특정 이슈만 처리할 수 있어야 한다(SHALL).

### Scenario: 단일 이슈 지정

- **GIVEN** 사용자가 Issue #123만 처리하길 원하고
- **WHEN** `/autofix --issues 123`을 실행하면
- **THEN** Issue #123만 처리 대상으로 선택되어야 함
- **AND** 그룹핑 단계를 건너뛰어야 함

### Scenario: 다중 이슈 지정

- **GIVEN** 사용자가 Issue #123, #124, #125를 처리하길 원하고
- **WHEN** `/autofix --issues 123,124,125`를 실행하면
- **THEN** 3개 이슈가 처리 대상으로 선택되어야 함
- **AND** 그룹핑 제안을 사용자에게 표시해야 함

### Scenario: 존재하지 않는 이슈 지정

- **GIVEN** Issue #999가 존재하지 않고
- **WHEN** `/autofix --issues 999`를 실행하면
- **THEN** "Issue #999를 찾을 수 없습니다" 에러를 출력해야 함
- **AND** 워크플로우를 종료해야 함

### Scenario: auto-fix 라벨 없는 이슈 지정

- **GIVEN** Issue #200이 `auto-fix` 라벨이 없고
- **WHEN** `/autofix --issues 200`을 실행하면
- **THEN** 경고 메시지와 함께 계속 진행할지 확인해야 함
- **AND** 사용자가 승인하면 처리를 진행해야 함

---

## Requirement: REQ-CMD-003 - 일괄 처리 모드

`--all` 옵션으로 사용자 확인 없이 모든 이슈를 자동 처리해야 한다(SHALL).

### Scenario: 일괄 자동 처리

- **GIVEN** 사용자가 즉시 모든 이슈를 처리하길 원하고
- **WHEN** `/autofix --all`을 실행하면
- **THEN** 이슈 조회 및 그룹핑을 자동으로 수행해야 함
- **AND** 사용자 확인 없이 즉시 처리를 시작해야 함
- **AND** 진행 상황을 실시간으로 출력해야 함

### Scenario: dry-run과 함께 사용 불가

- **GIVEN** 사용자가 `--all --dry-run`을 함께 사용하고
- **WHEN** `/autofix --all --dry-run`을 실행하면
- **THEN** "--all과 --dry-run은 함께 사용할 수 없습니다" 에러를 출력해야 함

---

## Requirement: REQ-CMD-004 - Dry-run 모드

`--dry-run` 옵션으로 실제 수정 없이 계획만 출력해야 한다(SHALL).

### Scenario: 계획만 표시

- **GIVEN** 사용자가 실행 계획을 미리 보길 원하고
- **WHEN** `/autofix --dry-run`을 실행하면
- **THEN** 이슈 조회, 그룹핑, 브랜치명 제안까지만 수행해야 함
- **AND** 실제 worktree 생성, 코드 수정, PR 생성은 하지 않아야 함
- **AND** 다음 정보를 출력해야 함:
  - 처리 대상 이슈 목록
  - 그룹핑 결과
  - 생성될 브랜치명
  - 예상 처리 시간

### Scenario: dry-run 후 실제 실행

- **GIVEN** 사용자가 dry-run 결과를 확인했고
- **WHEN** 실제 실행을 원하면
- **THEN** 새로 `/autofix` 명령을 실행해야 함 (dry-run은 상태를 저장하지 않음)

---

## Requirement: REQ-CMD-005 - 병렬 처리 제한

`--max-parallel` 옵션으로 동시 처리 worktree 수를 제한해야 한다(SHALL).

### Scenario: 병렬 처리 수 제한

- **GIVEN** 10개의 이슈 그룹이 있고
- **WHEN** `/autofix --max-parallel 2`를 실행하면
- **THEN** 최대 2개의 worktree만 동시에 생성되어야 함
- **AND** 하나가 완료되면 다음 그룹을 처리해야 함
- **AND** 모든 그룹이 순차적으로 처리되어야 함

### Scenario: 기본값 (3개)

- **GIVEN** `--max-parallel` 옵션을 지정하지 않고
- **WHEN** `/autofix`를 실행하면
- **THEN** 기본값 3개의 worktree가 동시 처리되어야 함

### Scenario: 무효한 값

- **GIVEN** 사용자가 `--max-parallel 0` 또는 `--max-parallel -1`을 입력하고
- **WHEN** `/autofix --max-parallel 0`을 실행하면
- **THEN** "--max-parallel은 1 이상이어야 합니다" 에러를 출력해야 함

### Scenario: 시스템 부하 고려

- **GIVEN** 사용자가 `--max-parallel 10`으로 많은 수를 지정하고
- **WHEN** 실행하면
- **THEN** 경고 메시지 "높은 병렬 처리는 시스템 부하를 증가시킬 수 있습니다"를 출력해야 함
- **AND** 계속 진행할지 확인해야 함

---

## Requirement: REQ-CMD-006 - 실행 흐름 (정상 케이스)

워크플로우는 다음 순서로 실행되어야 한다(SHALL).

### Scenario: 표준 실행 흐름

- **GIVEN** `/autofix` 명령이 시작되고
- **WHEN** 정상 실행될 때
- **THEN** 다음 순서로 실행되어야 함:

```
1. list_issues → 이슈 조회
   ├─ 라벨 필터: auto-fix 포함, auto-fix-skip 제외
   └─ 상태 필터: open만

2. group_issues → 유사 이슈 그룹핑
   ├─ 기본 전략: component 기반
   └─ 결과: IssueGroup[]

3. 사용자 확인 (--all이 아닌 경우)
   ├─ 처리 대상 이슈/그룹 표시
   └─ 승인 대기

4. 각 그룹에 대해 병렬 처리 (max-parallel 제한):
   a. manage_worktree(create) → Worktree 생성
   b. update_issue → "🔄 처리 시작" 코멘트
   c. Claude 분석 & 수정
   d. run_checks → 로컬 테스트 실행
   e. 테스트 성공 시:
      - create_pr → PR 생성
      - update_issue → "✅ PR #xxx 생성" 코멘트
   f. 테스트 실패 시:
      - 재시도 (최대 3회)
      - 최종 실패 시 update_issue → "❌ 자동 수정 실패" 코멘트
   g. manage_worktree(cleanup) → Worktree 정리

5. 결과 요약 출력
   ├─ 성공한 이슈 (PR 번호 포함)
   ├─ 실패한 이슈 (실패 원인 포함)
   └─ 총 처리 시간
```

---

## Requirement: REQ-CMD-007 - 재시도 로직

테스트 실패 시 최대 3회까지 재시도해야 한다(SHALL).

### Scenario: 첫 시도 실패, 재시도 성공

- **GIVEN** 코드 수정 후 테스트가 실패하고
- **WHEN** 재시도가 실행되면
- **THEN** 에러 로그를 분석하여 수정을 보완해야 함
- **AND** 테스트를 다시 실행해야 함
- **AND** 성공하면 PR을 생성해야 함

### Scenario: 3회 모두 실패

- **GIVEN** 3번의 재시도 모두 테스트가 실패하고
- **WHEN** 최종 실패 처리가 실행되면
- **THEN** 이슈에 다음을 포함한 코멘트를 추가해야 함:
  - "❌ 자동 수정 실패"
  - 실패 원인 (마지막 에러 로그)
  - 시도 횟수 (3회)
- **AND** `auto-fix-failed` 라벨을 추가해야 함
- **AND** `auto-fix-processing` 라벨을 제거해야 함

### Scenario: 재시도 중 진행 상황 업데이트

- **GIVEN** 재시도가 진행 중이고
- **WHEN** 각 재시도가 시작될 때
- **THEN** 이슈에 "🔄 재시도 중 (2/3)" 형식의 코멘트를 추가해야 함

---

## Requirement: REQ-CMD-008 - 사용자 인터랙션 포인트

다음 시점에 사용자 확인을 요청해야 한다(SHALL).

### Scenario: 처리 시작 전 확인

- **GIVEN** 이슈 조회 및 그룹핑이 완료되고
- **WHEN** `--all` 옵션이 없으면
- **THEN** 다음 정보와 함께 확인을 요청해야 함:
  ```
  📋 처리 대상 이슈 (5개):

  그룹 1: canvas-core (3개)
    - #123: TypeError in handleSave
    - #124: Null reference in renderPage
    - #125: Missing validation in exportPDF

  그룹 2: ui (1개)
    - #130: Button disabled state not working

  그룹 3: editor (1개)
    - #132: Keyboard shortcut conflict

  처리할 이슈를 선택하세요:
  1. 모든 이슈 처리 (5개, 3개 worktree)
  2. 특정 그룹만 선택
  3. 특정 이슈만 선택
  4. 취소
  ```

### Scenario: 그룹 선택

- **GIVEN** 사용자가 "2. 특정 그룹만 선택"을 선택하고
- **WHEN** 그룹 번호를 입력하면
- **THEN** 선택된 그룹만 처리 대상으로 설정해야 함

### Scenario: 경고 확인

- **GIVEN** 위험한 작업이 감지되고 (예: main 브랜치에 직접 수정)
- **WHEN** 계속 진행하기 전
- **THEN** 경고 메시지와 함께 명시적 확인을 요청해야 함

---

## Requirement: REQ-CMD-009 - 결과 출력 형식

워크플로우 완료 후 구조화된 결과를 출력해야 한다(SHALL).

### Scenario: 모든 이슈 성공

- **GIVEN** 5개 이슈가 모두 성공적으로 처리되고
- **WHEN** 워크플로우가 완료되면
- **THEN** 다음 형식으로 출력해야 함:
  ```
  ✅ 자동 수정 완료

  📊 처리 결과:
  - 성공: 5개 이슈
  - 실패: 0개 이슈
  - 생성된 PR: 3개

  📤 생성된 Pull Requests:
  - PR #201: fix: canvas-core issues (#123, #124, #125)
    → https://github.com/owner/repo/pull/201
  - PR #202: fix: Button disabled state not working (#130)
    → https://github.com/owner/repo/pull/202
  - PR #203: fix: Keyboard shortcut conflict (#132)
    → https://github.com/owner/repo/pull/203

  ⏱️ 총 처리 시간: 8분 32초
  ```

### Scenario: 일부 이슈 실패

- **GIVEN** 일부 이슈가 실패하고
- **WHEN** 워크플로우가 완료되면
- **THEN** 성공/실패를 구분하여 출력해야 함:
  ```
  ⚠️ 자동 수정 완료 (일부 실패)

  📊 처리 결과:
  - 성공: 4개 이슈
  - 실패: 1개 이슈
  - 생성된 PR: 2개

  ✅ 성공한 이슈:
  - #123, #124, #125: PR #201 생성
  - #130: PR #202 생성

  ❌ 실패한 이슈:
  - #132: Keyboard shortcut conflict
    원인: 테스트 실패 (3회 재시도 모두 실패)
    에러: TypeError: Cannot read property 'key' of undefined
    액션: 이슈에 실패 코멘트 추가, auto-fix-failed 라벨 추가됨

  ⏱️ 총 처리 시간: 9분 15초

  💡 실패한 이슈는 수동 확인이 필요합니다.
  ```

### Scenario: 모든 이슈 실패

- **GIVEN** 모든 이슈가 실패하고
- **WHEN** 워크플로우가 완료되면
- **THEN** 실패 원인 분석과 다음 액션을 제안해야 함:
  ```
  ❌ 자동 수정 실패

  📊 처리 결과:
  - 성공: 0개 이슈
  - 실패: 3개 이슈
  - 생성된 PR: 0개

  ❌ 실패한 이슈:
  - #123: TypeError in handleSave
    원인: 테스트 실패
  - #124: Null reference in renderPage
    원인: Worktree 생성 실패 (디스크 공간 부족)
  - #125: Missing validation in exportPDF
    원인: 테스트 실패

  💡 다음 사항을 확인해주세요:
  - 디스크 공간이 충분한지
  - 테스트 환경이 올바른지
  - 이슈 정보가 충분한지
  ```

---

## Requirement: REQ-CMD-010 - 병렬 처리 전략

여러 이슈를 효율적으로 병렬 처리해야 한다(SHALL).

### Scenario: 병렬 처리 큐 관리

- **GIVEN** 10개 그룹이 있고 `--max-parallel 3`이 설정되고
- **WHEN** 병렬 처리가 시작되면
- **THEN** 처음 3개 그룹이 동시에 처리되어야 함
- **AND** 하나가 완료되면 즉시 4번째 그룹을 시작해야 함
- **AND** 모든 그룹이 처리될 때까지 반복해야 함

### Scenario: 독립적 그룹 우선

- **GIVEN** 여러 그룹이 대기 중이고
- **WHEN** 다음 처리할 그룹을 선택할 때
- **THEN** 파일 충돌이 없는 그룹을 우선 선택해야 함
- **AND** 같은 파일을 수정하는 그룹은 순차 처리해야 함

### Scenario: 실시간 진행 상황 표시

- **GIVEN** 병렬 처리가 진행 중이고
- **WHEN** 각 단계가 완료될 때
- **THEN** 다음 형식으로 실시간 출력해야 함:
  ```
  [1/3] fix/issue-123-124-125 (canvas-core)
  ├── 📁 Worktree 생성 완료
  ├── 🔍 이슈 분석 중...
  ├── ✏️ 코드 수정 중...

  [2/3] fix/issue-130 (ui)
  ├── 📁 Worktree 생성 완료
  ├── 🔍 이슈 분석 중...

  [3/3] fix/issue-132 (editor)
  ├── 📁 Worktree 생성 중...
  ```

---

## Requirement: REQ-CMD-011 - 중단 및 정리

사용자가 워크플로우를 중단할 수 있어야 한다(SHALL).

### Scenario: 사용자 중단 (Ctrl+C)

- **GIVEN** 워크플로우가 진행 중이고
- **WHEN** 사용자가 Ctrl+C를 누르면
- **THEN** 즉시 새로운 작업을 중단해야 함
- **AND** 진행 중인 작업은 완료될 때까지 대기해야 함
- **AND** 생성된 worktree를 모두 정리해야 함
- **AND** 처리 중인 이슈에 "⚠️ 사용자가 작업을 중단했습니다" 코멘트를 추가해야 함

### Scenario: 에러 발생 시 자동 정리

- **GIVEN** 치명적 에러가 발생하고
- **WHEN** 워크플로우가 중단되면
- **THEN** 모든 생성된 worktree를 정리해야 함
- **AND** `auto-fix-processing` 라벨을 제거해야 함
- **AND** 에러 로그를 출력해야 함

---

## Command Interface

### Syntax

```bash
/autofix [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--issues` | `string` | - | 처리할 이슈 번호 (쉼표 구분, 예: `123,124,125`) |
| `--all` | `boolean` | `false` | 사용자 확인 없이 모든 이슈 자동 처리 |
| `--dry-run` | `boolean` | `false` | 실제 수정 없이 계획만 출력 |
| `--max-parallel` | `number` | `3` | 최대 동시 처리 worktree 수 (1-10) |

### Constraints

- `--all`과 `--dry-run`은 MUST NOT be used together
- `--max-parallel`은 MUST be between 1 and 10
- `--issues`에 지정된 이슈는 MUST exist in the repository
- `--issues` 값은 MUST be comma-separated numbers without spaces

### Examples

```bash
# 기본 사용 (모든 auto-fix 이슈, 확인 후 처리)
/autofix

# 특정 이슈만 처리
/autofix --issues 123
/autofix --issues 123,124,125

# 모든 이슈 자동 처리
/autofix --all

# 계획만 확인 (dry-run)
/autofix --dry-run
/autofix --issues 123,124 --dry-run

# 병렬 처리 수 제한
/autofix --max-parallel 5

# 조합 사용
/autofix --issues 123,124,125 --max-parallel 2
```

---

## Error Handling

### Scenario: GitHub API 에러

- **GIVEN** GitHub API 호출이 실패하고
- **WHEN** 이슈 조회 또는 PR 생성 중 에러 발생
- **THEN** 재시도를 3회까지 수행해야 함
- **AND** 모두 실패하면 명확한 에러 메시지와 함께 종료해야 함
- **AND** 에러 메시지는 GitHub API 상태 코드를 포함해야 함

### Scenario: Worktree 생성 실패

- **GIVEN** 디스크 공간이 부족하거나 권한이 없고
- **WHEN** worktree 생성을 시도하면
- **THEN** 해당 이슈를 건너뛰어야 함
- **AND** 이슈에 실패 코멘트를 추가해야 함
- **AND** 다른 이슈 처리는 계속되어야 함

### Scenario: 테스트 환경 문제

- **GIVEN** `pnpm`이 설치되지 않았거나 `package.json`이 없고
- **WHEN** 테스트를 실행하려 하면
- **THEN** "테스트 환경을 확인할 수 없습니다" 에러를 출력해야 함
- **AND** 테스트 건너뛰기 옵션을 제안해야 함

### Scenario: 권한 부족

- **GIVEN** GitHub PAT에 PR 생성 권한이 없고
- **WHEN** PR 생성을 시도하면
- **THEN** "권한이 부족합니다. GitHub PAT 권한을 확인해주세요" 에러를 출력해야 함
- **AND** 필요한 권한 목록을 표시해야 함

---

## Performance Considerations

### Scenario: 대량 이슈 처리 최적화

- **GIVEN** 50개 이상의 이슈가 있고
- **WHEN** `/autofix --all`을 실행하면
- **THEN** 배치 단위로 나눠서 처리해야 함
- **AND** 각 배치 완료 후 중간 결과를 출력해야 함

### Scenario: 메모리 관리

- **GIVEN** 여러 worktree가 동시에 생성되고
- **WHEN** 메모리 사용량이 임계값에 도달하면
- **THEN** 병렬 처리 수를 자동으로 줄여야 함
- **AND** 사용자에게 경고 메시지를 출력해야 함

### Scenario: API 요청 쓰로틀링

- **GIVEN** GitHub API rate limit에 근접하고
- **WHEN** API 호출이 필요할 때
- **THEN** 요청 간격을 조정해야 함
- **AND** rate limit 상태를 사용자에게 표시해야 함

---

## Security Considerations

### Scenario: 민감 정보 보호

- **GIVEN** 이슈에 환경 변수나 토큰이 포함되고
- **WHEN** PR 본문을 생성할 때
- **THEN** 민감 정보를 자동으로 마스킹해야 함
- **AND** "민감 정보가 감지되어 마스킹되었습니다" 경고를 출력해야 함

### Scenario: 코드 실행 제한

- **GIVEN** 자동 수정 과정에서 코드 실행이 필요하고
- **WHEN** 테스트를 실행하기 전
- **THEN** 실행될 명령을 사용자에게 표시해야 함
- **AND** 의심스러운 명령은 차단해야 함

---

## Integration Points

### Related MCP Tools

```typescript
// 실행 순서대로
1. list_issues(labels: ["auto-fix"], exclude_labels: ["auto-fix-skip"])
2. group_issues(issues: number[], group_by: "component")
3. manage_worktree(action: "create", issues: number[])
4. update_issue(issue_number: number, comment: string, labels?: string[])
5. run_checks(worktree_path: string, checks: string[])
6. create_pr(branch: string, target: "autofixing", issues: number[])
7. manage_worktree(action: "cleanup", issues: number[])
```

### Configuration Dependencies

```yaml
# autofix.config.yml에서 읽어야 하는 설정
worktree:
  max_parallel: 3          # 기본값, --max-parallel로 오버라이드 가능
  base_path: "../worktrees"

github:
  fix_branch: "autofixing" # PR 타겟 브랜치
  labels:
    auto_fix: "auto-fix"
    skip: "auto-fix-skip"
    processing: "auto-fix-processing"
    failed: "auto-fix-failed"

checks:
  - "pnpm test"
  - "pnpm type-check"
  - "pnpm lint"
```

---

## Implementation Notes

### 상태 관리

워크플로우 진행 중 다음 상태를 추적해야 함:

```typescript
interface AutofixState {
  status: "idle" | "listing" | "grouping" | "confirming" | "processing" | "completed" | "failed";
  total_issues: number;
  processed_issues: number;
  failed_issues: number;
  active_worktrees: Map<number[], string>; // issues -> worktree_path
  results: {
    success: { issue: number; pr: number }[];
    failed: { issue: number; error: string }[];
  };
}
```

### 로깅

다음 이벤트를 로깅해야 함:
- 워크플로우 시작/종료 시간
- 각 이슈 처리 시작/종료 시간
- API 호출 (tool, params, duration)
- 에러 발생 (stack trace 포함)
- 사용자 인터랙션 (선택, 중단 등)

### 복구 메커니즘

비정상 종료 시 다음을 수행해야 함:
- 생성된 worktree 목록을 파일에 저장
- 재시작 시 자동으로 정리 제안
- `auto-fix-processing` 라벨이 붙은 이슈를 자동 복구

---

## Future Enhancements

- `--skip-tests` 옵션: 테스트 건너뛰기 (위험)
- `--target-branch` 옵션: PR 타겟 브랜치 커스터마이징
- `--priority` 옵션: 우선순위 높은 이슈 먼저 처리
- `--continue` 옵션: 이전 중단된 워크플로우 재개
- `--report` 옵션: 상세 리포트 파일 생성 (JSON/Markdown)
- 웹 대시보드 연동: 실시간 진행 상황 시각화

---

## Testing Scenarios

### 통합 테스트 케이스

1. **정상 플로우**: 5개 이슈, 3개 그룹, 모두 성공
2. **일부 실패**: 5개 이슈, 2개 성공, 3개 실패 (각기 다른 원인)
3. **모두 실패**: API 에러로 모든 이슈 실패
4. **대량 처리**: 50개 이슈 병렬 처리
5. **사용자 중단**: 처리 중 Ctrl+C로 중단
6. **재시도 성공**: 첫 시도 실패, 재시도 성공
7. **dry-run 모드**: 실제 수정 없이 계획만 출력
8. **특정 이슈 지정**: --issues 옵션 사용

### 성능 벤치마크

- 1개 이슈 처리: < 2분
- 10개 이슈 처리 (병렬 3): < 10분
- 50개 이슈 처리: < 30분
