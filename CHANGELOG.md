# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/JakeB-5/auto-fix-workflow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/JakeB-5/auto-fix-workflow/releases/tag/v0.1.0
