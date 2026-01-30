# auto-fix-workflow

GitHub 이슈 관리 및 코드 수정 워크플로우 자동화를 위한 MCP (Model Context Protocol) 서버입니다.

[English](./README.md) | 한국어

## 기능

- **GitHub 연동**: 이슈, PR, 라벨 관리
- **Asana 연동**: 태스크 동기화 및 자동 수정 적합성 분석
- **Git Worktree 관리**: 병렬 수정 작업을 위한 격리된 개발 환경
- **코드 품질 검사**: typecheck, lint, test를 설정 가능한 순서로 실행
- **워크플로우 오케스트레이션**: 이슈 그룹화, 수정 전략 계획, PR 생성

## 설치

```bash
npm install auto-fix-workflow
```

## 빠른 시작

### MCP 서버로 사용

Claude Desktop 또는 MCP 클라이언트 설정에 추가:

```json
{
  "mcpServers": {
    "auto-fix-workflow": {
      "command": "npx",
      "args": ["auto-fix-workflow"],
      "env": {
        "GITHUB_TOKEN": "your-github-token",
        "ASANA_TOKEN": "your-asana-token"
      }
    }
  }
}
```

### 설정

프로젝트 루트에 `.auto-fix.yaml` 생성:

```yaml
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

## 라이선스

MIT
