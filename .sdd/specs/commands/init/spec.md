---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: commands
feature: init
depends: "common/config-loader"
---

# /init Command Specification

> 프로젝트 초기 설정을 자동화하는 CLI 명령어. MCP 설정과 config 파일을 생성한다.

---

## Requirement: REQ-001 - MCP 설정 파일 생성

시스템은 사용자로부터 토큰을 입력받아 MCP 설정 파일을 생성해야 한다(SHALL).

### Scenario: GitHub 토큰 입력

- **GIVEN** 사용자가 `/init` 명령을 실행함
- **WHEN** GitHub 토큰 입력 프롬프트가 표시될 때
- **THEN** 사용자가 입력한 토큰이 검증되어야 함
- **AND** 유효한 토큰이면 `.mcp.json`에 저장되어야 함

### Scenario: Asana 토큰 입력

- **GIVEN** GitHub 토큰 입력이 완료됨
- **WHEN** Asana 토큰 입력 프롬프트가 표시될 때
- **THEN** 사용자가 입력한 토큰이 검증되어야 함
- **AND** 유효한 토큰이면 `.mcp.json`에 저장되어야 함

### Scenario: 토큰 입력 건너뛰기

- **GIVEN** 토큰 입력 프롬프트가 표시됨
- **WHEN** 사용자가 빈 값을 입력할 때
- **THEN** 해당 토큰 설정이 건너뛰어져야 함
- **AND** 경고 메시지가 표시되어야 함

---

## Requirement: REQ-002 - .mcp.json 파일 생성

시스템은 MCP 서버 설정 파일을 생성해야 한다(SHALL).

### Scenario: .mcp.json 생성

- **GIVEN** 토큰 입력이 완료됨
- **WHEN** 설정 파일을 생성할 때
- **THEN** 다음 구조의 `.mcp.json` 파일이 생성되어야 함
  ```json
  {
    "mcpServers": {
      "auto-fix-workflow": {
        "command": "npx",
        "args": ["auto-fix-workflow"],
        "env": {
          "GITHUB_TOKEN": "<입력받은 토큰>",
          "ASANA_TOKEN": "<입력받은 토큰>"
        }
      }
    }
  }
  ```

### Scenario: 기존 .mcp.json이 있는 경우

- **GIVEN** 프로젝트에 `.mcp.json`이 이미 존재함
- **WHEN** init 명령이 실행될 때
- **THEN** 기존 설정을 유지하면서 auto-fix-workflow 설정만 추가/업데이트해야 함
- **AND** 다른 mcpServers 설정은 보존되어야 함

---

## Requirement: REQ-003 - .auto-fix.yaml 파일 생성

시스템은 워크플로우 설정 파일 템플릿을 생성해야 한다(SHALL).

### Scenario: 기본 설정 파일 생성

- **GIVEN** init 명령이 실행됨
- **WHEN** `.auto-fix.yaml` 파일을 생성할 때
- **THEN** 다음 구조의 설정 파일이 생성되어야 함
  ```yaml
  github:
    owner: "<TODO: GitHub 조직/사용자명>"
    repo: "<TODO: 저장소명>"
    baseBranch: "main"
    fixBranch: "autofixing"
    labels:
      autoFix: "auto-fix"
      skip: "auto-fix-skip"
      failed: "auto-fix-failed"
      processing: "auto-fix-processing"

  asana:
    workspaceId: "<TODO: Asana 워크스페이스 ID>"
    projectId: "<TODO: Asana 프로젝트 ID>"
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

  checks:
    order:
      - typecheck
      - lint
      - test
    timeout: 300000
    failFast: true

  worktree:
    basePath: ".worktrees"
    maxParallel: 3
  ```

### Scenario: 기존 .auto-fix.yaml이 있는 경우

- **GIVEN** 프로젝트에 `.auto-fix.yaml`이 이미 존재함
- **WHEN** init 명령이 실행될 때
- **THEN** 덮어쓸지 여부를 사용자에게 확인해야 함
- **AND** 사용자가 거부하면 기존 파일을 유지해야 함

---

## Requirement: REQ-004 - 수동 설정 항목 안내

시스템은 수동으로 설정해야 하는 항목에 대한 가이드를 출력해야 한다(SHALL).

### Scenario: 설정 완료 후 안내 출력

- **GIVEN** 설정 파일 생성이 완료됨
- **WHEN** 명령이 종료될 때
- **THEN** 다음 항목들에 대한 안내가 출력되어야 함

**출력 형식:**
```
✅ auto-fix-workflow 초기 설정 완료!

📁 생성된 파일:
  - .mcp.json (MCP 서버 설정)
  - .auto-fix.yaml (워크플로우 설정)

⚠️  수동 설정이 필요한 항목:

1. GitHub 설정 (.auto-fix.yaml)
   - owner: GitHub 조직명 또는 사용자명
   - repo: 저장소명

2. Asana 설정 (.auto-fix.yaml)
   - workspaceId: Asana 워크스페이스 ID
   - projectId: Asana 프로젝트 ID

   💡 ID 확인 방법:
   프로젝트 URL에서 확인: https://app.asana.com/0/{workspaceId}/{projectId}

3. GitHub 라벨 생성
   저장소에 다음 라벨을 생성하세요:
   - auto-fix (녹색, #0E8A16)
   - auto-fix-skip (노란색, #E4E669)
   - auto-fix-failed (빨간색, #D93F0B)
   - auto-fix-processing (파란색, #1D76DB)

4. autofixing 브랜치 생성
   git checkout -b autofixing && git push -u origin autofixing

📚 상세 가이드: docs/SETUP.md
```

---

## Requirement: REQ-005 - 토큰 검증

시스템은 입력받은 토큰의 유효성을 검증해야 한다(SHOULD).

### Scenario: GitHub 토큰 검증

- **GIVEN** 사용자가 GitHub 토큰을 입력함
- **WHEN** 토큰을 검증할 때
- **THEN** GitHub API를 호출하여 토큰 유효성을 확인해야 함
- **AND** 유효하지 않으면 재입력을 요청해야 함

### Scenario: Asana 토큰 검증

- **GIVEN** 사용자가 Asana 토큰을 입력함
- **WHEN** 토큰을 검증할 때
- **THEN** Asana API를 호출하여 토큰 유효성을 확인해야 함
- **AND** 유효하지 않으면 재입력을 요청해야 함

### Scenario: 오프라인 모드

- **GIVEN** 네트워크 연결이 없음
- **WHEN** 토큰 검증을 시도할 때
- **THEN** 경고 메시지와 함께 검증을 건너뛰어야 함
- **AND** 토큰 형식만 검증해야 함 (github_pat_*, 1/xxxxx 등)

---

## Requirement: REQ-006 - CLI 인터페이스

시스템은 대화형 CLI 인터페이스를 제공해야 한다(SHALL).

### Scenario: 명령어 실행

- **GIVEN** 사용자가 CLI를 사용함
- **WHEN** init 명령을 실행할 때
- **THEN** 다음 형식으로 실행할 수 있어야 함
  ```bash
  npx auto-fix-workflow init
  # 또는
  auto-fix-workflow init
  ```

### Scenario: 비대화형 모드

- **GIVEN** CI/CD 환경에서 실행됨
- **WHEN** `--non-interactive` 플래그가 사용될 때
- **THEN** 환경변수에서 토큰을 읽어야 함
  ```bash
  GITHUB_TOKEN=xxx ASANA_TOKEN=yyy npx auto-fix-workflow init --non-interactive
  ```

### Scenario: 도움말 출력

- **GIVEN** 사용자가 도움이 필요함
- **WHEN** `--help` 플래그가 사용될 때
- **THEN** 명령어 사용법과 옵션이 출력되어야 함

---

## Command Signature

```bash
auto-fix-workflow init [options]
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `--non-interactive` | boolean | NO | false | 환경변수에서 토큰 읽기 |
| `--force` | boolean | NO | false | 기존 파일 강제 덮어쓰기 |
| `--skip-validation` | boolean | NO | false | 토큰 검증 건너뛰기 |
| `--help` | boolean | NO | false | 도움말 출력 |

---

## 비고

- 토큰은 로컬 파일에만 저장되며 원격으로 전송되지 않음
- `.mcp.json`은 `.gitignore`에 추가하는 것을 권장
- Sentry 설정은 선택사항으로 향후 추가 가능
