/**
 * @module commands/triage/mcp-tools/github-create
 * @description MCP tool for creating GitHub issues
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Result } from '../../../common/types/index.js';
import { ok, err } from '../../../common/types/index.js';
import type { GitHubIssueParams, GitHubIssueResult, AsanaTask, TaskAnalysis } from '../types.js';

/**
 * GitHub MCP tool for creating issues
 */
export class GitHubCreateTool {
  private readonly client: Client;
  private readonly owner: string;
  private readonly repo: string;
  private readonly createIssueToolName: string;

  constructor(
    client: Client,
    owner: string,
    repo: string,
    createIssueToolName = 'github_create_issue'
  ) {
    this.client = client;
    this.owner = owner;
    this.repo = repo;
    this.createIssueToolName = createIssueToolName;
  }

  /**
   * Create a GitHub issue
   */
  async createIssue(params: GitHubIssueParams): Promise<Result<GitHubIssueResult, Error>> {
    try {
      const toolParams: Record<string, unknown> = {
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.body,
      };

      if (params.labels && params.labels.length > 0) {
        toolParams['labels'] = [...params.labels];
      }

      if (params.assignees && params.assignees.length > 0) {
        toolParams['assignees'] = [...params.assignees];
      }

      if (params.milestone !== undefined) {
        toolParams['milestone'] = params.milestone;
      }

      const result = await this.client.callTool({
        name: this.createIssueToolName,
        arguments: toolParams,
      });

      if (!result.content || !Array.isArray(result.content)) {
        return err(new Error('Invalid response from GitHub MCP tool'));
      }

      const textContent = result.content.find(
        (c): c is { type: 'text'; text: string } => c.type === 'text'
      );

      if (!textContent) {
        return err(new Error('No text content in GitHub MCP response'));
      }

      const issueData = JSON.parse(textContent.text);

      return ok({
        number: issueData.number,
        url: issueData.html_url ?? issueData.url,
        id: issueData.id,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to create GitHub issue: ${String(error)}`)
      );
    }
  }

  /**
   * Create a GitHub issue from an Asana task and analysis
   */
  async createIssueFromTask(
    task: AsanaTask,
    analysis: TaskAnalysis
  ): Promise<Result<GitHubIssueResult, Error>> {
    const body = this.buildIssueBody(task, analysis);
    const labels = this.buildLabels(analysis);

    return this.createIssue({
      title: task.name,
      body,
      labels,
    });
  }

  /**
   * Build the GitHub issue body from task and analysis
   */
  private buildIssueBody(task: AsanaTask, analysis: TaskAnalysis): string {
    const sections: string[] = [];

    // Summary section
    sections.push('## Summary');
    sections.push('');
    sections.push(analysis.summary || task.notes || 'No description provided.');
    sections.push('');

    // Context section
    sections.push('## Context');
    sections.push('');
    sections.push(`- **Type**: ${analysis.issueType}`);
    sections.push(`- **Priority**: ${analysis.priority}`);
    sections.push(`- **Component**: ${analysis.component || 'Unknown'}`);
    sections.push(`- **Confidence**: ${Math.round(analysis.confidence * 100)}%`);
    sections.push('');

    // Related files
    if (analysis.relatedFiles.length > 0) {
      sections.push('## Related Files');
      sections.push('');
      for (const file of analysis.relatedFiles) {
        sections.push(`- \`${file}\``);
      }
      sections.push('');
    }

    // Acceptance criteria
    if (analysis.acceptanceCriteria.length > 0) {
      sections.push('## Acceptance Criteria');
      sections.push('');
      for (const criterion of analysis.acceptanceCriteria) {
        sections.push(`- [ ] ${criterion}`);
      }
      sections.push('');
    }

    // Original task notes (if different from summary)
    if (task.notes && task.notes !== analysis.summary) {
      sections.push('## Original Description');
      sections.push('');
      sections.push('<details>');
      sections.push('<summary>Click to expand</summary>');
      sections.push('');
      sections.push(task.notes);
      sections.push('');
      sections.push('</details>');
      sections.push('');
    }

    // Source reference
    sections.push('---');
    sections.push('');
    sections.push(`> Source: [Asana Task](${task.permalinkUrl})`);

    return sections.join('\n');
  }

  /**
   * Build labels from analysis
   */
  private buildLabels(analysis: TaskAnalysis): string[] {
    const labels: string[] = ['auto-fix'];

    // Add type label
    labels.push(`type:${analysis.issueType}`);

    // Add priority label
    labels.push(`priority:${analysis.priority}`);

    // Add component label if present
    if (analysis.component) {
      labels.push(`component:${analysis.component.toLowerCase().replace(/\s+/g, '-')}`);
    }

    // Add suggested labels
    for (const label of analysis.labels) {
      if (!labels.includes(label)) {
        labels.push(label);
      }
    }

    return labels;
  }

  /**
   * Add a comment to an existing issue
   */
  async addComment(issueNumber: number, body: string): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: 'github_add_issue_comment',
        arguments: {
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          body,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to add comment to issue: ${String(error)}`)
      );
    }
  }

  /**
   * Update labels on an existing issue
   */
  async updateLabels(issueNumber: number, labels: readonly string[]): Promise<Result<void, Error>> {
    try {
      await this.client.callTool({
        name: 'github_update_issue',
        arguments: {
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          labels: [...labels],
        },
      });

      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to update issue labels: ${String(error)}`)
      );
    }
  }

  /**
   * Check if an issue already exists for a task
   */
  async findExistingIssue(asanaTaskGid: string): Promise<Result<GitHubIssueResult | null, Error>> {
    try {
      // Search for issues containing the Asana task GID
      const result = await this.client.callTool({
        name: 'github_search_issues',
        arguments: {
          q: `repo:${this.owner}/${this.repo} "${asanaTaskGid}" in:body is:issue`,
        },
      });

      if (!result.content || !Array.isArray(result.content)) {
        return ok(null);
      }

      const textContent = result.content.find(
        (c): c is { type: 'text'; text: string } => c.type === 'text'
      );

      if (!textContent) {
        return ok(null);
      }

      const searchResult = JSON.parse(textContent.text);

      if (searchResult.total_count > 0 && searchResult.items?.[0]) {
        const issue = searchResult.items[0];
        return ok({
          number: issue.number,
          url: issue.html_url,
          id: issue.id,
        });
      }

      return ok(null);
    } catch (error) {
      // If search fails, assume no existing issue
      return ok(null);
    }
  }
}

/**
 * Create a GitHubCreateTool instance
 */
export function createGitHubCreateTool(
  client: Client,
  owner: string,
  repo: string,
  createIssueToolName?: string
): GitHubCreateTool {
  return new GitHubCreateTool(client, owner, repo, createIssueToolName);
}
