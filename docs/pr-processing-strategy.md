# Auto-Fix PR 처리 전략

> triage → autofix로 생성된 PR을 어떻게 처리할 것인가

## 현재 상태

### 구현 완료된 플로우

```
Asana Task → /triage → GitHub Issue → /autofix → PR 생성 (→ autofixing 브랜치)
```

### 빠져있는 단계

```
PR 생성 → ??? → autofixing 병합 → ??? → main 프로모션
```

### 브랜치 전략 (기존)

```
main ◀─────────────── (수동 머지)
  └── autofixing ◀─── (PR 타겟)
        ├── fix/issue-123
        ├── fix/issue-124-125 (그룹)
        └── fix/issue-126
```

---

## 제안: 3단계 PR 처리 파이프라인

### 전체 구조

```
fix/issue-123 ──┐
fix/issue-124 ──┼─→ autofixing (자동 병합) ──→ main (수동 프로모션)
fix/issue-125 ──┘
     ↑                    ↑                        ↑
  Stage 1              Stage 2                  Stage 3
  Auto-Review       Auto-Merge              Promotion PR
  + Approve        to autofixing            autofixing→main
```

---

## Stage 1: Auto-Review & Approve

PR 생성 직후 자동으로 실행한다.

### 리스크 분류

| 등급 | 기준 | 처리 |
|------|------|------|
| **Trivial** | 파일 1개, +10줄 이하 | 자동 승인 + 자동 병합 |
| **Standard** | 파일 3개 이하, 비핵심 로직 | 자동 승인 + 24시간 대기 후 병합 |
| **Complex** | 파일 4개+, 인증/DB/API 변경 | 인간 리뷰 요청 |

### 구현 방법

GitHub Actions + `gh pr merge --auto --squash`

```yaml
# .github/workflows/auto-merge-fix.yml
name: Auto-merge Fix PRs

on:
  pull_request:
    types: [opened, labeled]
    branches: [autofixing]

jobs:
  auto-review:
    if: contains(github.event.pull_request.labels.*.name, 'auto-fix')
    runs-on: ubuntu-latest
    steps:
      - name: Classify risk level
        id: classify
        run: |
          FILES=$(gh pr view ${{ github.event.pull_request.number }} --json files -q '.files | length')
          ADDITIONS=$(gh pr view ${{ github.event.pull_request.number }} --json additions -q '.additions')
          if [ "$FILES" -le 1 ] && [ "$ADDITIONS" -le 10 ]; then
            echo "level=trivial" >> $GITHUB_OUTPUT
          elif [ "$FILES" -le 3 ]; then
            echo "level=standard" >> $GITHUB_OUTPUT
          else
            echo "level=complex" >> $GITHUB_OUTPUT
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Auto-approve (trivial/standard)
        if: steps.classify.outputs.level != 'complex'
        uses: hmarr/auto-approve-action@v3
        with:
          github-token: ${{ secrets.PAT_TOKEN }}

      - name: Enable auto-merge (trivial)
        if: steps.classify.outputs.level == 'trivial'
        run: |
          gh pr merge --auto --squash ${{ github.event.pull_request.number }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Request human review (complex)
        if: steps.classify.outputs.level == 'complex'
        run: |
          gh pr edit ${{ github.event.pull_request.number }} --add-label "needs-human-review"
          gh pr comment ${{ github.event.pull_request.number }} \
            --body "This PR has been classified as **complex** and requires human review."
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 전제 조건

- autofixing 브랜치에 **branch protection rule** 설정 필요
  - `Require status checks to pass before merging` 활성화
  - `Allow auto-merge` 활성화
- auto-approve를 위한 별도 PAT(Personal Access Token) 필요
  - `GITHUB_TOKEN`으로는 자가 승인 불가

---

## Stage 2: autofixing 브랜치 축적

fix PR들이 autofixing에 squash merge로 축적된다.

### 동작 방식

1. 각 fix PR이 autofixing에 병합될 때마다 CI 재실행
2. 실패 시 마지막 merge를 revert하고 관련 이슈에 알림
3. `Closes #N` 키워드로 GitHub이 이슈 자동 종료

### 충돌 처리

```yaml
# 충돌 감지 시 자동 리베이스 또는 알림
- name: Handle merge conflicts
  run: |
    MERGEABLE=$(gh pr view $PR_NUMBER --json mergeable -q '.mergeable')
    if [ "$MERGEABLE" = "CONFLICTING" ]; then
      gh pr comment $PR_NUMBER \
        --body "Merge conflict detected. Auto-rebase required."
      gh pr edit $PR_NUMBER --add-label "needs-rebase"
    fi
```

### 동시 PR 충돌 방지

이미 구현된 `group_issues` 로직 활용:
- 같은 파일을 수정하는 이슈는 하나의 PR로 그룹화
- 서로 다른 파일을 수정하는 이슈는 병렬 처리

---

## Stage 3: main 프로모션

### 옵션 A: 수동 프로모션 (현재 규모에 추천)

```bash
# 프로모션 시점에 수동 실행
gh pr create --base main --head autofixing \
  --title "Promote: autofixing → main $(date +%Y-%m-%d)" \
  --body "$(git log main..autofixing --oneline)"
```

- 안정성 중시
- 현재 소규모 프로젝트에 적합
- 리뷰어가 축적된 변경사항을 한 번에 확인

### 옵션 B: 주기적 자동 프로모션 (규모 커지면)

```yaml
# .github/workflows/promote.yml
name: Promote autofixing to main

on:
  schedule:
    - cron: '0 2 * * 1'  # 매주 월요일 새벽 2시
  workflow_dispatch:       # 수동 트리거 가능

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - name: Check for new commits
        id: check
        run: |
          AHEAD=$(gh api repos/$REPO/compare/main...autofixing --jq '.ahead_by')
          echo "ahead=$AHEAD" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Create promotion PR
        if: steps.check.outputs.ahead > 0
        run: |
          gh pr create \
            --base main \
            --head autofixing \
            --title "Weekly promotion: autofixing → main" \
            --label "promotion,auto-generated" \
            --body "$(cat <<'EOF'
          ## Promotion Summary

          **Changes**: $(git log main..autofixing --oneline | wc -l) commits

          ### Included Fixes
          $(git log main..autofixing --oneline)

          ### Verification
          - [ ] All CI checks passed
          - [ ] No production alerts
          EOF
          )"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 옵션 C: 임계값 기반 자동 프로모션

```yaml
# N개 이상의 fix가 쌓이면 자동 프로모션 PR 생성
on:
  push:
    branches: [autofixing]

jobs:
  check-threshold:
    runs-on: ubuntu-latest
    steps:
      - name: Count accumulated fixes
        run: |
          COUNT=$(gh api repos/$REPO/compare/main...autofixing --jq '.ahead_by')
          if [ "$COUNT" -ge 10 ]; then
            gh pr create --base main --head autofixing \
              --title "Auto-promotion: $COUNT fixes accumulated"
          fi
```

---

## Branch Protection 설정

### autofixing 브랜치

```
Required:
  [x] Require pull request reviews before merging (1 approval)
  [x] Require status checks to pass before merging
  [x] Allow auto-merge
  [x] Automatically delete head branches
```

### main 브랜치

```
Required:
  [x] Require pull request reviews before merging (1-2 approvals)
  [x] Require status checks to pass before merging
  [ ] Allow force pushes: Disabled
  [ ] Allow deletions: Disabled
```

---

## 구현 로드맵

### Phase 1: 즉시 (수동 운영)

1. afw-test 레포에 branch protection rule 설정
2. 현재 PR #16을 수동으로 autofixing에 병합
3. autofixing → main 프로모션 PR 수동 생성/병합

### Phase 2: 반자동화 (GitHub Actions)

4. `.github/workflows/auto-merge-fix.yml` 추가 — fix PR 자동 병합
5. `.github/workflows/promote.yml` 추가 — 프로모션 PR 생성 (수동 트리거)
6. auto-fix-workflow 파이프라인에 `merge` 스테이지 추가

### Phase 3: 완전 자동화

7. 리스크 분류 로직 고도화 (AI 기반)
8. Merge Queue 또는 Mergify 도입 (규모 커지면)
9. 프로모션 완전 자동화 (cron + 안정성 검증)

---

## 핵심 결정 사항

| 항목 | 옵션 | 추천 |
|------|------|------|
| 프로모션 방식 | 수동 / 주간 자동 / 임계값 | **수동** (현재 규모) |
| PR 병합 전략 | squash / merge commit | **squash** (깔끔한 히스토리) |
| 자동 병합 범위 | 전체 / CI 통과만 / 리스크 기반 | **CI 통과 + 리스크 분류** |

---

## 참고 자료

- [GitHub Auto-merge Docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
- [GitHub Merge Queue Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- [Mergify Merge Queue](https://docs.mergify.com/merge-queue/)
- [hmarr/auto-approve-action](https://github.com/hmarr/auto-approve-action)
