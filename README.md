# auto-fix-workflow

English | [한국어](./README.ko.md)

MCP (Model Context Protocol) server for automated GitHub issue management and code fixing workflows.

## Features

- **GitHub Integration**: Manage issues, pull requests, and labels
- **Asana Integration**: Sync tasks and analyze for auto-fix suitability
- **Git Worktree Management**: Isolated development environments for parallel fixes
- **Code Quality Checks**: Run typecheck, lint, and tests with configurable order
- **Workflow Orchestration**: Group issues, plan fix strategies, create PRs

## Installation

```bash
npm install auto-fix-workflow
```

## Quick Start

### As MCP Server

Add to your Claude Desktop or MCP client configuration:

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

### Configuration

Create `.auto-fix.yaml` in your project root:

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

## Available Tools

### GitHub Tools

| Tool | Description |
|------|-------------|
| `github_get_issue` | Fetch issue details by number |
| `github_list_issues` | List and filter repository issues |
| `github_create_issue` | Create new issues with labels |
| `github_update_issue` | Update issue state and content |
| `github_create_pr` | Create pull requests |

### Asana Tools

| Tool | Description |
|------|-------------|
| `asana_get_task` | Fetch task details |
| `asana_list_tasks` | List project tasks |
| `asana_update_task` | Update task status |
| `asana_analyze_task` | Analyze task for auto-fix suitability |

### Git Tools

| Tool | Description |
|------|-------------|
| `git_create_worktree` | Create isolated worktree |
| `git_remove_worktree` | Remove worktree with cleanup |
| `git_list_worktrees` | List active worktrees |

### Check Tools

| Tool | Description |
|------|-------------|
| `run_checks` | Execute typecheck, lint, test |

### Workflow Tools

| Tool | Description |
|------|-------------|
| `group_issues` | Group related issues by component |
| `triage` | Prioritize and categorize issues |
| `autofix` | Execute full auto-fix workflow |

## Commands

### Triage Command

Analyze and prioritize issues for processing:

```bash
npx auto-fix-workflow triage --label auto-fix --limit 10
```

Options:
- `--label`: Filter by label
- `--state`: Filter by state (open/closed)
- `--limit`: Maximum issues to process
- `--dry-run`: Preview without making changes

### Autofix Command

Execute automated fix workflow:

```bash
npx auto-fix-workflow autofix --issues 1,2,3
```

Options:
- `--issues`: Comma-separated issue numbers
- `--group-by`: Grouping strategy (component/file/none)
- `--fail-fast`: Stop on first failure
- `--dry-run`: Preview operations

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub personal access token | Yes |
| `ASANA_TOKEN` | Asana personal access token | For Asana features |
| `AUTO_FIX_CONFIG` | Custom config file path | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | No |

## API Token Scopes

### GitHub Token

Create a [Personal Access Token](https://github.com/settings/tokens) with the following scopes:

| Scope | Required | Description |
|-------|----------|-------------|
| `repo` | Yes | Full control of private repositories |
| `public_repo` | Yes (for public repos) | Access public repositories |
| `read:org` | Optional | Read org membership (for org repos) |

For fine-grained tokens (recommended):
- **Repository access**: Select specific repositories
- **Permissions**:
  - Issues: Read and write
  - Pull requests: Read and write
  - Contents: Read and write
  - Metadata: Read-only

### Asana Token

Create a [Personal Access Token](https://app.asana.com/0/developer-console) in Asana Developer Console:

| Permission | Description |
|------------|-------------|
| Read tasks | View task details and list tasks |
| Write tasks | Update task status, add comments |
| Read projects | Access project information |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## Architecture

```
src/
├── common/           # Shared types, utilities, logging
├── github/           # GitHub API integration
├── asana/            # Asana API integration
├── git/              # Git worktree management
├── checks/           # Code quality checks
├── analyzer/         # Task analysis and code location
├── workflow/         # Issue grouping and fix strategies
├── commands/         # CLI commands (triage, autofix)
└── index.ts          # MCP server entry point
```

## License

MIT
