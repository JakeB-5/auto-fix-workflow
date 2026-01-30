---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: commands
feature: triage
depends: "asana/analyze-task, github/create-issue"
---

# /triage Command Specification

> **Purpose**: Asana Task → GitHub Issue conversion command specification

---

## 1. Overview

### 1.1 Purpose

The `/triage` command analyzes Asana tasks and converts them into structured GitHub Issues for the auto-fix workflow. It uses an AI agent to determine whether tasks contain sufficient information for conversion.

### 1.2 Key Capabilities

- **Automated Analysis**: AI agent evaluates task completeness
- **Intelligent Conversion**: Generates GitHub Issues with proper template formatting
- **Feedback Loop**: Requests missing information via Asana comments and tags
- **Batch Processing**: Handles multiple tasks in a single invocation
- **Dry-run Mode**: Preview analysis results without creating issues

### 1.3 Compliance

This specification follows:
- **RFC 2119**: Key words for requirement levels (MUST, SHOULD, MAY)
- **GIVEN-WHEN-THEN**: Behavior specification format

---

## 2. Command Signature

### 2.1 Syntax

```bash
/triage [options]
```

### 2.2 Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `--task` | string | NO | - | Specific Asana task ID (e.g., `--task 12345`) |
| `--all` | boolean | NO | false | Process all pending tasks in the "To Triage" section |
| `--dry-run` | boolean | NO | false | Analysis only, no GitHub Issue creation |
| `--project` | string | NO | config | Asana project ID (overrides config file) |

### 2.3 Parameter Rules

**RFC 2119 Requirements:**

- The command MUST accept zero or more parameters
- If `--task` is provided, the command MUST process only that specific task
- If `--all` is provided, the command MUST process all eligible tasks
- If both `--task` and `--all` are provided, the command MUST return an error
- If neither is provided, the command MUST prompt the user to select tasks
- The `--dry-run` flag MUST prevent any write operations to GitHub or Asana
- The `--project` parameter MUST override the project ID from the config file

### 2.4 Examples

```bash
# Interactive mode - shows list and asks user to select
/triage

# Process specific task
/triage --task 1234567890

# Process all pending tasks
/triage --all

# Dry-run analysis for specific task
/triage --task 1234567890 --dry-run

# Use different project
/triage --all --project 9876543210

# Dry-run all tasks
/triage --all --dry-run
```

---

## 3. Execution Flow

### 3.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  User: /triage [options]                                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. Parse Parameters & Validate                                     │
│     - Validate mutual exclusivity (--task vs --all)                 │
│     - Load config or use --project override                         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Fetch Asana Tasks                                               │
│     MCP Tool: list_asana_tasks({                                    │
│       project_id: <from config or --project>,                       │
│       section: "To Triage",                                         │
│       exclude_tags: ["triaged", "auto-fix-skip"]                    │
│     })                                                              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Filter Tasks Based on Parameters                                │
│     IF --task: Filter to specific task                              │
│     IF --all: Use all tasks                                         │
│     ELSE: Show list and prompt user selection                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Process Each Task (Sequential)                                  │
│     FOR EACH task:                                                  │
│       4.1. Analyze Task (MCP Tool: analyze_asana_task)              │
│       4.2. IF analysis successful:                                  │
│              4.2.1. Create GitHub Issue (unless --dry-run)          │
│              4.2.2. Update Asana Task (add "triaged" tag)           │
│            ELSE (analysis failed):                                  │
│              4.2.3. Update Asana Task (add feedback tag/comment)    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Output Summary Report                                           │
│     - Total tasks processed                                         │
│     - Successful conversions (GitHub Issues created)                │
│     - Failed analyses (feedback added)                              │
│     - Links to created issues                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 MCP Tool Call Sequence

**For Each Task:**

```typescript
// Step 1: Analyze task
const analysis = await mcp.call("analyze_asana_task", {
  task_id: taskId
});

// Step 2A: Success path
if (analysis.success) {
  // Create GitHub Issue (unless dry-run)
  if (!dryRun) {
    const issue = await mcp.call("create_issue", {
      title: analysis.github_issue.title,
      body: analysis.github_issue.body,
      labels: ["auto-fix", "asana", ...analysis.labels],
      asana_task_id: taskId
    });

    // Update Asana task
    await mcp.call("update_asana_task", {
      task_id: taskId,
      tags: ["triaged"],
      comment: `✅ GitHub Issue created: ${issue.html_url}`
    });
  }
}
// Step 2B: Failure path
else {
  // Add feedback to Asana (unless dry-run)
  if (!dryRun) {
    await mcp.call("update_asana_task", {
      task_id: taskId,
      tags: [analysis.feedback_tag],  // e.g., "needs-more-info"
      comment: analysis.feedback_message
    });
  }
}
```

---

## 4. Behavior Specifications

### 4.1 Task Analysis

**GIVEN** an Asana task
**WHEN** the `analyze_asana_task` tool is invoked
**THEN** the system MUST evaluate the following criteria:

1. **Reproduction Steps**: Are they clear and actionable?
2. **Error Evidence**: Is there an error message or screenshot?
3. **Code Context**: Can the related file/component be identified?
4. **Root Cause**: Can the problem be explained?
5. **Fix Direction**: Can a solution approach be suggested?

**Analysis Success Requirements (RFC 2119):**

- The task MUST contain clear reproduction steps OR an error message
- The task MUST provide enough context to identify the affected component
- The analysis SHOULD identify related files in the codebase
- The analysis SHOULD suggest a fix direction

**Analysis Failure Scenarios:**

| Scenario | Tag | Feedback Message Template |
|----------|-----|---------------------------|
| Vague description | `needs-more-info` | "추가 정보가 필요합니다:\n- 구체적인 재현 단계\n- 예상 동작 vs 실제 동작\n- 에러 메시지 (있는 경우)" |
| Cannot reproduce | `cannot-reproduce` | "재현이 불가능합니다. 다음 정보를 보충해주세요:\n- 정확한 발생 조건\n- 환경 정보 (브라우저, OS)\n- 재현 빈도" |
| Unclear requirements | `unclear-requirement` | "요구사항이 불명확합니다:\n- 기대하는 동작이 무엇인가요?\n- 현재 어떻게 동작하나요?\n- 어떤 변경을 원하시나요?" |
| Missing code context | `needs-context` | "코드 위치 파악이 어렵습니다:\n- 어떤 화면/기능에서 발생하나요?\n- 관련 UI 요소나 기능명을 알려주세요" |

### 4.2 GitHub Issue Creation

**GIVEN** a successful task analysis
**WHEN** the issue creation process executes
**THEN** the system MUST:

1. Generate issue title following the pattern: `[Asana] {task_name}`
2. Populate the issue body using the auto-fix template
3. Extract and fill the following sections:
   - **Type**: Bug Report (default) or Feature Request
   - **Source**: Set to "Asana" with task link
   - **Context**: File path, function, component (from analysis)
   - **Problem Description**: Error message and conditions
   - **Code Analysis**: Current code snippet (if available)
   - **Suggested Fix Direction**: From analysis
   - **Acceptance Criteria**: Default criteria
4. Apply labels: `["auto-fix", "asana"]` plus component labels
5. Store Asana task ID in issue metadata for linking

**Template Population Example:**

```markdown
## 🤖 Auto-Fix Issue

### Type
- [x] 🐛 Bug Report

### Source
- **Origin**: Asana
- **Reference**: [Asana Task #1234567890](https://app.asana.com/0/workspace/1234567890)

### Context
- **파일**: `src/components/Editor.tsx`
- **함수/클래스**: `handleSave()`
- **라인**: 142-156
- **컴포넌트**: `editor`

### Problem Description
새 문서 저장 시 TypeError 발생

```
TypeError: Cannot read property 'id' of undefined
    at handleSave (Editor.tsx:145)
```

- **발생 조건**: 새 문서 작성 후 저장 버튼 클릭
- **재현 빈도**: 항상

### Code Analysis
```typescript
// 현재 코드 (문제)
const handleSave = () => {
  const id = document.id;  // document가 undefined일 수 있음
  api.save(id, data);
};
```

### Suggested Fix Direction
- `document` 존재 여부 체크 필요
- 새 문서인 경우 `create` API 호출

### Acceptance Criteria
- [ ] 새 문서 저장 정상 동작
- [ ] 기존 문서 저장 정상 동작
- [ ] 기존 테스트 통과
```

### 4.3 Asana Task Updates

**Success Case:**

**GIVEN** a GitHub Issue is created
**WHEN** updating the Asana task
**THEN** the system MUST:

1. Add the `triaged` tag to the task
2. Add a comment with the GitHub Issue URL
3. Move the task to the "Triaged" section (if configured)

**Comment Template:**
```
✅ 분석 완료 - GitHub Issue 생성됨

GitHub Issue: {issue_url}

자동 수정 워크플로우가 이 이슈를 처리합니다.
```

**Failure Case:**

**GIVEN** task analysis fails
**WHEN** updating the Asana task
**THEN** the system MUST:

1. Add an appropriate feedback tag (see 4.1)
2. Add a detailed comment explaining what information is missing
3. Move the task to the "Needs More Info" section (if configured)

**Comment Template:**
```
🤖 자동 분석 결과, 추가 정보가 필요합니다:

{specific_missing_items}

위 정보를 보충해주시면 분석을 다시 시도합니다.
```

### 4.4 Dry-run Mode

**GIVEN** the `--dry-run` flag is set
**WHEN** the command executes
**THEN** the system MUST:

1. Perform all analysis steps normally
2. Generate GitHub Issue templates
3. Prepare Asana update payloads
4. Display all planned actions in the output
5. NOT execute any write operations (create_issue, update_asana_task)
6. Mark all operations with "[DRY-RUN]" prefix in the output

**Dry-run Output Format:**

```
🔍 [DRY-RUN] Analyzing tasks...

Task #1234567890: "저장 버튼 클릭 시 에러 발생"
├── Analysis: ✅ SUCCESS
├── [DRY-RUN] Would create GitHub Issue:
│   Title: [Asana] 저장 버튼 클릭 시 에러 발생
│   Labels: auto-fix, asana, component:editor
│   Body: {preview of template...}
└── [DRY-RUN] Would update Asana task:
    Tags: +triaged
    Comment: "✅ 분석 완료 - GitHub Issue 생성됨..."

Task #1234567891: "앱이 느려요"
├── Analysis: ❌ FAILED (needs-more-info)
└── [DRY-RUN] Would update Asana task:
    Tags: +needs-more-info
    Comment: "🤖 자동 분석 결과, 추가 정보가 필요합니다..."

📊 Summary:
- Total tasks: 2
- [DRY-RUN] Would create: 1 GitHub Issue
- [DRY-RUN] Would add feedback: 1 task
```

---

## 5. User Interaction Points

### 5.1 Interactive Mode

**GIVEN** no `--task` or `--all` parameter is provided
**WHEN** the command starts
**THEN** the system MUST:

1. Display a numbered list of pending tasks
2. Show task titles, IDs, and creation dates
3. Prompt the user to select tasks

**Interaction Flow:**

```
User: /triage

Claude:
🔍 Asana "To Triage" 섹션에서 태스크를 조회합니다...

📋 처리 대기 중인 태스크 (3개):

1. [#1234567890] 저장 버튼 클릭 시 에러 발생 (2025-01-28)
2. [#1234567891] 앱이 느려요 (2025-01-29)
3. [#1234567892] 로그인 후 화면 안 나옴 (2025-01-30)

처리할 태스크를 선택하세요:
1. 모든 태스크 처리 (3개)
2. 특정 태스크만 선택 (번호 입력: 1,3)
3. 취소

User: 1,3

Claude:
✅ 태스크 2개를 처리합니다...
```

**Selection Validation:**

- User input MUST be validated for correct format
- Invalid selections MUST show an error and re-prompt
- User MUST be able to cancel the operation

### 5.2 Confirmation Prompts

**Batch Operations:**

**GIVEN** the `--all` flag is used without `--dry-run`
**WHEN** the number of tasks exceeds 5
**THEN** the system MUST:

1. Display the count of tasks to be processed
2. Ask for user confirmation before proceeding

**Confirmation Format:**

```
⚠️  About to process 12 tasks. This will:
- Analyze 12 Asana tasks
- Potentially create up to 12 GitHub Issues
- Update all 12 Asana tasks with tags/comments

Continue? (y/N):
```

### 5.3 Progress Indicators

**GIVEN** multiple tasks are being processed
**WHEN** each task is being analyzed
**THEN** the system MUST:

1. Show a progress indicator (e.g., `[1/5]`, `[2/5]`, etc.)
2. Display the current task being processed
3. Show real-time status updates

**Progress Output Format:**

```
🚀 Processing tasks...

[1/3] Task #1234567890: "저장 버튼 클릭 시 에러 발생"
├── 🔍 Analyzing task...
├── ✅ Analysis successful
├── 📝 Creating GitHub Issue #123...
└── ✅ Asana task updated

[2/3] Task #1234567891: "앱이 느려요"
├── 🔍 Analyzing task...
├── ❌ Analysis failed (needs-more-info)
└── 💬 Feedback added to Asana

[3/3] Task #1234567892: "로그인 후 화면 안 나옴"
...
```

---

## 6. Output Format

### 6.1 Success Output

**GIVEN** the command completes successfully
**WHEN** generating the final output
**THEN** the system MUST display:

1. Summary statistics
2. List of created GitHub Issues with links
3. List of tasks requiring more information
4. Next steps (if applicable)

**Output Template:**

```
✅ Triage 완료

📊 처리 결과:
- 처리된 태스크: 5개
- ✅ GitHub Issue 생성: 3개
- 💬 추가 정보 필요: 2개

생성된 GitHub Issues:
- #123: [Asana] 저장 버튼 클릭 시 에러 발생
  https://github.com/owner/repo/issues/123

- #124: [Asana] 로그인 후 화면 안 나옴
  https://github.com/owner/repo/issues/124

- #125: [Asana] PDF 내보내기 오류
  https://github.com/owner/repo/issues/125

추가 정보 필요:
- #1234567891: "앱이 느려요" (needs-more-info)
- #1234567893: "버튼 색상 변경" (unclear-requirement)

💡 다음 단계:
- Asana에서 추가 정보를 받은 후 다시 /triage 실행
- 생성된 이슈는 /autofix로 자동 수정 가능
```

### 6.2 Error Output

**Common Errors:**

| Error Condition | Output Message | Exit Behavior |
|----------------|----------------|---------------|
| No tasks found | `ℹ️ "To Triage" 섹션에 처리할 태스크가 없습니다.` | Graceful exit |
| Invalid task ID | `❌ 태스크 ID {task_id}를 찾을 수 없습니다.` | Show error, exit |
| API auth failure | `❌ Asana API 인증 실패. 토큰을 확인하세요.` | Show error, exit |
| Network error | `❌ 네트워크 오류: {error_message}` | Show error, allow retry |
| Conflicting params | `❌ --task와 --all은 동시에 사용할 수 없습니다.` | Show usage, exit |

### 6.3 Dry-run Output

See section 4.4 for detailed dry-run output format.

**Key Requirements:**

- ALL output lines MUST include `[DRY-RUN]` prefix for write operations
- The output MUST clearly distinguish between performed and skipped actions
- The final summary MUST emphasize that no changes were made

---

## 7. Configuration

### 7.1 Config File Structure

**File Location:** `autofix.config.yml`

**Relevant Section:**

```yaml
asana:
  workspace_id: "1234567890"      # REQUIRED
  project_id: "0987654321"         # REQUIRED (can be overridden by --project)
  sections:
    triage: "To Triage"            # Section to read from
    needs_info: "Needs More Info"  # Where to move failed analyses
    triaged: "Triaged"             # Where to move successful analyses
  tags:
    triaged: "triaged"
    needs_info: "needs-more-info"
    cannot_reproduce: "cannot-reproduce"
    unclear: "unclear-requirement"
    needs_context: "needs-context"
    skip: "auto-fix-skip"
```

### 7.2 Environment Variables

**Required:**

```bash
ASANA_TOKEN=1/xxxxx:yyyyyyy
```

**Optional (overrides config file):**

```bash
ASANA_WORKSPACE_ID=1234567890
ASANA_PROJECT_ID=0987654321
```

### 7.3 Validation

**GIVEN** the command starts
**WHEN** loading configuration
**THEN** the system MUST:

1. Verify `ASANA_TOKEN` is set
2. Verify `workspace_id` is available (config or env)
3. Verify `project_id` is available (config, env, or --project)
4. Validate all required tags are configured
5. Show clear error messages for missing configuration

**Validation Error Example:**

```
❌ Configuration Error

Missing required configuration:
- ASANA_TOKEN environment variable not set
- asana.workspace_id not found in autofix.config.yml

Please set the environment variable or update the config file.
See docs: https://...
```

---

## 8. MCP Tool Dependencies

### 8.1 Required Tools

The `/triage` command MUST have access to the following MCP tools:

| Tool | Purpose | Input Parameters | Output |
|------|---------|------------------|--------|
| `list_asana_tasks` | Fetch tasks from section | `project_id`, `section`, `exclude_tags` | Task list |
| `get_asana_task` | Get task details | `task_id` | Full task object |
| `analyze_asana_task` | AI analysis of task | `task_id` | Analysis result + GitHub template |
| `create_issue` | Create GitHub Issue | `title`, `body`, `labels`, `asana_task_id` | Issue object |
| `update_asana_task` | Update task tags/comments | `task_id`, `tags`, `comment`, `section` | Success boolean |

### 8.2 Tool Specifications

#### `list_asana_tasks`

```typescript
interface ListAsanaTasksParams {
  project_id: string;
  section?: string;           // Section name (e.g., "To Triage")
  exclude_tags?: string[];    // Tags to exclude
  limit?: number;             // Default: 50
}

interface ListAsanaTasksResult {
  tasks: {
    id: string;
    name: string;
    created_at: string;
    tags: string[];
    assignee?: string;
  }[];
  total: number;
}
```

#### `analyze_asana_task`

```typescript
interface AnalyzeAsanaTaskParams {
  task_id: string;
}

interface AnalyzeAsanaTaskResult {
  success: boolean;

  // If success = true
  github_issue?: {
    title: string;
    body: string;              // Formatted with template
    labels: string[];          // Component labels
    component: string;
    files?: string[];
  };

  // If success = false
  feedback_tag?: string;       // e.g., "needs-more-info"
  feedback_message?: string;   // Detailed explanation
  missing_items?: string[];    // List of missing information
}
```

#### `create_issue`

```typescript
interface CreateIssueParams {
  title: string;
  body: string;
  labels: string[];
  asana_task_id: string;       // For linking
}

interface CreateIssueResult {
  number: number;
  html_url: string;
  id: number;
  created_at: string;
}
```

#### `update_asana_task`

```typescript
interface UpdateAsanaTaskParams {
  task_id: string;
  tags?: string[];             // Tags to add
  comment?: string;            // Comment to post
  section?: string;            // Section to move to
}

interface UpdateAsanaTaskResult {
  success: boolean;
  error?: string;
}
```

---

## 9. Error Handling

### 9.1 Error Categories

| Category | Handling Strategy |
|----------|-------------------|
| Configuration errors | Fail fast, show helpful message |
| Network errors | Retry with exponential backoff (max 3 attempts) |
| API errors | Log error, continue with next task |
| Analysis failures | Normal flow (add feedback to Asana) |
| Validation errors | Show error, prompt correction |

### 9.2 Retry Logic

**GIVEN** a network or transient API error occurs
**WHEN** calling an MCP tool
**THEN** the system SHOULD:

1. Retry up to 3 times with exponential backoff
2. Wait 1s, 2s, 4s between retries
3. Log each retry attempt
4. If all retries fail, show error and skip task

**Retry Output:**

```
[2/5] Task #1234567892
├── 🔍 Analyzing task...
├── ⚠️  Network error, retrying (1/3)...
├── ⚠️  Network error, retrying (2/3)...
├── ✅ Analysis successful
...
```

### 9.3 Partial Failure Handling

**GIVEN** some tasks succeed and some fail
**WHEN** processing multiple tasks
**THEN** the system MUST:

1. Continue processing remaining tasks
2. Collect all errors
3. Report both successes and failures in the summary
4. Exit with status code 0 (partial success is not a failure)

---

## 10. Performance Considerations

### 10.1 Rate Limiting

**RFC 2119 Requirements:**

- The command MUST respect Asana API rate limits (150 requests/minute)
- The command MUST respect GitHub API rate limits (5000 requests/hour)
- If rate limited, the command SHOULD wait and retry automatically
- The command MAY implement a delay between tasks to avoid rate limits

**Recommended Approach:**

- Add 500ms delay between each task processing
- Batch API calls where possible
- Use conditional requests (ETags) for repeated data

### 10.2 Parallel Processing

**Current Design:**

- Tasks MUST be processed **sequentially** (not in parallel)
- This ensures predictable ordering and easier error tracking

**Future Consideration:**

- MAY support `--parallel N` flag for concurrent processing
- Would require careful rate limit management

### 10.3 Timeout Limits

| Operation | Timeout |
|-----------|---------|
| Single task analysis | 30 seconds |
| GitHub Issue creation | 10 seconds |
| Asana task update | 10 seconds |
| Overall command | 5 minutes (configurable) |

---

## 11. Testing Scenarios

### 11.1 Unit Test Cases

**Behavior: Parameter Parsing**

```gherkin
GIVEN the command is invoked with --task and --all
WHEN the parameters are parsed
THEN an error MUST be returned

GIVEN the command is invoked with --task 12345
WHEN the parameters are parsed
THEN task_id MUST be "12345" and mode MUST be "single"

GIVEN the command is invoked with no parameters
WHEN the parameters are parsed
THEN mode MUST be "interactive"
```

**Behavior: Task Analysis**

```gherkin
GIVEN an Asana task with clear reproduction steps and error message
WHEN analyze_asana_task is called
THEN success MUST be true
AND github_issue MUST contain populated template

GIVEN an Asana task with vague description only
WHEN analyze_asana_task is called
THEN success MUST be false
AND feedback_tag MUST be "needs-more-info"
```

**Behavior: Dry-run Mode**

```gherkin
GIVEN --dry-run flag is set
WHEN a task analysis succeeds
THEN create_issue MUST NOT be called
AND update_asana_task MUST NOT be called
AND output MUST contain "[DRY-RUN]" prefix

GIVEN --dry-run flag is NOT set
WHEN a task analysis succeeds
THEN create_issue MUST be called
AND update_asana_task MUST be called
```

### 11.2 Integration Test Cases

**Scenario: End-to-end Success**

```gherkin
GIVEN 2 tasks in "To Triage" section
AND both tasks have sufficient information
WHEN /triage --all is executed
THEN 2 GitHub Issues MUST be created
AND 2 Asana tasks MUST be tagged "triaged"
AND summary MUST show "생성: 2개"
```

**Scenario: Partial Failure**

```gherkin
GIVEN 3 tasks in "To Triage" section
AND 2 tasks have sufficient information
AND 1 task lacks error details
WHEN /triage --all is executed
THEN 2 GitHub Issues MUST be created
AND 1 Asana task MUST be tagged "needs-more-info"
AND summary MUST show "생성: 2개, 추가 정보 필요: 1개"
```

**Scenario: Network Resilience**

```gherkin
GIVEN 1 task in "To Triage" section
AND Asana API returns 503 error twice then succeeds
WHEN /triage --task 12345 is executed
THEN the command MUST retry
AND eventually succeed
AND output MUST show retry attempts
```

### 11.3 Manual Test Checklist

- [ ] `/triage` with no parameters shows interactive prompt
- [ ] User can select specific tasks by number
- [ ] User can cancel the operation
- [ ] `/triage --task 12345` processes only that task
- [ ] `/triage --all` processes all pending tasks
- [ ] `/triage --all` prompts confirmation if >5 tasks
- [ ] `/triage --dry-run` shows planned actions without executing
- [ ] Created GitHub Issues have correct template format
- [ ] Asana tasks receive correct tags and comments
- [ ] Summary report shows accurate counts
- [ ] Error messages are clear and actionable
- [ ] Rate limiting is respected
- [ ] Configuration validation works correctly

---

## 12. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-30 | Initial specification |

---

## 13. References

- **Parent Document**: `auto-fix-workflow.md` section 3.3
- **Related Specs**: `/autofix` command (to be created)
- **MCP Tool Specs**: `tools/asana/` (to be implemented)
- **GitHub Issue Template**: `auto-fix-workflow.md` section 3.1
