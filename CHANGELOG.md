# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-02-03

### Added

- **AI Integration Module** (`ai-integration.ts`)
  - `invokeClaudeCLI()` function for spawning Claude CLI processes
  - `safeInvokeClaude()` with exponential backoff retry logic for rate limits
  - `analyzeGroup()` and `applyFix()` methods for issue processing
  - 10 error codes for precise error handling (CLI_NOT_FOUND, TIMEOUT, RATE_LIMIT, BUDGET_EXCEEDED, etc.)
- **Budget Tracking Module** (`budget.ts`)
  - `BudgetTracker` class for cost management
  - Per-issue and per-session cost tracking
  - Dynamic model fallback based on budget utilization (<80% opus, 80-90% sonnet, >90% haiku)
  - `canSpend()`, `addCost()`, `getCurrentModel()`, `resetIssue()` methods
- **Prompt Templates Module** (`prompts.ts`)
  - `ANALYSIS_PROMPT_TEMPLATE`, `FIX_PROMPT_TEMPLATE`, `RETRY_PROMPT_TEMPLATE`
  - `renderTemplate()` function with Handlebars-like syntax
  - JSON schemas for structured AI output validation
- **Init Command Enhancements**
  - Auto-generate GitHub Issue Template (`.github/ISSUE_TEMPLATE/auto-fix-issue.yml`)
  - Auto-generate PR Template (`.github/PULL_REQUEST_TEMPLATE.md`)
  - Auto-create `autofixing` branch with push to origin
  - New generators: `issue-template.ts`, `pr-template.ts`, `github-labels.ts`, `branch.ts`
- **Test Suites**
  - Comprehensive test coverage for AI integration modules (1,764 lines of tests)
  - Unit tests for budget tracking, prompt rendering, and CLI integration

### Changed

- **AIAnalysisResult Type** (Breaking Change)
  - Replaced `approach` field with `rootCause` and `suggestedFix` for better structure
- **AIIntegration.canHandle()**
  - Now performs actual validation (budget + complexity + file count) instead of placeholder logic

### Documentation

- Added SDD specifications for ai-integration, budget, and prompts domains
- Updated `domains.yml` with autofix domain definitions

## [0.2.0] - 2026-01-30

### Added

- **Init Command** (`npx auto-fix-workflow init`)
  - Interactive token input for GitHub and Asana
  - Automatic `.mcp.json` generation (MCP server config)
  - Automatic `.auto-fix.yaml` generation with tokens
  - Automatic `.gitignore` update for security
  - Token validation (online API check + offline format check)
  - Non-interactive mode for CI/CD (`--non-interactive`)
  - Force overwrite option (`--force`)
  - Skip validation option (`--skip-validation`)

## [0.1.1] - 2026-01-30

### Added

- **Documentation**
  - Setup guide for GitHub, Asana, Sentry integration (`docs/SETUP.md`)
  - Korean documentation (`README.ko.md`, `docs/SETUP.ko.md`)
  - Workflow examples in README (triage, autofix, dry-run)
  - API token scopes documentation

- **SDD Specifications**
  - Added `.sdd/` specs for all modules
  - Domain definitions and constitution
  - Spec templates for future development

### Changed

- Synced spec documentation with implementation
  - `task-analyzer`: confidence type (string → number)
  - `triage`: CLI parameters aligned with implementation

### Fixed

- SDD validation workflow compatibility

---

## [0.1.0] - 2026-01-30

### Added

- **MCP Server**: Model Context Protocol server with tool registration
- **GitHub Integration**
  - `github_get_issue`: Fetch issue details
  - `github_list_issues`: List and filter issues
  - `github_create_issue`: Create issues with labels
  - `github_update_issue`: Update issue state/content
  - `github_create_pr`: Create pull requests
- **Asana Integration**
  - `asana_get_task`: Fetch task details
  - `asana_list_tasks`: List project tasks
  - `asana_update_task`: Update task status
  - `asana_analyze_task`: Analyze for auto-fix suitability
- **Git Worktree Management**
  - Create isolated worktrees for parallel development
  - Automatic cleanup on success/failure
  - Branch name generation
- **Code Quality Checks**
  - Run typecheck, lint, test in configurable order
  - Package manager auto-detection (npm/yarn/pnpm)
  - Timeout handling with process cleanup
  - Fail-fast mode support
- **Analyzer Tools**
  - Task classification (bug, feature, docs, chore)
  - Complexity estimation
  - Code location mapping
  - Issue generation from analysis
- **Workflow Orchestration**
  - Issue grouping by component/file
  - Fix strategy planning
  - Batch processing support
- **Commands**
  - `triage`: Prioritize and categorize issues
  - `autofix`: Execute full auto-fix workflow
  - Dry-run mode for previewing operations
- **Configuration**
  - YAML configuration file support
  - Environment variable overrides
  - Schema validation with Zod
- **Logging**
  - Structured logging with Pino
  - Sensitive data masking
  - Multiple log levels

### Infrastructure

- TypeScript with strict mode
- Vitest test framework (993+ tests)
- ESLint for code quality
- GitHub Actions CI/CD
- Automated npm publishing
- GitHub release automation

[0.1.1]: https://github.com/JakeB-5/auto-fix-workflow/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/JakeB-5/auto-fix-workflow/releases/tag/v0.1.0
