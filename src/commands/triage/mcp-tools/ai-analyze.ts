/**
 * @module commands/triage/mcp-tools/ai-analyze
 * @description MCP tool for AI-powered task analysis
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Result } from '../../../common/types/index.js';
import { ok, err } from '../../../common/types/index.js';
import type { IssueType, IssuePriority } from '../../../common/types/index.js';
import type { AsanaTask, TaskAnalysis } from '../types.js';

/**
 * AI analysis prompt template
 */
const ANALYSIS_PROMPT = `Analyze the following task and provide a structured analysis for creating a GitHub issue.

Task Title: {{title}}
Task Description:
{{description}}

Additional Context:
- Due Date: {{dueDate}}
- Assignee: {{assignee}}
- Tags: {{tags}}
- Custom Fields: {{customFields}}

Please analyze this task and provide:
1. Issue type (bug, feature, refactor, docs, test, chore)
2. Priority (critical, high, medium, low)
3. Suggested labels for GitHub
4. Component/module this affects
5. Related files (if mentioned or inferable)
6. A clear summary suitable for a GitHub issue
7. Acceptance criteria (testable conditions for completion)
8. Your confidence level (0-1) in this analysis

Respond in JSON format:
{
  "issueType": "bug|feature|refactor|docs|test|chore",
  "priority": "critical|high|medium|low",
  "labels": ["label1", "label2"],
  "component": "component-name",
  "relatedFiles": ["path/to/file1.ts"],
  "summary": "Clear description of what needs to be done",
  "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
  "confidence": 0.85
}`;

/**
 * AI Analysis MCP tool
 */
export class AIAnalyzeTool {
  private readonly client: Client;
  private readonly analyzeToolName: string;
  private readonly modelId: string;

  constructor(
    client: Client,
    options: {
      analyzeToolName?: string;
      modelId?: string;
    } = {}
  ) {
    this.client = client;
    this.analyzeToolName = options.analyzeToolName ?? 'claude_analyze';
    this.modelId = options.modelId ?? 'claude-3-5-sonnet-20241022';
  }

  /**
   * Analyze an Asana task using AI
   */
  async analyzeTask(task: AsanaTask): Promise<Result<TaskAnalysis, Error>> {
    try {
      const prompt = this.buildPrompt(task);

      const result = await this.client.callTool({
        name: this.analyzeToolName,
        arguments: {
          prompt,
          model: this.modelId,
          response_format: { type: 'json_object' },
        },
      });

      if (!result.content || !Array.isArray(result.content)) {
        return err(new Error('Invalid response from AI analysis tool'));
      }

      const textContent = result.content.find(
        (c): c is { type: 'text'; text: string } => c.type === 'text'
      );

      if (!textContent) {
        return err(new Error('No text content in AI analysis response'));
      }

      const analysis = this.parseAnalysisResponse(textContent.text);
      return ok(analysis);
    } catch (error) {
      // If AI analysis fails, return a fallback analysis
      return ok(this.getFallbackAnalysis(task));
    }
  }

  /**
   * Analyze multiple tasks in batch
   */
  async analyzeTasks(tasks: readonly AsanaTask[]): Promise<Result<Map<string, TaskAnalysis>, Error>> {
    const results = new Map<string, TaskAnalysis>();

    for (const task of tasks) {
      const analysisResult = await this.analyzeTask(task);
      if (analysisResult.success) {
        results.set(task.gid, analysisResult.data);
      } else {
        // Use fallback for failed analyses
        results.set(task.gid, this.getFallbackAnalysis(task));
      }
    }

    return ok(results);
  }

  /**
   * Build the analysis prompt for a task
   */
  private buildPrompt(task: AsanaTask): string {
    const customFieldsStr = task.customFields
      ?.map((f) => `${f.name}: ${f.displayValue ?? f.textValue ?? f.numberValue ?? 'N/A'}`)
      .join(', ') ?? 'None';

    const tagsStr = task.tags?.map((t) => t.name).join(', ') ?? 'None';

    return ANALYSIS_PROMPT
      .replace('{{title}}', task.name)
      .replace('{{description}}', task.notes || 'No description provided')
      .replace('{{dueDate}}', task.dueOn || task.dueAt || 'Not set')
      .replace('{{assignee}}', task.assignee?.name || 'Unassigned')
      .replace('{{tags}}', tagsStr)
      .replace('{{customFields}}', customFieldsStr);
  }

  /**
   * Parse the AI analysis response
   */
  private parseAnalysisResponse(responseText: string): TaskAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        issueType: this.validateIssueType(parsed.issueType),
        priority: this.validatePriority(parsed.priority),
        labels: Array.isArray(parsed.labels) ? parsed.labels : [],
        component: String(parsed.component || 'general'),
        relatedFiles: Array.isArray(parsed.relatedFiles) ? parsed.relatedFiles : [],
        summary: String(parsed.summary || ''),
        acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      };
    } catch (error) {
      throw new Error(`Failed to parse AI analysis response: ${String(error)}`);
    }
  }

  /**
   * Validate and normalize issue type
   */
  private validateIssueType(type: unknown): IssueType {
    const validTypes: IssueType[] = ['bug', 'feature', 'refactor', 'docs', 'test', 'chore'];
    const normalized = String(type).toLowerCase();
    return validTypes.includes(normalized as IssueType) ? (normalized as IssueType) : 'chore';
  }

  /**
   * Validate and normalize priority
   */
  private validatePriority(priority: unknown): IssuePriority {
    const validPriorities: IssuePriority[] = ['critical', 'high', 'medium', 'low'];
    const normalized = String(priority).toLowerCase();
    return validPriorities.includes(normalized as IssuePriority) ? (normalized as IssuePriority) : 'medium';
  }

  /**
   * Get fallback analysis when AI fails
   */
  private getFallbackAnalysis(task: AsanaTask): TaskAnalysis {
    // Try to infer type from task name
    const nameLower = task.name.toLowerCase();
    let issueType: IssueType = 'chore';
    if (nameLower.includes('bug') || nameLower.includes('fix') || nameLower.includes('error')) {
      issueType = 'bug';
    } else if (nameLower.includes('feature') || nameLower.includes('add') || nameLower.includes('implement')) {
      issueType = 'feature';
    } else if (nameLower.includes('refactor') || nameLower.includes('clean')) {
      issueType = 'refactor';
    } else if (nameLower.includes('test')) {
      issueType = 'test';
    } else if (nameLower.includes('doc')) {
      issueType = 'docs';
    }

    // Try to infer priority from custom fields or due date
    let priority: IssuePriority = 'medium';
    const priorityField = task.customFields?.find((f) =>
      f.name.toLowerCase().includes('priority')
    );
    if (priorityField?.displayValue) {
      const priorityValue = priorityField.displayValue.toLowerCase();
      if (priorityValue.includes('critical') || priorityValue.includes('urgent')) {
        priority = 'critical';
      } else if (priorityValue.includes('high')) {
        priority = 'high';
      } else if (priorityValue.includes('low')) {
        priority = 'low';
      }
    }

    // If due date is soon, increase priority
    if (task.dueOn || task.dueAt) {
      const dueDate = new Date(task.dueOn || task.dueAt!);
      const daysUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue <= 1 && priority !== 'critical') {
        priority = 'high';
      }
    }

    return {
      issueType,
      priority,
      labels: [issueType],
      component: 'general',
      relatedFiles: [],
      summary: task.notes || task.name,
      acceptanceCriteria: ['Task requirements are met', 'Code review approved'],
      confidence: 0.3, // Low confidence for fallback
    };
  }

  /**
   * Enhance analysis with codebase context
   */
  async enhanceWithContext(
    analysis: TaskAnalysis,
    codebaseContext: string
  ): Promise<Result<TaskAnalysis, Error>> {
    try {
      const enhancementPrompt = `Given this initial analysis and codebase context, enhance the analysis:

Initial Analysis:
${JSON.stringify(analysis, null, 2)}

Codebase Context:
${codebaseContext}

Provide an enhanced analysis with more specific:
1. Related files (actual paths from the codebase)
2. Component identification
3. Acceptance criteria

Respond in the same JSON format as before.`;

      const result = await this.client.callTool({
        name: this.analyzeToolName,
        arguments: {
          prompt: enhancementPrompt,
          model: this.modelId,
          response_format: { type: 'json_object' },
        },
      });

      if (!result.content || !Array.isArray(result.content)) {
        return ok(analysis); // Return original on failure
      }

      const textContent = result.content.find(
        (c): c is { type: 'text'; text: string } => c.type === 'text'
      );

      if (!textContent) {
        return ok(analysis);
      }

      const enhanced = this.parseAnalysisResponse(textContent.text);
      return ok({
        ...enhanced,
        // Keep original if enhanced has empty values
        relatedFiles: enhanced.relatedFiles.length > 0 ? enhanced.relatedFiles : analysis.relatedFiles,
        acceptanceCriteria: enhanced.acceptanceCriteria.length > 0 ? enhanced.acceptanceCriteria : analysis.acceptanceCriteria,
      });
    } catch {
      return ok(analysis); // Return original on any error
    }
  }
}

/**
 * Create an AIAnalyzeTool instance
 */
export function createAIAnalyzeTool(
  client: Client,
  options?: {
    analyzeToolName?: string;
    modelId?: string;
  }
): AIAnalyzeTool {
  return new AIAnalyzeTool(client, options);
}
