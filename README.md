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

## Workflow Examples

### Example 1: Triage Asana Tasks

Analyze Asana tasks and convert them to GitHub Issues:

```
User: /triage

Claude: 🔍 Scanning Asana tasks in "To Triage" section...

📋 Found 3 tasks to analyze:

Task #12345: "Save button error"
├── ✅ Reproduction steps: Clear
├── ✅ Error message: TypeError - id property access error
├── ✅ Related file: src/components/Editor.tsx (handleSave function)
├── ✅ Root cause: document object accessed before initialization
└── 🎫 GitHub Issue #45 created

Task #12346: "App is slow"
├── ❌ Reproduction steps: Unclear
├── ❌ Specific symptoms: Unclear
└── 📝 Added "needs-more-info" tag to Asana

Task #12347: "Export PDF fails"
├── ✅ Reproduction steps: Clear
├── ✅ Error message: Found
└── 🎫 GitHub Issue #46 created

📊 Results:
- ✅ Converted: 2 tasks
- ⏳ Needs more info: 1 task
```

### Example 2: Auto-Fix Issues

Automatically fix GitHub issues with the `auto-fix` label:

```
User: /autofix

Claude: 🔍 Fetching issues with auto-fix label...

📋 Pending Issues (5):

Group 1: canvas-core (3 issues)
  - #123: TypeError in handleSave
  - #124: Null reference in renderPage
  - #125: Missing validation in exportPDF

Group 2: ui (1 issue)
  - #130: Button disabled state not working

Group 3: editor (1 issue)
  - #132: Keyboard shortcut conflict

Select issues to process:
1. All issues (5 issues, 3 worktrees)
2. Select specific groups
3. Select specific issues

User: 1

Claude:
🚀 Starting auto-fix...

[Worktree 1/3] fix/issue-123-124-125 (canvas-core)
├── 📁 Worktree created
├── 🔍 Analyzing issues...
├── ✏️ Applying fixes...
├── 🧪 Running checks...
│   ├── ✅ typecheck (passed)
│   ├── ✅ lint (passed)
│   └── ✅ test (passed)
├── 📤 PR #201 created
└── 🧹 Worktree cleaned up

[Worktree 2/3] fix/issue-130 (ui)
├── 📁 Worktree created
├── 🔍 Analyzing issue...
├── ✏️ Applying fix...
├── 🧪 Running checks...
│   ├── ✅ typecheck (passed)
│   ├── ✅ lint (passed)
│   └── ✅ test (passed)
├── 📤 PR #202 created
└── 🧹 Worktree cleaned up

[Worktree 3/3] fix/issue-132 (editor)
├── 📁 Worktree created
├── 🔍 Analyzing issue...
├── ✏️ Applying fix...
├── 🧪 Running checks...
│   ├── ✅ typecheck (passed)
│   ├── ❌ test (failed - shortcut conflict with existing binding)
│   └── 🔄 Retry 1/3...
├── ✏️ Adjusting fix...
├── 🧪 Running checks...
│   ├── ✅ typecheck (passed)
│   ├── ✅ lint (passed)
│   └── ✅ test (passed)
├── 📤 PR #203 created
└── 🧹 Worktree cleaned up

📊 Results:
- ✅ Success: 5 issues (PR #201, #202, #203)
- ❌ Failed: 0 issues

All PRs target the 'autofixing' branch for manual review.
```

### Example 3: Fix Specific Issues

Fix only specific issues:

```
User: /autofix --issues 123,124

Claude:
🚀 Processing issues #123, #124...

[Worktree] fix/issue-123-124
├── 📁 Worktree created
├── 🔍 Analyzing 2 issues...
├── ✏️ Applying fixes...
├── 🧪 Running checks... ✅ All passed
├── 📤 PR #204 created (Closes #123, #124)
└── 🧹 Worktree cleaned up

📊 Results:
- ✅ Success: 2 issues
- PR: https://github.com/your-org/your-repo/pull/204
```

### Example 4: Dry Run Mode

Preview what would happen without making changes:

```
User: /autofix --dry-run

Claude:
🔍 [DRY RUN] Analyzing auto-fix issues...

📋 Would process 3 issues:

Group: canvas-core
├── #123: TypeError in handleSave
│   └── Fix: Add null check for document object
├── #124: Null reference in renderPage
│   └── Fix: Initialize page state before render
└── #125: Missing validation in exportPDF
    └── Fix: Add input validation for PDF options

Planned actions:
1. Create worktree: fix/issue-123-124-125
2. Apply 3 fixes
3. Run checks: typecheck, lint, test
4. Create PR targeting 'autofixing' branch
5. Clean up worktree

No changes made (dry run mode).
```

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
