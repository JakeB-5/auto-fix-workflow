# auto-fix-workflow

[![npm version](https://img.shields.io/npm/v/auto-fix-workflow)](https://www.npmjs.com/package/auto-fix-workflow)
[![CI](https://github.com/JakeB-5/auto-fix-workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/JakeB-5/auto-fix-workflow/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

English | [한국어](./README.ko.md)

MCP (Model Context Protocol) server for automated GitHub issue management and code fixing workflows.

## Features

- **GitHub Integration**: Manage issues, pull requests, and labels
- **Asana Integration**: Sync tasks and analyze for auto-fix suitability
- **Git Worktree Management**: Isolated development environments for parallel fixes
- **Code Quality Checks**: Run typecheck, lint, and tests with configurable order
- **Workflow Orchestration**: Group issues, plan fix strategies, create PRs
- **AI-Powered Analysis**: Claude CLI integration for automated code analysis and fix generation with budget tracking, intelligent model fallback (opus → sonnet → haiku), retry logic with exponential backoff, structured JSON schema validation, and tool-based security (read-only for analysis, edit-only for fixes)

## Quick Start

Run the init command to configure your project (no installation required):

```bash
npx auto-fix-workflow init
```

This will:
- Create `.mcp.json` with MCP server configuration
- Create `.auto-fix.yaml` with workflow settings and tokens
- Add `.auto-fix.yaml` to `.gitignore` for security
- Create `.github/ISSUE_TEMPLATE/auto-fix-issue.yml` for standardized issue creation
- Create `.github/PULL_REQUEST_TEMPLATE.md` for PR standardization
- Create `autofixing` branch and push to origin

Options:
- `-n, --non-interactive`: Read tokens from `GITHUB_TOKEN` and `ASANA_TOKEN` environment variables
- `-f, --force`: Overwrite existing configuration files
- `-s, --skip-validation`: Skip token validation steps

For detailed setup instructions, see [Setup Guide](./docs/SETUP.md).

### As MCP Server

After running `npx auto-fix-workflow init`, the following files are created:

**.mcp.json** (MCP server configuration - can be committed):
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

**.auto-fix.yaml** (workflow settings + tokens - gitignored):
```yaml
# Tokens (this file is added to .gitignore)
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
  budgetPerIssue: 1.0           # Maximum USD per issue
  budgetPerSession: 100.0       # Maximum USD per session
  preferredModel: opus          # Primary model (opus|sonnet|haiku)
  fallbackModel: sonnet         # Fallback when budget tight
  minConfidence: 0.5            # Minimum confidence to proceed
```

## Available Tools

### GitHub Tools

| Tool | Description |
|------|-------------|
| `get_github_issue` | Fetch issue details by number |
| `list_issues` | List and filter repository issues |
| `github_create_issue` | Create new issues with labels |
| `update_github_issue` | Update issue state and content |
| `github_create_pr` | Create pull requests |
| `add_issue_progress_comment` | Add progress comment to an issue |

### Asana Tools

| Tool | Description |
|------|-------------|
| `asana_get_task` | Fetch task details |
| `asana_list_tasks` | List project tasks |
| `asana_update_task` | Update task status |
| `asana_analyze_task` | Analyze task for auto-fix suitability |

### Git Tools (Internal)

These tools are used internally by the autofix pipeline and are not directly exposed via MCP:

| Tool | Description |
|------|-------------|
| `git_worktree` | Unified worktree management (create/remove/list via action parameter) |

### Workflow Tools (Internal)

These tools are used internally by the autofix pipeline:

| Tool | Description |
|------|-------------|
| `group_issues` | Group related issues by component/file/label |
| `run_checks` | Execute typecheck, lint, test in worktree |

> **Note:** `triage` and `autofix` are CLI commands, not MCP tools. See [Commands](#commands) for usage.

## Commands

### Init Command

Initialize project configuration:

```bash
npx auto-fix-workflow init
```

Options:
- `-n, --non-interactive`: Read tokens from `GITHUB_TOKEN` and `ASANA_TOKEN` environment variables
- `-f, --force`: Overwrite existing configuration files
- `-s, --skip-validation`: Skip token validation steps

### Triage Command

Analyze Asana tasks and create GitHub issues:

```bash
# Interactive mode (select tasks from UI)
npx auto-fix-workflow triage

# Batch mode (process all tasks automatically)
npx auto-fix-workflow triage --mode batch

# Single task by GID
npx auto-fix-workflow triage 1234567890

# Dry run with project filter
npx auto-fix-workflow triage --dry-run --project 1234567890
```

Options:
| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--mode <mode>` | `-m` | enum | `interactive` | Mode: `interactive`, `batch`, `single` |
| `--dry-run` | `-d` | boolean | `false` | Preview without making changes |
| `--project <gid>` | `-p` | string | - | Asana project GID |
| `--section <gid>` | `-s` | string | - | Asana section GID |
| `--priority <level>` | `-P` | enum | - | Filter: `critical`, `high`, `medium`, `low` |
| `--limit <n>` | `-l` | number | - | Maximum tasks to process |
| `--yes` | `-y` | boolean | `false` | Skip confirmation prompts |
| `--verbose` | `-v` | boolean | `false` | Enable verbose output |

Positional argument: Task GID (numeric) for single-task processing.

### Autofix Command

Execute automated fix workflow:

```bash
# Process all auto-fix labeled issues
npx auto-fix-workflow autofix --all

# Fix specific issues
npx auto-fix-workflow autofix --issues 123,456

# Dry run (preview only)
npx auto-fix-workflow autofix --all --dry-run

# Custom grouping and parallelism
npx auto-fix-workflow autofix --all --group-by file --max-parallel 5
```

Options:
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--all` | boolean | `false` | Process all auto-fix labeled issues |
| `--issues <nums>` | string | - | Comma-separated issue numbers |
| `--group-by <strategy>` | enum | `component` | Grouping: `component`, `file`, `label`, `type`, `priority` |
| `--max-parallel <n>` | number | `3` | Maximum parallel worktrees (1-10) |
| `--dry-run` | boolean | `false` | Preview without making changes |
| `--max-retries <n>` | number | `3` | Maximum retry attempts per group (1-10) |
| `--labels <labels>` | string | - | Filter issues by labels (comma-separated) |
| `--exclude-labels <labels>` | string | - | Exclude issues with these labels |
| `--base-branch <name>` | string | `autofixing` | Base branch for PRs |
| `--verbose` | boolean | `false` | Enable verbose output |
| `--config <path>` | string | - | Path to config file |

> **Note:** `--all` and `--issues` are mutually exclusive.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token |

### Optional - GitHub

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_OWNER` | - | Repository owner (can also set in `.auto-fix.yaml`) |
| `GITHUB_REPO` | - | Repository name |
| `GITHUB_API_URL` | - | Custom GitHub API URL (for Enterprise) |
| `GITHUB_DEFAULT_BRANCH` | `main` | Default branch name |
| `AUTOFIX_LABEL` | `auto-fix` | Label for auto-fix target issues |
| `AUTOFIX_SKIP_LABEL` | `auto-fix-skip` | Label to exclude issues |

### Optional - Asana

| Variable | Description |
|----------|-------------|
| `ASANA_TOKEN` | Asana Personal Access Token (required for triage) |
| `ASANA_DEFAULT_PROJECT_GID` | Default Asana project GID |
| `ASANA_TRIAGE_SECTION` | Section name to scan for triage |
| `ASANA_PROCESSED_SECTION` | Section name for processed tasks |
| `ASANA_SYNCED_TAG` | Tag name for synced tasks |
| `TRIAGE_MAX_BATCH_SIZE` | Maximum batch size for triage |

### Optional - Worktree

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKTREE_BASE_DIR` | `.worktrees` | Base directory for worktrees |
| `WORKTREE_MAX_CONCURRENT` | `3` | Maximum concurrent worktrees |
| `WORKTREE_PREFIX` | `autofix-` | Branch name prefix |

### Optional - Checks

| Variable | Description |
|----------|-------------|
| `TEST_COMMAND` | Custom test command (auto-detected from package.json) |
| `TYPECHECK_COMMAND` | Custom typecheck command |
| `LINT_COMMAND` | Custom lint command |

### Optional - Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_FIX_CONFIG` | `.auto-fix.yaml` | Custom config file path |
| `LOG_LEVEL` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_PRETTY` | `true` (dev) | Enable pretty log formatting |
| `LOG_REDACT` | `true` | Redact sensitive data in logs |
| `NO_COLOR` | - | Disable colored output |

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

### Spec-Driven Development

This project was developed using [sdd-tool](https://github.com/JakeB-5/sdd-tool) for spec management.

```bash
# Validate all specs
npx sdd-tool validate

# List specs
npx sdd-tool list
```

Specs are located in `.sdd/specs/` directory.

## Autofix Pipeline

The autofix command processes issues through a 9-stage pipeline:

```
Stage 1: Worktree Create    → Create isolated Git worktree
Stage 2: AI Analysis         → Analyze issues with Claude CLI
Stage 3: AI Fix              → Generate code fixes with Claude CLI
Stage 4: Install Deps        → Install dependencies (npm install)
Stage 5: Quality Checks      → Run typecheck → lint → test
Stage 6: Commit & Push       → Commit changes and push branch
Stage 7: Create PR           → Create pull request → autofixing branch
Stage 8: Update Issues       → Add PR link comment to issues
Stage 9: Cleanup             → Remove worktree
```

Issues are grouped by strategy (component, file, label, etc.) and processed in parallel using Git worktrees. Failed checks trigger automatic retry with AI-adjusted fixes.

### Branch Strategy

```
main ◀─────────────── (manual merge)
  └── autofixing ◀─── (PR target)
        ├── fix/issue-123
        ├── fix/issue-124-125 (grouped)
        └── fix/issue-126
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

## Documentation

- **[Setup Guide](./docs/SETUP.md)** - Initial setup for GitHub, Asana, and Sentry integration

## License

MIT
