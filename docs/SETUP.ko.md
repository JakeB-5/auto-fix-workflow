# 초기 설정 가이드

[English](./SETUP.md) | 한국어

> 이 가이드는 auto-fix-workflow 사용 전 필요한 초기 설정을 다룹니다. 이 설정들은 자동화할 수 없으며 반드시 수동으로 설정해야 합니다.

## Init 명령어로 빠른 설정

auto-fix-workflow를 설정하는 가장 쉬운 방법은 init 명령어를 사용하는 것입니다:

```bash
npx auto-fix-workflow init
```

이 대화형 명령어는 다음 작업을 수행합니다:
1. GitHub 토큰 입력 요청
2. Asana 토큰 입력 요청
3. 토큰 유효성 검증
4. `.mcp.json` 및 `.auto-fix.yaml` 생성
5. `.gitignore`에 `.auto-fix.yaml` 추가

init 실행 후 수동으로 설정해야 할 사항:
- `.auto-fix.yaml`에서 GitHub owner와 repo 설정
- `.auto-fix.yaml`에서 Asana workspaceId와 projectId 설정
- GitHub 라벨 생성 (아래 참조)
- autofixing 브랜치 생성

비대화형 설정 (CI/CD용):
```bash
GITHUB_TOKEN=xxx ASANA_TOKEN=yyy npx auto-fix-workflow init --non-interactive
```

## 목차

- [Init 명령어로 빠른 설정](#init-명령어로-빠른-설정)
- [GitHub 설정](#github-설정)
- [Asana 설정](#asana-설정)
- [Sentry 설정](#sentry-설정)
- [설정 파일](#설정-파일)
- [설정 체크리스트](#설정-체크리스트)

---

## GitHub 설정

### 1. Personal Access Token (PAT) 발급

**위치:** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens

**필요 권한:**
- Repository access: 대상 레포지토리 선택
- Permissions:
  - Issues: Read and write
  - Pull requests: Read and write
  - Contents: Read and write (PR용 커밋)
  - Metadata: Read-only

**환경변수 설정:**
```bash
# .env 또는 환경변수
GITHUB_TOKEN=github_pat_xxxxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

### 2. 레포지토리 라벨 생성

GitHub 레포지토리에서 다음 라벨을 생성하세요:

| 라벨명 | 색상 (권장) | 설명 |
|--------|------------|------|
| `auto-fix` | `#0E8A16` (녹색) | 자동 수정 대상 |
| `auto-fix-skip` | `#E4E669` (노란색) | 자동 수정 제외 |
| `auto-fix-failed` | `#D93F0B` (빨간색) | 자동 수정 실패 |
| `auto-fix-processing` | `#1D76DB` (파란색) | 처리 중 |
| `sentry` | `#FBCA04` (주황색) | Sentry에서 생성 |
| `asana` | `#D4C5F9` (보라색) | Asana에서 생성 |
| `component:*` | `#C5DEF5` | 컴포넌트별 (프로젝트에 맞게) |

### 3. Issue 템플릿 설정

`.github/ISSUE_TEMPLATE/auto-fix-issue.yml` 파일 생성:

```yaml
name: Auto-Fix Issue
description: 자동 수정 대상 이슈
labels: ["auto-fix"]
body:
  - type: dropdown
    id: type
    attributes:
      label: Type
      options:
        - "🔴 Sentry Error"
        - "🐛 Bug Report"
        - "✨ Feature Request"
    validations:
      required: true

  - type: input
    id: source
    attributes:
      label: Source
      description: "이슈의 출처 (Sentry/Asana/Direct)"
      placeholder: "예: Sentry Issue #123"

  - type: textarea
    id: context
    attributes:
      label: Context
      description: "코드 위치 정보"
      value: |
        - **파일**:
        - **함수/클래스**:
        - **라인**:
        - **컴포넌트**:

  - type: textarea
    id: problem
    attributes:
      label: Problem Description
      description: "문제 상세 설명"
    validations:
      required: true

  - type: textarea
    id: code-analysis
    attributes:
      label: Code Analysis
      description: "현재 문제가 되는 코드 (알고 있는 경우)"
      render: typescript

  - type: textarea
    id: suggested-fix
    attributes:
      label: Suggested Fix Direction
      description: "수정 방향 힌트 (선택사항)"

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: "완료 조건"
      value: |
        - [ ] 에러가 더 이상 발생하지 않음
        - [ ] 기존 테스트 모두 통과
```

### 4. autofixing 브랜치 생성

```bash
# 최초 1회 실행
git checkout main
git checkout -b autofixing
git push -u origin autofixing
```

### 5. Branch Protection Rules (선택)

**위치:** GitHub → Repository → Settings → Branches → Add rule

**autofixing 브랜치:**
- Require pull request reviews before merging: OFF (자동 PR이므로)
- Require status checks to pass: ON (CI 필수)
- Allow force pushes: OFF

**main 브랜치:**
- Require pull request reviews before merging: ON
- Require status checks to pass: ON

---

## Asana 설정

### 1. Personal Access Token 발급

**위치:** Asana → My Settings → Apps → Developer apps → Create new token

또는: https://app.asana.com/0/developer-console

**환경변수 설정:**
```bash
ASANA_TOKEN=1/xxxxx:yyyyyyy
```

### 2. 워크스페이스 및 프로젝트 ID 확인

프로젝트 URL에서 확인: `https://app.asana.com/0/{workspace_id}/{project_id}`

**환경변수 설정:**
```bash
ASANA_WORKSPACE_ID=1234567890
ASANA_PROJECT_ID=0987654321
```

### 3. 프로젝트 구조 설정 (권장)

Asana 프로젝트에서 다음 섹션들을 생성:

```
Bug Reports (프로젝트)
├── 📥 Inbox              # 새로 등록된 버그
├── 🔍 To Triage          # /triage 대상 (에이전트가 읽는 섹션)
├── ⏳ Needs More Info    # 정보 보충 필요
├── ✅ Triaged            # GitHub Issue 생성 완료
└── 🚫 Won't Fix          # 수정 안함
```

### 4. 커스텀 필드 설정 (선택)

프로젝트에 커스텀 필드 추가:

| 필드명 | 타입 | 옵션 |
|--------|------|------|
| Priority | Dropdown | High, Medium, Low |
| Component | Dropdown | canvas-core, editor, ui, ... |
| Browser | Text | 브라우저 정보 |
| OS | Text | 운영체제 정보 |

### 5. 태그 생성

Asana 워크스페이스에서 다음 태그 생성:

| 태그명 | 색상 (권장) | 용도 |
|--------|------------|------|
| `triaged` | 녹색 | 분석 완료, GitHub Issue 생성됨 |
| `needs-more-info` | 노란색 | 추가 정보 필요 |
| `cannot-reproduce` | 빨간색 | 재현 불가 |
| `unclear-requirement` | 주황색 | 요구사항 불명확 |
| `needs-context` | 파란색 | 코드 위치/컨텍스트 필요 |
| `auto-fix-skip` | 회색 | 자동 처리 제외 |

---

## Sentry 설정

### 1. Internal Integration 생성

**위치:** Sentry → Settings → Developer Settings → Internal Integrations → Create New

**필요 권한:**
- Project: Read
- Issue & Event: Read & Write
- Organization: Read

**환경변수 설정:**
```bash
SENTRY_AUTH_TOKEN=sntrys_xxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### 2. GitHub Integration 연동

**위치:** Sentry → Settings → Integrations → GitHub → Install

**설정:**
- Repository: 대상 레포지토리 연결
- Stack Trace Linking: Enable (코드 위치 자동 매핑)

### 3. Alert Rules 설정 (자동 Issue 생성)

**위치:** Sentry → Alerts → Create Alert Rule

**조건 설정:**
- WHEN: An event is seen
- IF:
  - event.count >= 5 (5회 이상 발생)
  - level IN [error, fatal]
  - environment = production
- THEN: Create GitHub Issue
  - Repository: 대상 레포지토리
  - Labels: auto-fix, sentry

**Alert Rule 예시 (YAML 표현):**
```yaml
name: "Auto-fix Issue Creator"
environment: production
conditions:
  - type: event_frequency
    interval: 1h
    value: 5
filters:
  - type: level
    match: gte
    level: error
actions:
  - type: github_create_issue
    integration_id: xxxxx
    repository: "owner/repo"
    labels: ["auto-fix", "sentry"]
    title: "[Sentry] {{ title }}"
```

### 4. Issue 템플릿 설정 (Sentry → GitHub)

**위치:** Sentry → Settings → Integrations → GitHub → Configure → Issue Templates

```markdown
## 🤖 Auto-Fix Issue

### Type
- [x] 🔴 Sentry Error

### Source
- **Origin**: Sentry
- **Reference**: {{ link }}
- **Event Count**: {{ count }}
- **First Seen**: {{ firstSeen }}
- **Last Seen**: {{ lastSeen }}

### Context
- **파일**: {{ filename }}
- **함수**: {{ function }}
- **라인**: {{ lineNo }}

### Problem Description
```
{{ title }}
{{ message }}
```

### Stack Trace
```
{{ stacktrace }}
```

### Environment
- **Browser**: {{ browser }}
- **OS**: {{ os }}
- **User Count**: {{ userCount }}
```

---

## 설정 파일

프로젝트 루트에 `.auto-fix.yaml` 생성:

```yaml
github:
  owner: "your-org"
  repo: "your-repo"
  baseBranch: "main"
  fixBranch: "autofixing"
  labels:
    autoFix: "auto-fix"
    skip: "auto-fix-skip"
    failed: "auto-fix-failed"
    processing: "auto-fix-processing"

asana:
  workspaceId: "1234567890"
  projectId: "0987654321"
  sections:
    triage: "To Triage"
    needsInfo: "Needs More Info"
    triaged: "Triaged"
  tags:
    triaged: "triaged"
    needsInfo: "needs-more-info"
    cannotReproduce: "cannot-reproduce"
    unclear: "unclear-requirement"
    needsContext: "needs-context"
    skip: "auto-fix-skip"

sentry:
  org: "your-org"
  project: "your-project"
  minEventCount: 5
  severity: ["error", "fatal"]

worktree:
  basePath: ".worktrees"
  maxParallel: 3

checks:
  order:
    - typecheck
    - lint
    - test
  timeout: 300000
  failFast: true
```

---

## 설정 체크리스트

| 서비스 | 항목 | 상태 |
|--------|------|------|
| **GitHub** | PAT 발급 | ☐ |
| | 라벨 생성 (7개 이상) | ☐ |
| | Issue 템플릿 추가 | ☐ |
| | autofixing 브랜치 생성 | ☐ |
| | Branch Protection 설정 | ☐ |
| **Asana** | PAT 발급 | ☐ |
| | 프로젝트 ID 확인 | ☐ |
| | 섹션 구조 설정 | ☐ |
| | 태그 생성 (6개) | ☐ |
| **Sentry** | Internal Integration 생성 | ☐ |
| | GitHub Integration 연동 | ☐ |
| | Alert Rule 설정 | ☐ |
| | Issue 템플릿 설정 | ☐ |
| **MCP** | 설정 파일 생성 | ☐ |
| | 환경변수 설정 | ☐ |

---

## 관련 문서

- [MCP 서버 개발 가이드](https://modelcontextprotocol.io)
- [GitHub API 문서](https://docs.github.com/en/rest)
- [GitHub Fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Asana API 문서](https://developers.asana.com/docs)
- [Sentry Integration](https://docs.sentry.io/product/integrations/source-code-mgmt/github/)
- [Sentry Alerts](https://docs.sentry.io/product/alerts/)
