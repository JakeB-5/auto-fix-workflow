/**
 * @module commands/triage/mcp-tools/asana-list
 * @description MCP tool for listing Asana tasks
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Result } from '../../../common/types/index.js';
import { ok, err, isFailure } from '../../../common/types/index.js';
import type { AsanaTask, AsanaCustomField, AsanaMembership, AsanaTag } from '../types.js';

/**
 * Parameters for listing Asana tasks
 */
export interface ListAsanaTasksParams {
  /** Project GID */
  readonly projectGid: string;
  /** Section GID (optional, filters by section) */
  readonly sectionGid?: string;
  /** Only incomplete tasks */
  readonly completedSince?: string;
  /** Modified since (ISO date) */
  readonly modifiedSince?: string;
  /** Maximum results */
  readonly limit?: number;
  /** Fields to include */
  readonly optFields?: readonly string[];
}

/**
 * Default opt fields for task listing
 */
const DEFAULT_OPT_FIELDS = [
  'gid',
  'name',
  'notes',
  'permalink_url',
  'due_on',
  'due_at',
  'assignee.gid',
  'assignee.name',
  'assignee.email',
  'custom_fields.gid',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'custom_fields.enum_value',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'tags.gid',
  'tags.name',
  'memberships.project.gid',
  'memberships.project.name',
  'memberships.section.gid',
  'memberships.section.name',
  'created_at',
  'modified_at',
  'completed',
] as const;

/**
 * Asana MCP tool for listing tasks
 */
export class AsanaListTool {
  private readonly client: Client;
  private readonly toolName: string;

  constructor(client: Client, toolName = 'asana_list_tasks') {
    this.client = client;
    this.toolName = toolName;
  }

  /**
   * List tasks from an Asana project
   */
  async listTasks(params: ListAsanaTasksParams): Promise<Result<AsanaTask[], Error>> {
    try {
      const optFields = params.optFields ?? DEFAULT_OPT_FIELDS;

      const toolParams: Record<string, unknown> = {
        project: params.projectGid,
        opt_fields: optFields.join(','),
      };

      if (params.sectionGid) {
        toolParams.section = params.sectionGid;
      }

      if (params.completedSince) {
        toolParams.completed_since = params.completedSince;
      }

      if (params.modifiedSince) {
        toolParams.modified_since = params.modifiedSince;
      }

      if (params.limit) {
        toolParams.limit = params.limit;
      }

      const result = await this.client.callTool({
        name: this.toolName,
        arguments: toolParams,
      });

      if (!result.content || !Array.isArray(result.content)) {
        return err(new Error('Invalid response from Asana MCP tool'));
      }

      // Extract text content from result
      const textContent = result.content.find(
        (c): c is { type: 'text'; text: string } => c.type === 'text'
      );

      if (!textContent) {
        return err(new Error('No text content in Asana MCP response'));
      }

      const rawTasks = JSON.parse(textContent.text);
      const tasks = this.mapToAsanaTasks(rawTasks);

      return ok(tasks);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to list Asana tasks: ${String(error)}`)
      );
    }
  }

  /**
   * List tasks from a specific section
   */
  async listTasksInSection(
    projectGid: string,
    sectionGid: string,
    limit?: number
  ): Promise<Result<AsanaTask[], Error>> {
    return this.listTasks({
      projectGid,
      sectionGid,
      completedSince: 'now', // Only incomplete tasks
      limit,
    });
  }

  /**
   * Get sections for a project
   */
  async getSections(projectGid: string): Promise<Result<Array<{ gid: string; name: string }>, Error>> {
    try {
      const result = await this.client.callTool({
        name: 'asana_list_sections',
        arguments: {
          project: projectGid,
          opt_fields: 'gid,name',
        },
      });

      if (!result.content || !Array.isArray(result.content)) {
        return err(new Error('Invalid response from Asana MCP tool'));
      }

      const textContent = result.content.find(
        (c): c is { type: 'text'; text: string } => c.type === 'text'
      );

      if (!textContent) {
        return err(new Error('No text content in Asana MCP response'));
      }

      const sections = JSON.parse(textContent.text);
      return ok(sections);
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error(`Failed to get Asana sections: ${String(error)}`)
      );
    }
  }

  /**
   * Find section by name
   */
  async findSectionByName(
    projectGid: string,
    sectionName: string
  ): Promise<Result<{ gid: string; name: string } | null, Error>> {
    const sectionsResult = await this.getSections(projectGid);
    if (isFailure(sectionsResult)) {
      return err(sectionsResult.error);
    }

    const section = sectionsResult.data.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );

    return ok(section ?? null);
  }

  /**
   * Map raw Asana API response to typed AsanaTask objects
   */
  private mapToAsanaTasks(rawTasks: unknown[]): AsanaTask[] {
    return rawTasks.map((raw) => this.mapToAsanaTask(raw as Record<string, unknown>));
  }

  private mapToAsanaTask(raw: Record<string, unknown>): AsanaTask {
    return {
      gid: String(raw.gid ?? ''),
      name: String(raw.name ?? ''),
      notes: String(raw.notes ?? ''),
      permalinkUrl: String(raw.permalink_url ?? ''),
      dueOn: raw.due_on ? String(raw.due_on) : undefined,
      dueAt: raw.due_at ? String(raw.due_at) : undefined,
      assignee: raw.assignee ? this.mapAssignee(raw.assignee as Record<string, unknown>) : undefined,
      customFields: raw.custom_fields
        ? this.mapCustomFields(raw.custom_fields as unknown[])
        : undefined,
      tags: raw.tags ? this.mapTags(raw.tags as unknown[]) : undefined,
      memberships: raw.memberships
        ? this.mapMemberships(raw.memberships as unknown[])
        : undefined,
      createdAt: String(raw.created_at ?? new Date().toISOString()),
      modifiedAt: String(raw.modified_at ?? new Date().toISOString()),
      completed: Boolean(raw.completed),
    };
  }

  private mapAssignee(raw: Record<string, unknown>): AsanaTask['assignee'] {
    return {
      gid: String(raw.gid ?? ''),
      name: String(raw.name ?? ''),
      email: raw.email ? String(raw.email) : undefined,
    };
  }

  private mapCustomFields(raw: unknown[]): AsanaCustomField[] {
    return raw.map((field) => {
      const f = field as Record<string, unknown>;
      return {
        gid: String(f.gid ?? ''),
        name: String(f.name ?? ''),
        displayValue: f.display_value ? String(f.display_value) : undefined,
        type: (f.type as AsanaCustomField['type']) ?? 'text',
        enumValue: f.enum_value
          ? {
              gid: String((f.enum_value as Record<string, unknown>).gid ?? ''),
              name: String((f.enum_value as Record<string, unknown>).name ?? ''),
            }
          : undefined,
        textValue: f.text_value ? String(f.text_value) : undefined,
        numberValue: f.number_value !== undefined ? Number(f.number_value) : undefined,
      };
    });
  }

  private mapTags(raw: unknown[]): AsanaTag[] {
    return raw.map((tag) => {
      const t = tag as Record<string, unknown>;
      return {
        gid: String(t.gid ?? ''),
        name: String(t.name ?? ''),
      };
    });
  }

  private mapMemberships(raw: unknown[]): AsanaMembership[] {
    return raw.map((membership) => {
      const m = membership as Record<string, unknown>;
      const project = m.project as Record<string, unknown> | undefined;
      const section = m.section as Record<string, unknown> | undefined;
      return {
        project: {
          gid: String(project?.gid ?? ''),
          name: String(project?.name ?? ''),
        },
        section: section
          ? {
              gid: String(section.gid ?? ''),
              name: String(section.name ?? ''),
            }
          : undefined,
      };
    });
  }
}

/**
 * Create an AsanaListTool instance
 */
export function createAsanaListTool(client: Client, toolName?: string): AsanaListTool {
  return new AsanaListTool(client, toolName);
}
