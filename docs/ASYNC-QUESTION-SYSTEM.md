# Async Question System

English | [한국어](./ASYNC-QUESTION-SYSTEM.ko.md)

> Design document for handling human-in-the-loop scenarios in fully automated workflows.

## Problem Statement

In a fully automated workflow (issue → fix → deploy), the agent may encounter situations requiring human input:

- Unclear requirements
- Multiple valid fix approaches
- Security/permission decisions
- Breaking change confirmations

The standard `AskUserQuestion` tool only works in interactive sessions where a human is present. Automated workflows (cron jobs, webhooks) run headless without a human to respond.

## Current Limitation

```
Interactive Session (Works)
┌─────────────────────────────────────────────────────────┐
│  User ◄──────► Claude ◄──────► MCP Server               │
│    │              │                                     │
│    └── AskUserQuestion response ──┘                     │
│         (human responds immediately)                    │
└─────────────────────────────────────────────────────────┘

Automated Workflow (Blocked)
┌─────────────────────────────────────────────────────────┐
│  Cron/Webhook ──► Claude ──► MCP Server                 │
│       ?              │                                  │
│       └── AskUserQuestion ──► ??? (no human present)    │
│                              │                          │
│                              └── workflow blocked ❌     │
└─────────────────────────────────────────────────────────┘
```

## Proposed Solution: Async Question System

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                      Issue Processing                           │
└─────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      Analysis Agent                             │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ High Conf.  │    │ Medium Conf.│    │ Low Confidence      │ │
│  │ (≥80%)      │    │ (50-80%)    │    │ (<50%)              │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                      │             │
└─────────┼──────────────────┼──────────────────────┼─────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
   ┌────────────┐    ┌─────────────────┐    ┌─────────────┐
   │ Auto Fix   │    │ Post Question   │    │ Skip/Manual │
   └──────┬─────┘    │ & Suspend       │    └─────────────┘
          │          └────────┬────────┘
          │                   │
          │                   ▼
          │          ┌─────────────────────────────────────┐
          │          │         Question Store              │
          │          │  ┌───────────────────────────────┐  │
          │          │  │ questionId: "q-123"           │  │
          │          │  │ issueNumber: 456              │  │
          │          │  │ question: "Which approach?"   │  │
          │          │  │ options: ["A", "B", "C"]      │  │
          │          │  │ status: "pending"             │  │
          │          │  │ timeout: "2024-01-15T12:00Z"  │  │
          │          │  └───────────────────────────────┘  │
          │          └────────────────┬────────────────────┘
          │                           │
          │          ┌────────────────┴────────────────┐
          │          │                                 │
          │          ▼                                 ▼
          │   ┌─────────────┐                 ┌─────────────┐
          │   │ Slack Bot   │                 │ GitHub      │
          │   │ Notification│                 │ Comment     │
          │   └──────┬──────┘                 └──────┬──────┘
          │          │                               │
          │          └───────────┬───────────────────┘
          │                      │
          │                      ▼ Human responds
          │          ┌─────────────────────────────────────┐
          │          │         Webhook Handler             │
          │          │  - Validate response                │
          │          │  - Update question status           │
          │          │  - Trigger workflow resume          │
          │          └────────────────┬────────────────────┘
          │                           │
          │                           ▼
          │          ┌─────────────────────────────────────┐
          │          │         Workflow State Store        │
          │          │  - Load checkpoint                  │
          │          │  - Inject answer                    │
          │          │  - Resume processing                │
          │          └────────────────┬────────────────────┘
          │                           │
          └───────────────────────────┤
                                      ▼
                            ┌─────────────────┐
                            │ Create PR       │
                            │ & Deploy        │
                            └─────────────────┘
```

### Components

#### 1. Question Store

Stores pending questions with metadata.

```typescript
interface PendingQuestion {
  questionId: string;
  issueNumber: number;
  workflowRunId: string;

  // Question content
  question: string;
  context?: string;           // Code snippets, logs, etc.
  options?: QuestionOption[]; // Multiple choice options

  // Notification settings
  notifyChannels: NotifyChannel[];
  notifiedAt?: Date;

  // Timeout handling
  createdAt: Date;
  timeoutAt: Date;
  timeoutAction: 'skip' | 'default' | 'escalate' | 'fail';
  defaultAnswer?: string;

  // Response
  status: 'pending' | 'answered' | 'timeout' | 'cancelled';
  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;
}

interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

type NotifyChannel =
  | { type: 'github'; issueNumber: number }
  | { type: 'slack'; channel: string; mention?: string[] }
  | { type: 'email'; recipients: string[] };
```

#### 2. Workflow State Store

Persists workflow state for resumption.

```typescript
interface WorkflowState {
  runId: string;
  issueNumber: number;

  status: 'running' | 'suspended' | 'completed' | 'failed';
  currentStep: string;

  // Checkpoint for resumption
  checkpoint: {
    step: string;
    data: Record<string, unknown>;
    pendingQuestionId?: string;
  };

  // Audit trail
  history: WorkflowEvent[];

  createdAt: Date;
  updatedAt: Date;
  suspendedAt?: Date;
  resumedAt?: Date;
}

interface WorkflowEvent {
  timestamp: Date;
  type: 'started' | 'step_completed' | 'suspended' | 'resumed' | 'completed' | 'failed';
  step?: string;
  details?: Record<string, unknown>;
}
```

#### 3. Notification Service

Sends questions through configured channels.

```typescript
interface NotificationService {
  // Send question to all configured channels
  notify(question: PendingQuestion): Promise<NotificationResult[]>;

  // Channel-specific implementations
  notifyGitHub(question: PendingQuestion, issueNumber: number): Promise<void>;
  notifySlack(question: PendingQuestion, channel: string, mention?: string[]): Promise<void>;
  notifyEmail(question: PendingQuestion, recipients: string[]): Promise<void>;
}
```

**GitHub Comment Format:**

```markdown
## 🤖 Agent Question

The automated workflow needs your input to proceed.

### Question
Which approach should be used to fix the null reference error?

### Options
- [ ] **A) Add null check** - Simple guard clause, minimal change
- [ ] **B) Initialize early** - Refactor to ensure object exists
- [ ] **C) Optional chaining** - Use `?.` operator throughout

### Context
```typescript
// Current code (line 45)
const value = obj.property.nested; // Error: obj may be null
```

### How to Respond
Reply to this comment with your choice (A, B, or C).

### Timeout
If no response by **2024-01-15 12:00 UTC**, the workflow will **skip this issue**.

---
*Workflow Run: `run-abc123` | Question ID: `q-456`*
```

**Slack Message Format:**

```
🤖 *Agent Question* - Issue #123

The automated workflow needs your input.

*Question:* Which approach should be used to fix the null reference error?

*Options:*
• A) Add null check - Simple guard clause
• B) Initialize early - Refactor to ensure object exists
• C) Optional chaining - Use `?.` operator

Reply with: `/answer q-456 A` (or B, C)

⏰ Timeout: 2024-01-15 12:00 UTC (will skip if no response)
```

#### 4. Webhook Handler

Processes responses from various channels.

```typescript
interface WebhookHandler {
  // GitHub webhook (issue_comment event)
  handleGitHubComment(payload: GitHubCommentPayload): Promise<void>;

  // Slack interaction (slash command or button)
  handleSlackInteraction(payload: SlackInteractionPayload): Promise<void>;

  // Generic answer endpoint
  handleAnswer(questionId: string, answer: string, answeredBy: string): Promise<void>;
}
```

#### 5. Timeout Scheduler

Handles questions that exceed their timeout.

```typescript
interface TimeoutScheduler {
  // Check and process timed-out questions
  processTimeouts(): Promise<void>;

  // Execute timeout action
  executeTimeoutAction(question: PendingQuestion): Promise<void>;
}

// Timeout actions
type TimeoutAction =
  | { type: 'skip'; addLabel: string }
  | { type: 'default'; useAnswer: string }
  | { type: 'escalate'; notifyChannel: string; assignTo: string }
  | { type: 'fail'; markAs: 'auto-fix-failed' };
```

### MCP Tools

#### `post_question`

Posts a question and suspends the workflow.

```typescript
interface PostQuestionInput {
  issueNumber: number;
  question: string;
  options?: Array<{
    value: string;
    label: string;
    description?: string;
    isDefault?: boolean;
  }>;
  context?: string;
  notifyVia: ('github' | 'slack' | 'email')[];
  timeoutHours: number;
  timeoutAction: 'skip' | 'default' | 'escalate' | 'fail';
  defaultAnswer?: string;
  slackChannel?: string;
  slackMention?: string[];
  emailRecipients?: string[];
}

interface PostQuestionOutput {
  questionId: string;
  workflowRunId: string;
  status: 'pending';
  notificationsSent: string[];
  timeoutAt: string;
}
```

#### `check_answer`

Checks if a question has been answered.

```typescript
interface CheckAnswerInput {
  questionId: string;
}

interface CheckAnswerOutput {
  status: 'pending' | 'answered' | 'timeout' | 'cancelled';
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
}
```

#### `cancel_question`

Cancels a pending question.

```typescript
interface CancelQuestionInput {
  questionId: string;
  reason?: string;
}

interface CancelQuestionOutput {
  success: boolean;
  previousStatus: string;
}
```

### Workflow Integration

```yaml
# Example workflow definition
name: autofix
triggers:
  - label_added: "auto-fix"
  - schedule: "0 */6 * * *"  # Every 6 hours

steps:
  - id: analyze
    tool: analyze_issue
    output: analysis

  - id: check_confidence
    condition: analysis.confidence < 80
    tool: post_question
    input:
      question: "{{ analysis.uncertainQuestion }}"
      options: "{{ analysis.suggestedOptions }}"
      notifyVia: [github, slack]
      timeoutHours: 24
      timeoutAction: skip
    suspend: true  # Workflow pauses here

  - id: apply_fix
    tool: apply_code_fix
    input:
      approach: "{{ answer || analysis.defaultApproach }}"

  - id: run_checks
    tool: run_checks

  - id: create_pr
    tool: github_create_pr

on_resume:
  # Called when answer is received
  inject:
    answer: "{{ pendingQuestion.answer }}"
  goto: apply_fix

on_timeout:
  # Called when timeout action is 'skip'
  tool: update_github_issue
  input:
    addLabels: ["auto-fix-skip"]
    addComment: "Skipped due to no response within timeout period."
```

### Storage Options

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **SQLite** | Simple, file-based, no setup | Single instance only | Small teams, local dev |
| **PostgreSQL** | Robust, scalable | Requires setup | Production |
| **Redis** | Fast, TTL support | Data volatility | High throughput |
| **GitHub Issues** | No extra infra | Limited querying | GitHub-centric workflows |

### Security Considerations

1. **Answer Validation**
   - Verify responder has permission
   - Validate answer matches expected options
   - Rate limit responses

2. **Question Content**
   - Don't expose sensitive code in public channels
   - Sanitize context before posting

3. **Webhook Security**
   - Verify webhook signatures (GitHub, Slack)
   - Use HTTPS endpoints
   - Implement request validation

### Monitoring & Observability

```typescript
interface Metrics {
  // Question metrics
  questionsPosted: Counter;
  questionsAnswered: Counter;
  questionsTimedOut: Counter;
  answerLatency: Histogram;  // Time to answer

  // Workflow metrics
  workflowsSuspended: Counter;
  workflowsResumed: Counter;
  avgSuspensionDuration: Gauge;
}

interface Alerts {
  // Alert when questions pile up
  pendingQuestionsThreshold: number;  // e.g., > 10

  // Alert when timeout rate is high
  timeoutRateThreshold: number;  // e.g., > 30%
}
```

### Implementation Phases

#### Phase 1: GitHub-only (MVP)
- Post questions as GitHub issue comments
- Parse responses from comment replies
- Simple timeout handling (add label, skip)

#### Phase 2: Multi-channel
- Add Slack integration
- Add email notifications
- Unified answer handling

#### Phase 3: Dashboard
- Web UI for pending questions
- Batch answer capability
- Analytics and reporting

## Related Documents

- [Setup Guide](./SETUP.md) - Initial configuration
- [Workflow Examples](../README.md#workflow-examples) - Usage examples

## Future Considerations

- **LLM-assisted clarification**: Use AI to rephrase unclear questions
- **Auto-answer suggestions**: Suggest answers based on similar past questions
- **Approval workflows**: Multi-person approval for critical changes
- **SLA tracking**: Track response times by team/individual
