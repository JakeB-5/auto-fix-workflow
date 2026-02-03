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

### 선택: 로컬 설치

로컬 설치를 원하는 경우:

```bash
npm install auto-fix-workflow
```

실행 결과:
- `.mcp.json` 생성 (MCP 서버 설정)
- `.auto-fix.yaml` 생성 (워크플로우 설정 + 토큰)
- `.gitignore`에 `.auto-fix.yaml` 추가 (보안)
- `.github/ISSUE_TEMPLATE/auto-fix-issue.yml` 생성 (표준화된 이슈 양식)
- `.github/PULL_REQUEST_TEMPLATE.md` 생성 (PR 표준화)
- `autofixing` 브랜치 생성 및 origin에 푸시

옵션:
- `--non-interactive`: GITHUB_TOKEN, ASANA_TOKEN 환경변수에서 토큰 읽기
- `--force`: 기존 설정 파일 덮어쓰기
- `--skip-validation`: 토큰 검증 건너뛰기

자세한 설정 방법은 [초기 설정 가이드](./docs/SETUP.ko.md)를 참조하세요.

## 빠른 시작

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
| `github_get_issue` | 번호로 이슈 상세 조회 |
| `github_list_issues` | 저장소 이슈 목록 조회 및 필터링 |
| `github_create_issue` | 라벨과 함께 새 이슈 생성 |
| `github_update_issue` | 이슈 상태 및 내용 업데이트 |
| `github_create_pr` | Pull Request 생성 |

### Asana 도구

| 도구 | 설명 |
|------|------|
| `asana_get_task` | 태스크 상세 조회 |
| `asana_list_tasks` | 프로젝트 태스크 목록 조회 |
| `asana_update_task` | 태스크 상태 업데이트 |
| `asana_analyze_task` | 자동 수정 적합성 분석 |

### Git 도구

| 도구 | 설명 |
|------|------|
| `git_create_worktree` | 격리된 worktree 생성 |
| `git_remove_worktree` | worktree 제거 및 정리 |
| `git_list_worktrees` | 활성 worktree 목록 조회 |

### 검사 도구

| 도구 | 설명 |
|------|------|
| `run_checks` | typecheck, lint, test 실행 |

### 워크플로우 도구

| 도구 | 설명 |
|------|------|
| `group_issues` | 컴포넌트별 관련 이슈 그룹화 |
| `triage` | 이슈 우선순위 지정 및 분류 |
| `autofix` | 전체 자동 수정 워크플로우 실행 |

## 명령어

### Init 명령어

프로젝트 설정 초기화:

```bash
npx auto-fix-workflow init
```

옵션:
- `--non-interactive`: 환경변수에서 토큰 읽기
- `--force`: 기존 파일 덮어쓰기
- `--skip-validation`: 토큰 검증 건너뛰기

### Triage 명령어

처리할 이슈 분석 및 우선순위 지정:

```bash
npx auto-fix-workflow triage --label auto-fix --limit 10
```

옵션:
- `--label`: 라벨로 필터링
- `--state`: 상태로 필터링 (open/closed)
- `--limit`: 처리할 최대 이슈 수
- `--dry-run`: 변경 없이 미리보기

### Autofix 명령어

자동 수정 워크플로우 실행:

```bash
npx auto-fix-workflow autofix --issues 1,2,3
```

옵션:
- `--issues`: 쉼표로 구분된 이슈 번호
- `--group-by`: 그룹화 전략 (component/file/none)
- `--fail-fast`: 첫 실패 시 중단
- `--dry-run`: 작업 미리보기

## 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `GITHUB_TOKEN` | GitHub 개인 액세스 토큰 | 예 |
| `ASANA_TOKEN` | Asana 개인 액세스 토큰 | Asana 기능 사용 시 |
| `AUTO_FIX_CONFIG` | 커스텀 설정 파일 경로 | 아니오 |
| `LOG_LEVEL` | 로깅 레벨 (debug/info/warn/error) | 아니오 |

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
