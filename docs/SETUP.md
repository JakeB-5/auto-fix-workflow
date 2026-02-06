# Setup Guide

English | [한국어](./SETUP.ko.md)

> This guide covers the initial setup required before using auto-fix-workflow. These settings cannot be automated and must be configured manually.

## Quick Setup with Init Command

The easiest way to set up auto-fix-workflow is using the init command:

```bash
npx auto-fix-workflow init
```

This interactive command will:
1. Ask for your GitHub token
2. Ask for your Asana token
3. Validate the tokens
4. Create `.mcp.json` and `.auto-fix.yaml`
5. Add `.auto-fix.yaml` to `.gitignore`
6. Create `.github/ISSUE_TEMPLATE/auto-fix-issue.yml`
7. Create `.github/pull_request_template.md`
8. Create and push `autofixing` branch

After running init, you'll need to manually configure:
- GitHub owner and repo in `.auto-fix.yaml`
- Asana workspaceId and projectId in `.auto-fix.yaml`
- Create GitHub labels (see below)

For non-interactive setup (CI/CD):
```bash
GITHUB_TOKEN=xxx ASANA_TOKEN=yyy npx auto-fix-workflow init --non-interactive
```

## Prerequisites

Before using auto-fix-workflow, ensure the following are installed:

### Claude CLI (Required for autofix)

The autofix command uses Claude CLI for AI-powered code analysis and fix generation.

```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-cli

# Authenticate
claude auth login
```

### Node.js

Node.js 20 or higher is required.

```bash
node --version  # Must be >= 20.0.0
```

## Table of Contents

- [Quick Setup with Init Command](#quick-setup-with-init-command)
- [Prerequisites](#prerequisites)
- [GitHub Setup](#github-setup)
- [Asana Setup](#asana-setup)
- [Sentry Setup](#sentry-setup)
- [Configuration File](#configuration-file)
- [Environment Variables](#environment-variables)
- [Setup Checklist](#setup-checklist)

---

## GitHub Setup

### 1. Personal Access Token (PAT)

**Location:** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens

**Required Permissions:**
- Repository access: Select target repositories
- Permissions:
  - Issues: Read and write
  - Pull requests: Read and write
  - Contents: Read and write (for PR commits)
  - Metadata: Read-only

**Environment Variables:**
```bash
# .env or environment variables
GITHUB_TOKEN=github_pat_xxxxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

### 2. Create Repository Labels

Create the following labels in your GitHub repository:

| Label | Color (Recommended) | Description |
|-------|---------------------|-------------|
| `auto-fix` | `#0E8A16` (green) | Auto-fix target |
| `auto-fix-skip` | `#E4E669` (yellow) | Exclude from auto-fix |
| `auto-fix-failed` | `#D93F0B` (red) | Auto-fix failed |
| `auto-fix-processing` | `#1D76DB` (blue) | Processing |
| `sentry` | `#FBCA04` (orange) | Created from Sentry |
| `asana` | `#D4C5F9` (purple) | Created from Asana |
| `component:*` | `#C5DEF5` | Component-based (customize for your project) |

### 3. Issue Template Setup

✅ **Automatically created by `npx auto-fix-workflow init`**

The init command creates `.github/ISSUE_TEMPLATE/auto-fix-issue.yml` with the following structure:

```yaml
name: Auto-Fix Issue
description: Issue for automated fixing
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
      description: "Origin of this issue (Sentry/Asana/Direct)"
      placeholder: "e.g., Sentry Issue #123"

  - type: textarea
    id: context
    attributes:
      label: Context
      description: "Code location information"
      value: |
        - **File**:
        - **Function/Class**:
        - **Line**:
        - **Component**:

  - type: textarea
    id: problem
    attributes:
      label: Problem Description
      description: "Detailed description of the problem"
    validations:
      required: true

  - type: textarea
    id: code-analysis
    attributes:
      label: Code Analysis
      description: "Current problematic code (if known)"
      render: typescript

  - type: textarea
    id: suggested-fix
    attributes:
      label: Suggested Fix Direction
      description: "Hints for fixing (optional)"

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: "Conditions for completion"
      value: |
        - [ ] Error no longer occurs
        - [ ] All existing tests pass
```

### 4. Create autofixing Branch

✅ **Automatically created by `npx auto-fix-workflow init`**

The init command creates and pushes the `autofixing` branch to the remote repository.

If you need to create it manually:
```bash
git checkout main
git checkout -b autofixing
git push -u origin autofixing
```

### 5. Branch Protection Rules (Optional)

**Location:** GitHub → Repository → Settings → Branches → Add rule

**autofixing branch:**
- Require pull request reviews before merging: OFF (for automated PRs)
- Require status checks to pass: ON (CI required)
- Allow force pushes: OFF

**main branch:**
- Require pull request reviews before merging: ON
- Require status checks to pass: ON

---

## Asana Setup

### 1. Personal Access Token

**Location:** Asana → My Settings → Apps → Developer apps → Create new token

Or visit: https://app.asana.com/0/developer-console

**Environment Variables:**
```bash
ASANA_TOKEN=1/xxxxx:yyyyyyy
```

### 2. Find Workspace and Project IDs

From project URL: `https://app.asana.com/0/{workspace_id}/{project_id}`

**Environment Variables:**
```bash
ASANA_WORKSPACE_ID=1234567890
ASANA_PROJECT_ID=0987654321
```

### 3. Project Structure (Recommended)

Create the following sections in your Asana project:

```
Bug Reports (Project)
├── 📥 Inbox              # Newly reported bugs
├── 🔍 To Triage          # /triage target (agent reads this)
├── ⏳ Needs More Info    # Needs additional information
├── ✅ Triaged            # GitHub Issue created
└── 🚫 Won't Fix          # Will not fix
```

### 4. Custom Fields (Optional)

Add custom fields to the project:

| Field | Type | Options |
|-------|------|---------|
| Priority | Dropdown | High, Medium, Low |
| Component | Dropdown | canvas-core, editor, ui, ... |
| Browser | Text | Browser info |
| OS | Text | Operating system info |

### 5. Create Tags

Create the following tags in your Asana workspace:

| Tag | Color (Recommended) | Purpose |
|-----|---------------------|---------|
| `triaged` | Green | Analysis complete, GitHub Issue created |
| `needs-more-info` | Yellow | Additional info required |
| `cannot-reproduce` | Red | Cannot reproduce |
| `unclear-requirement` | Orange | Requirements unclear |
| `needs-context` | Blue | Code location/context needed |
| `auto-fix-skip` | Gray | Exclude from auto-processing |

---

## Sentry Setup

### 1. Create Internal Integration

**Location:** Sentry → Settings → Developer Settings → Internal Integrations → Create New

**Required Permissions:**
- Project: Read
- Issue & Event: Read & Write
- Organization: Read

**Environment Variables:**
```bash
SENTRY_AUTH_TOKEN=sntrys_xxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### 2. GitHub Integration

**Location:** Sentry → Settings → Integrations → GitHub → Install

**Settings:**
- Repository: Connect target repository
- Stack Trace Linking: Enable (auto-maps code locations)

### 3. Alert Rules (Auto Issue Creation)

**Location:** Sentry → Alerts → Create Alert Rule

**Conditions:**
- WHEN: An event is seen
- IF:
  - event.count >= 5 (occurred 5+ times)
  - level IN [error, fatal]
  - environment = production
- THEN: Create GitHub Issue
  - Repository: Target repository
  - Labels: auto-fix, sentry

**Alert Rule Example (YAML):**
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

### 4. Issue Template (Sentry → GitHub)

**Location:** Sentry → Settings → Integrations → GitHub → Configure → Issue Templates

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
- **File**: {{ filename }}
- **Function**: {{ function }}
- **Line**: {{ lineNo }}

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

## Configuration File

After running `npx auto-fix-workflow init`, the `.auto-fix.yaml` file will be created with this structure:

```yaml
# Tokens (this file is added to .gitignore for security)
tokens:
  github: "your-github-token"
  asana: "your-asana-token"

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

ai:
  budgetPerIssue: 1.0           # Maximum USD per issue (default: 1.0)
  budgetPerSession: 100.0       # Maximum USD per session (default: 100.0)
  preferredModel: "opus"        # Primary model (opus|sonnet|haiku)
  fallbackModel: "sonnet"       # Fallback when budget tight
  analysisTimeout: 300000       # 5 minutes for analysis
  fixTimeout: 600000            # 10 minutes for fix operations
  minConfidence: 0.5            # Minimum confidence to proceed with fix
```

### AI Configuration Details

**Model Fallback Mechanism:**
- The system starts with `preferredModel` for initial analysis and fix attempts
- If budget usage exceeds thresholds, automatically downgrades to `fallbackModel`
- Fallback logic: opus → sonnet → haiku (based on budget constraints)
- This ensures task completion while staying within budget limits

**Budget Tracking:**
- `budgetPerIssue`: Resets for each new issue/PR creation cycle
- `budgetPerSession`: Cumulative across all issues in a single workflow session
- When either limit is reached, the system uses the fallback model or pauses for approval

**Prerequisites:**
- Claude CLI must be installed and authenticated
- Install: `npm install -g @anthropic-ai/claude-cli`
- Authenticate: `claude auth login`

---

## Environment Variables

Environment variables override values from `.auto-fix.yaml`. Priority: CLI flags > Environment variables > Config file > Defaults.

### Authentication

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Yes |
| `ASANA_TOKEN` | Asana Personal Access Token | For triage command |

### GitHub

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_OWNER` | - | Repository owner |
| `GITHUB_REPO` | - | Repository name |
| `GITHUB_API_URL` | - | Custom API URL (for GitHub Enterprise) |
| `GITHUB_DEFAULT_BRANCH` | `main` | Default branch name |
| `AUTOFIX_LABEL` | `auto-fix` | Label for auto-fix target issues |
| `AUTOFIX_SKIP_LABEL` | `auto-fix-skip` | Label to exclude from auto-fix |

### Asana

| Variable | Description |
|----------|-------------|
| `ASANA_DEFAULT_PROJECT_GID` | Default Asana project GID |
| `ASANA_TRIAGE_SECTION` | Section name to scan for triage tasks |
| `ASANA_PROCESSED_SECTION` | Section name for processed tasks |
| `ASANA_SYNCED_TAG` | Tag name for synced tasks |
| `TRIAGE_MAX_BATCH_SIZE` | Maximum batch size for triage |

### Worktree

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKTREE_BASE_DIR` | `.worktrees` | Base directory for worktrees |
| `WORKTREE_MAX_CONCURRENT` | `3` | Maximum concurrent worktrees |
| `WORKTREE_PREFIX` | `autofix-` | Branch name prefix for fix branches |

### Quality Checks

| Variable | Description |
|----------|-------------|
| `TEST_COMMAND` | Custom test command (auto-detected from package.json if not set) |
| `TYPECHECK_COMMAND` | Custom typecheck command (auto-detected if not set) |
| `LINT_COMMAND` | Custom lint command (auto-detected if not set) |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_FIX_CONFIG` | `.auto-fix.yaml` | Custom config file path |
| `LOG_LEVEL` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_PRETTY` | `true` (dev) | Enable pretty log formatting |
| `LOG_REDACT` | `true` | Redact sensitive data in logs |
| `NO_COLOR` | - | Disable colored output |

---

## Setup Checklist

| Service | Item | Status |
|---------|------|--------|
| **Prerequisites** | Claude CLI installed | ☐ |
| | Claude CLI authenticated | ☐ |
| **GitHub** | PAT issued | ☐ |
| | Labels created (7+) | ☐ |
| | Issue template added | ✅ (auto) |
| | PR template added | ✅ (auto) |
| | autofixing branch created | ✅ (auto) |
| | Branch protection configured | ☐ |
| **Asana** | PAT issued | ☐ |
| | Project ID confirmed | ☐ |
| | Section structure set up | ☐ |
| | Tags created (6) | ☐ |
| **Sentry** | Internal Integration created | ☐ |
| | GitHub Integration connected | ☐ |
| | Alert Rule configured | ☐ |
| | Issue template configured | ☐ |
| **MCP** | Config file created | ☐ |
| | Environment variables set | ☐ |

---

## Related Documentation

- [MCP Server Development Guide](https://modelcontextprotocol.io)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [GitHub Fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Asana API Documentation](https://developers.asana.com/docs)
- [Sentry Integration](https://docs.sentry.io/product/integrations/source-code-mgmt/github/)
- [Sentry Alerts](https://docs.sentry.io/product/alerts/)
