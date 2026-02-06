# auto-fix-workflow

[![npm version](https://img.shields.io/npm/v/auto-fix-workflow)](https://www.npmjs.com/package/auto-fix-workflow)
[![CI](https://github.com/JakeB-5/auto-fix-workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/JakeB-5/auto-fix-workflow/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

GitHub 이슈 관리 및 코드 수정 워크플로우 자동화를 위한 MCP (Model Context Protocol) 서버입니다.

[English](./README.md) | 한국어

## 기능

- **GitHub 연동**: 이슈, PR, 라벨 관리
- **Asana 연동**: 태스크 동기화 및 자동 수정 적합성 분석
- **Git Worktree 관리**: 병렬 수정 작업을 위한 격리된 개발 환경
- **코드 품질 검사**: typecheck, lint, test를 설정 가능한 순서로 실행
- **워크플로우 오케스트레이션**: 이슈 그룹화, 수정 전략 계획, PR 생성
- **AI 기반 분석**: Claude CLI 연동을 통한 자동 코드 분석 및 수정 생성, 이슈별/세션별 예산 추적, 지능형 모델 전환 (opus → sonnet → haiku), 지수 백오프 재시도 로직, JSON 스키마 검증, 도구 기반 보안 (분석 시 읽기 전용, 수정 시 편집 전용)

## 빠른 시작

init 명령어로 프로젝트를 설정합니다 (설치 불필요):

```bash
npx auto-fix-workflow init
```

실행 결과:
- `.mcp.json` 생성 (MCP 서버 설정)
- `.auto-fix.yaml` 생성 (워크플로우 설정 + 토큰)
- `.gitignore`에 `.auto-fix.yaml` 추가 (보안)
- `.github/ISSUE_TEMPLATE/auto-fix-issue.yml` 생성 (표준화된 이슈 양식)
- `.github/PULL_REQUEST_TEMPLATE.md` 생성 (PR 표준화)
- `autofixing` 브랜치 생성 및 origin에 푸시

옵션:
- `-n, --non-interactive`: `GITHUB_TOKEN`, `ASANA_TOKEN` 환경변수에서 토큰 읽기
- `-f, --force`: 기존 설정 파일 덮어쓰기
- `-s, --skip-validation`: 토큰 검증 건너뛰기

자세한 설정 방법은 [초기 설정 가이드](./docs/SETUP.ko.md)를 참조하세요.

### MCP 서버로 사용

`npx auto-fix-workflow init` 실행 후 다음 파일들이 생성됩니다:

**.mcp.json** (MCP 서버 설정 - 커밋 가능):
```json
{
  "mcpServers": {
    "auto-fix-workflow": {
      "command": "npx",
      "args": ["auto-fix-workflow"],
      "env": {}
    }
  }
}
```

**.auto-fix.yaml** (워크플로우 설정 + 토큰 - gitignore됨):
```yaml
# 인증 토큰 (이 파일은 .gitignore에 추가됨)
tokens:
  github: "your-github-token"
  asana: "your-asana-token"

github:
  owner: your-org
  repo: your-repo
  baseBranch: main

asana:
  projectId: "1234567890"
  workspaceId: "0987654321"

checks:
  order:
    - typecheck
    - lint
    - test
  timeout: 300000
  failFast: true

worktree:
  baseDir: .worktrees
  cleanupOnSuccess: true

ai:
  budgetPerIssue: 1.0           # 이슈당 최대 비용 (USD)
  budgetPerSession: 100.0       # 세션당 최대 비용 (USD)
  preferredModel: opus          # 선호 모델 (opus|sonnet|haiku)
  fallbackModel: sonnet         # 예산 부족 시 대체 모델
  minConfidence: 0.5            # 수정 진행 최소 신뢰도
```

## 사용 가능한 도구

### GitHub 도구

| 도구 | 설명 |
|------|------|
| `get_github_issue` | 번호로 이슈 상세 조회 |
| `list_issues` | 저장소 이슈 목록 조회 및 필터링 |
| `github_create_issue` | 라벨과 함께 새 이슈 생성 |
| `update_github_issue` | 이슈 상태 및 내용 업데이트 |
| `github_create_pr` | Pull Request 생성 |
| `add_issue_progress_comment` | 이슈에 진행 상황 코멘트 추가 |

### Asana 도구

| 도구 | 설명 |
|------|------|
| `asana_get_task` | 태스크 상세 조회 |
| `asana_list_tasks` | 프로젝트 태스크 목록 조회 |
| `asana_update_task` | 태스크 상태 업데이트 |
| `asana_analyze_task` | 자동 수정 적합성 분석 |

### Git 도구 (내부용)

다음 도구는 autofix 파이프라인 내부에서 사용되며 MCP를 통해 직접 노출되지 않습니다:

| 도구 | 설명 |
|------|------|
| `git_worktree` | 통합 Worktree 관리 (action 파라미터로 create/remove/list 구분) |

### 워크플로우 도구 (내부용)

다음 도구는 autofix 파이프라인 내부에서 사용됩니다:

| 도구 | 설명 |
|------|------|
| `group_issues` | 컴포넌트/파일/라벨별 관련 이슈 그룹화 |
| `run_checks` | Worktree에서 typecheck, lint, test 실행 |

> **참고:** `triage`와 `autofix`는 MCP 도구가 아닌 CLI 커맨드입니다. 사용법은 [명령어](#명령어) 섹션을 참조하세요.

## 명령어

### Init 명령어

프로젝트 설정 초기화:

```bash
npx auto-fix-workflow init
```

옵션:
- `-n, --non-interactive`: `GITHUB_TOKEN`, `ASANA_TOKEN` 환경변수에서 토큰 읽기
- `-f, --force`: 기존 설정 파일 덮어쓰기
- `-s, --skip-validation`: 토큰 검증 건너뛰기

### Triage 명령어

Asana 태스크 분석 및 GitHub 이슈 생성:

```bash
# 인터랙티브 모드 (UI에서 태스크 선택)
npx auto-fix-workflow triage

# 배치 모드 (모든 태스크 자동 처리)
npx auto-fix-workflow triage --mode batch

# 단일 태스크 직접 지정
npx auto-fix-workflow triage 1234567890

# 프로젝트 필터 + 드라이런
npx auto-fix-workflow triage --dry-run --project 1234567890
```

옵션:
| 플래그 | 단축 | 타입 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `--mode <mode>` | `-m` | enum | `interactive` | 모드: `interactive`, `batch`, `single` |
| `--dry-run` | `-d` | boolean | `false` | 변경 없이 미리보기 |
| `--project <gid>` | `-p` | string | - | Asana 프로젝트 GID |
| `--section <gid>` | `-s` | string | - | Asana 섹션 GID |
| `--priority <level>` | `-P` | enum | - | 필터: `critical`, `high`, `medium`, `low` |
| `--limit <n>` | `-l` | number | - | 처리할 최대 태스크 수 |
| `--yes` | `-y` | boolean | `false` | 확인 프롬프트 건너뛰기 |
| `--verbose` | `-v` | boolean | `false` | 상세 출력 활성화 |

위치 인자: 단일 태스크 처리를 위한 태스크 GID (숫자).

### Autofix 명령어

자동 수정 워크플로우 실행:

```bash
# 모든 auto-fix 라벨 이슈 처리
npx auto-fix-workflow autofix --all

# 특정 이슈만 처리
npx auto-fix-workflow autofix --issues 123,456

# 드라이런 (미리보기)
npx auto-fix-workflow autofix --all --dry-run

# 그룹핑 전략 및 병렬 처리 수 조절
npx auto-fix-workflow autofix --all --group-by file --max-parallel 5
```

옵션:
| 플래그 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| `--all` | boolean | `false` | 모든 auto-fix 라벨 이슈 처리 |
| `--issues <nums>` | string | - | 쉼표로 구분된 이슈 번호 |
| `--group-by <strategy>` | enum | `component` | 그룹핑: `component`, `file`, `label`, `type`, `priority` |
| `--max-parallel <n>` | number | `3` | 최대 병렬 워크트리 수 (1-10) |
| `--dry-run` | boolean | `false` | 변경 없이 미리보기 |
| `--max-retries <n>` | number | `3` | 그룹당 최대 재시도 횟수 (1-10) |
| `--labels <labels>` | string | - | 라벨로 이슈 필터링 (쉼표 구분) |
| `--exclude-labels <labels>` | string | - | 해당 라벨 이슈 제외 |
| `--base-branch <name>` | string | `autofixing` | PR 타겟 브랜치 |
| `--verbose` | boolean | `false` | 상세 출력 활성화 |
| `--config <path>` | string | - | 설정 파일 경로 |

> **참고:** `--all`과 `--issues`는 동시 사용 불가합니다.

## 환경 변수

### 필수

| 변수 | 설명 |
|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token |

### 선택 - GitHub

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `GITHUB_OWNER` | - | 저장소 소유자 (`.auto-fix.yaml`에서도 설정 가능) |
| `GITHUB_REPO` | - | 저장소 이름 |
| `GITHUB_API_URL` | - | 커스텀 GitHub API URL (Enterprise용) |
| `GITHUB_DEFAULT_BRANCH` | `main` | 기본 브랜치명 |
| `AUTOFIX_LABEL` | `auto-fix` | 자동 수정 대상 라벨 |
| `AUTOFIX_SKIP_LABEL` | `auto-fix-skip` | 제외할 이슈 라벨 |

### 선택 - Asana

| 변수 | 설명 |
|------|------|
| `ASANA_TOKEN` | Asana Personal Access Token (triage 필수) |
| `ASANA_DEFAULT_PROJECT_GID` | 기본 Asana 프로젝트 GID |
| `ASANA_TRIAGE_SECTION` | 트리아지 스캔 대상 섹션명 |
| `ASANA_PROCESSED_SECTION` | 처리 완료 섹션명 |
| `ASANA_SYNCED_TAG` | 동기화 완료 태그명 |
| `TRIAGE_MAX_BATCH_SIZE` | 트리아지 최대 배치 크기 |

### 선택 - Worktree

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WORKTREE_BASE_DIR` | `.worktrees` | Worktree 기본 디렉토리 |
| `WORKTREE_MAX_CONCURRENT` | `3` | 최대 동시 Worktree 수 |
| `WORKTREE_PREFIX` | `autofix-` | 브랜치명 접두사 |

### 선택 - 검사 커맨드

| 변수 | 설명 |
|------|------|
| `TEST_COMMAND` | 커스텀 테스트 커맨드 (package.json에서 자동 감지) |
| `TYPECHECK_COMMAND` | 커스텀 타입체크 커맨드 |
| `LINT_COMMAND` | 커스텀 린트 커맨드 |

### 선택 - 로깅

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `AUTO_FIX_CONFIG` | `.auto-fix.yaml` | 커스텀 설정 파일 경로 |
| `LOG_LEVEL` | `info` | 로그 레벨: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_PRETTY` | `true` (개발) | 로그 포맷팅 활성화 |
| `LOG_REDACT` | `true` | 민감 데이터 마스킹 |
| `NO_COLOR` | - | 색상 출력 비활성화 |

## API 토큰 권한

### GitHub 토큰

다음 권한으로 [Personal Access Token](https://github.com/settings/tokens) 생성:

| 권한 | 필수 | 설명 |
|------|------|------|
| `repo` | 예 | 비공개 저장소 전체 제어 |
| `public_repo` | 예 (공개 저장소) | 공개 저장소 접근 |
| `read:org` | 선택 | 조직 멤버십 읽기 (조직 저장소용) |

Fine-grained 토큰 권장 설정:
- **저장소 접근**: 특정 저장소 선택
- **권한**:
  - Issues: 읽기 및 쓰기
  - Pull requests: 읽기 및 쓰기
  - Contents: 읽기 및 쓰기
  - Metadata: 읽기 전용

### Asana 토큰

Asana 개발자 콘솔에서 [Personal Access Token](https://app.asana.com/0/developer-console) 생성:

| 권한 | 설명 |
|------|------|
| 태스크 읽기 | 태스크 상세 조회 및 목록 조회 |
| 태스크 쓰기 | 태스크 상태 업데이트, 댓글 추가 |
| 프로젝트 읽기 | 프로젝트 정보 접근 |

## 워크플로우 예시

### 예시 1: Asana 태스크 분류 (Triage)

Asana 태스크를 분석하여 GitHub Issue로 변환:

```
User: /triage

Claude: 🔍 "To Triage" 섹션의 Asana 태스크를 스캔 중...

📋 분석할 태스크 3개 발견:

태스크 #12345: "저장 버튼 에러"
├── ✅ 재현 단계: 명확함
├── ✅ 에러 메시지: TypeError - id 속성 접근 오류
├── ✅ 관련 파일: src/components/Editor.tsx (handleSave 함수)
├── ✅ 원인 추정: document 객체 초기화 전 접근
└── 🎫 GitHub Issue #45 생성됨

태스크 #12346: "앱이 느려요"
├── ❌ 재현 단계: 불명확
├── ❌ 구체적 증상: 불명확
└── 📝 Asana에 "needs-more-info" 태그 추가됨

태스크 #12347: "PDF 내보내기 실패"
├── ✅ 재현 단계: 명확함
├── ✅ 에러 메시지: 있음
└── 🎫 GitHub Issue #46 생성됨

📊 결과:
- ✅ 변환 완료: 2개 태스크
- ⏳ 추가 정보 필요: 1개 태스크
```

### 예시 2: 이슈 자동 수정

`auto-fix` 라벨이 있는 GitHub 이슈 자동 수정:

```
User: /autofix

Claude: 🔍 auto-fix 라벨 이슈 조회 중...

📋 대기 중인 이슈 (5개):

그룹 1: canvas-core (3개 이슈)
  - #123: handleSave의 TypeError
  - #124: renderPage의 Null 참조
  - #125: exportPDF의 유효성 검사 누락

그룹 2: ui (1개 이슈)
  - #130: 버튼 비활성화 상태 오작동

그룹 3: editor (1개 이슈)
  - #132: 키보드 단축키 충돌

처리할 이슈를 선택하세요:
1. 전체 이슈 (5개, 3개 워크트리)
2. 특정 그룹 선택
3. 특정 이슈 선택

User: 1

Claude:
🚀 자동 수정 시작...

[워크트리 1/3] fix/issue-123-124-125 (canvas-core)
├── 📁 워크트리 생성 완료
├── 🔍 이슈 분석 중...
├── ✏️ 수정 적용 중...
├── 🧪 검사 실행 중...
│   ├── ✅ typecheck (통과)
│   ├── ✅ lint (통과)
│   └── ✅ test (통과)
├── 📤 PR #201 생성 완료
└── 🧹 워크트리 정리 완료

[워크트리 2/3] fix/issue-130 (ui)
├── 📁 워크트리 생성 완료
├── 🔍 이슈 분석 중...
├── ✏️ 수정 적용 중...
├── 🧪 검사 실행 중...
│   ├── ✅ typecheck (통과)
│   ├── ✅ lint (통과)
│   └── ✅ test (통과)
├── 📤 PR #202 생성 완료
└── 🧹 워크트리 정리 완료

[워크트리 3/3] fix/issue-132 (editor)
├── 📁 워크트리 생성 완료
├── 🔍 이슈 분석 중...
├── ✏️ 수정 적용 중...
├── 🧪 검사 실행 중...
│   ├── ✅ typecheck (통과)
│   ├── ❌ test (실패 - 기존 바인딩과 단축키 충돌)
│   └── 🔄 재시도 1/3...
├── ✏️ 수정 조정 중...
├── 🧪 검사 실행 중...
│   ├── ✅ typecheck (통과)
│   ├── ✅ lint (통과)
│   └── ✅ test (통과)
├── 📤 PR #203 생성 완료
└── 🧹 워크트리 정리 완료

📊 결과:
- ✅ 성공: 5개 이슈 (PR #201, #202, #203)
- ❌ 실패: 0개 이슈

모든 PR은 수동 검토를 위해 'autofixing' 브랜치를 대상으로 합니다.
```

### 예시 3: 특정 이슈만 수정

특정 이슈만 선택하여 수정:

```
User: /autofix --issues 123,124

Claude:
🚀 이슈 #123, #124 처리 중...

[워크트리] fix/issue-123-124
├── 📁 워크트리 생성 완료
├── 🔍 2개 이슈 분석 중...
├── ✏️ 수정 적용 중...
├── 🧪 검사 실행 중... ✅ 전체 통과
├── 📤 PR #204 생성 완료 (Closes #123, #124)
└── 🧹 워크트리 정리 완료

📊 결과:
- ✅ 성공: 2개 이슈
- PR: https://github.com/your-org/your-repo/pull/204
```

### 예시 4: 미리보기 모드 (Dry Run)

변경 없이 어떤 일이 일어날지 미리보기:

```
User: /autofix --dry-run

Claude:
🔍 [미리보기] auto-fix 이슈 분석 중...

📋 처리 예정 이슈 3개:

그룹: canvas-core
├── #123: handleSave의 TypeError
│   └── 수정: document 객체 null 체크 추가
├── #124: renderPage의 Null 참조
│   └── 수정: 렌더링 전 페이지 상태 초기화
└── #125: exportPDF의 유효성 검사 누락
    └── 수정: PDF 옵션 입력 유효성 검사 추가

계획된 작업:
1. 워크트리 생성: fix/issue-123-124-125
2. 3개 수정 적용
3. 검사 실행: typecheck, lint, test
4. 'autofixing' 브랜치 대상 PR 생성
5. 워크트리 정리

변경 사항 없음 (미리보기 모드).
```

## 개발

```bash
# 의존성 설치
npm install

# 빌드
npm run build

# 테스트 실행
npm test

# 타입 검사
npm run type-check

# 린트
npm run lint
```

### 스펙 주도 개발 (SDD)

이 프로젝트는 스펙 관리를 위해 [sdd-tool](https://github.com/JakeB-5/sdd-tool)을 사용하여 개발되었습니다.

```bash
# 전체 스펙 검증
npx sdd-tool validate

# 스펙 목록 조회
npx sdd-tool list
```

스펙 파일은 `.sdd/specs/` 디렉토리에 있습니다.

## Autofix 파이프라인

autofix 명령어는 9단계 파이프라인으로 이슈를 처리합니다:

```
단계 1: Worktree 생성     → 격리된 Git Worktree 생성
단계 2: AI 분석            → Claude CLI로 이슈 분석
단계 3: AI 수정            → Claude CLI로 코드 수정 생성
단계 4: 의존성 설치         → npm install 실행
단계 5: 품질 검사           → typecheck → lint → test 실행
단계 6: 커밋 및 푸시        → 변경사항 커밋 후 브랜치 푸시
단계 7: PR 생성            → autofixing 브랜치로 Pull Request 생성
단계 8: 이슈 업데이트       → 이슈에 PR 링크 코멘트 추가
단계 9: 정리               → Worktree 제거
```

이슈는 전략(component, file, label 등)에 따라 그룹화되고, Git Worktree를 사용하여 병렬 처리됩니다. 검사 실패 시 AI가 수정을 조정하여 자동 재시도합니다.

### 브랜치 전략

```
main ◀─────────────── (수동 머지)
  └── autofixing ◀─── (PR 타겟)
        ├── fix/issue-123
        ├── fix/issue-124-125 (그룹)
        └── fix/issue-126
```

## 아키텍처

```
src/
├── common/           # 공유 타입, 유틸리티, 로깅
├── github/           # GitHub API 연동
├── asana/            # Asana API 연동
├── git/              # Git worktree 관리
├── checks/           # 코드 품질 검사
├── analyzer/         # 태스크 분석 및 코드 위치 파악
├── workflow/         # 이슈 그룹화 및 수정 전략
├── commands/         # CLI 명령어 (triage, autofix)
└── index.ts          # MCP 서버 진입점
```

## 문서

- **[초기 설정 가이드](./docs/SETUP.ko.md)** - GitHub, Asana, Sentry 연동을 위한 초기 설정

## 라이선스

MIT
