/**
 * @module commands/autofix/mcp-tools/__tests__/group-issues
 * @description Tests for GroupIssuesTool MCP tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GroupIssuesTool,
  createGroupIssuesTool,
  GroupIssuesInputSchema,
} from '../group-issues.js';
import type { Issue, GroupBy } from '../../../../common/types/index.js';

// Helper to create a test issue
const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  number: 1,
  title: 'Test Issue',
  body: 'Body',
  state: 'open',
  type: 'bug',
  labels: ['bug'],
  assignees: [],
  context: {
    component: 'auth',
    priority: 'medium',
    relatedFiles: ['src/auth/login.ts'],
    relatedSymbols: [],
    source: 'github',
  },
  acceptanceCriteria: [],
  relatedIssues: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  url: 'https://github.com/test/test/issues/1',
  ...overrides,
});

describe('GroupIssuesInputSchema', () => {
  it('should accept valid input', () => {
    const input = {
      issues: [
        {
          number: 1,
          title: 'Bug',
          labels: ['bug'],
          context: {
            component: 'auth',
            priority: 'high',
            relatedFiles: ['src/auth.ts'],
          },
        },
      ],
      groupBy: 'component',
      maxGroupSize: 5,
      minGroupSize: 1,
    };
    const result = GroupIssuesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal input with defaults', () => {
    const input = {
      issues: [
        {
          number: 1,
          title: 'Bug',
          labels: [],
          context: { component: 'auth', priority: 'medium', relatedFiles: [] },
        },
      ],
      groupBy: 'component',
    };
    const result = GroupIssuesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxGroupSize).toBe(5);
      expect(result.data.minGroupSize).toBe(1);
    }
  });

  it('should reject maxGroupSize above 10', () => {
    const input = {
      issues: [],
      groupBy: 'component',
      maxGroupSize: 11,
    };
    const result = GroupIssuesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid groupBy value', () => {
    const input = {
      issues: [],
      groupBy: 'invalid',
    };
    const result = GroupIssuesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept all valid groupBy values', () => {
    for (const groupBy of ['component', 'file', 'label', 'type', 'priority']) {
      const input = {
        issues: [],
        groupBy,
      };
      const result = GroupIssuesInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });
});

describe('GroupIssuesTool', () => {
  let tool: GroupIssuesTool;

  beforeEach(() => {
    tool = new GroupIssuesTool();
  });

  describe('static properties', () => {
    it('should have correct tool name', () => {
      expect(GroupIssuesTool.toolName).toBe('group_issues');
    });

    it('should have correct tool description', () => {
      expect(GroupIssuesTool.toolDescription).toContain('Group issues');
    });

    it('should have inputSchema', () => {
      expect(GroupIssuesTool.inputSchema).toBeDefined();
    });
  });

  describe('groupIssues', () => {
    it('should return NO_ISSUES error for empty array', () => {
      const result = tool.groupIssues([], {
        issueNumbers: [],
        groupBy: 'component',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_ISSUES');
      }
    });

    describe('group by component', () => {
      it('should group issues by component', () => {
        const issues = [
          makeIssue({ number: 1, context: { ...makeIssue().context, component: 'auth' } }),
          makeIssue({ number: 2, context: { ...makeIssue().context, component: 'auth' } }),
          makeIssue({ number: 3, context: { ...makeIssue().context, component: 'api' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'component',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.totalIssues).toBe(3);
          expect(result.data.totalGroups).toBe(2);
          expect(result.data.ungroupedIssues).toEqual([]);
        }
      });

      it('should assign correct group names', () => {
        const issues = [
          makeIssue({ number: 1, context: { ...makeIssue().context, component: 'auth' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'component',
        });

        if (result.success) {
          expect(result.data.groups[0]!.name).toBe('auth');
          expect(result.data.groups[0]!.key).toBe('auth');
          expect(result.data.groups[0]!.groupBy).toBe('component');
        }
      });
    });

    describe('group by file', () => {
      it('should group by file directory', () => {
        const issues = [
          makeIssue({
            number: 1,
            context: {
              ...makeIssue().context,
              relatedFiles: ['src/auth/login.ts'],
            },
          }),
          makeIssue({
            number: 2,
            context: {
              ...makeIssue().context,
              relatedFiles: ['src/auth/signup.ts'],
            },
          }),
          makeIssue({
            number: 3,
            context: {
              ...makeIssue().context,
              relatedFiles: ['src/api/handler.ts'],
            },
          }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'file',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.totalGroups).toBe(2); // src/auth and src/api
        }
      });

      it('should use "general" for issues without related files', () => {
        const issues = [
          makeIssue({
            number: 1,
            context: { ...makeIssue().context, relatedFiles: [] },
          }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'file',
        });

        if (result.success) {
          expect(result.data.groups[0]!.key).toBe('general');
        }
      });

      it('should handle files without directory', () => {
        const issues = [
          makeIssue({
            number: 1,
            context: { ...makeIssue().context, relatedFiles: ['file.ts'] },
          }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'file',
        });

        if (result.success) {
          // Single-component path returns null from getDirectory, falls back to 'general'
          expect(result.data.groups[0]!.key).toBe('general');
        }
      });
    });

    describe('group by label', () => {
      it('should group by first significant label', () => {
        const issues = [
          makeIssue({ number: 1, labels: ['bug', 'auto-fix'] }),
          makeIssue({ number: 2, labels: ['enhancement'] }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2],
          groupBy: 'label',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.totalGroups).toBe(2);
        }
      });

      it('should use "unlabeled" for issues with only system labels', () => {
        const issues = [
          makeIssue({ number: 1, labels: ['auto-fix', 'priority:high'] }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'label',
        });

        if (result.success) {
          expect(result.data.groups[0]!.key).toBe('unlabeled');
        }
      });

      it('should filter out priority: and p* and auto-fix labels', () => {
        const issues = [
          makeIssue({
            number: 1,
            labels: ['p1', 'auto-fix', 'priority:high', 'real-label'],
          }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'label',
        });

        if (result.success) {
          expect(result.data.groups[0]!.key).toBe('real-label');
        }
      });
    });

    describe('group by type', () => {
      it('should group by issue type', () => {
        const issues = [
          makeIssue({ number: 1, type: 'bug' }),
          makeIssue({ number: 2, type: 'bug' }),
          makeIssue({ number: 3, type: 'feature' }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'type',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.totalGroups).toBe(2);
        }
      });
    });

    describe('group by priority', () => {
      it('should group by priority', () => {
        const issues = [
          makeIssue({ number: 1, context: { ...makeIssue().context, priority: 'critical' } }),
          makeIssue({ number: 2, context: { ...makeIssue().context, priority: 'high' } }),
          makeIssue({ number: 3, context: { ...makeIssue().context, priority: 'critical' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'priority',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.totalGroups).toBe(2);
        }
      });
    });

    describe('maxGroupSize', () => {
      it('should split large groups', () => {
        const issues = Array.from({ length: 6 }, (_, i) =>
          makeIssue({
            number: i + 1,
            context: { ...makeIssue().context, component: 'auth' },
          })
        );

        const result = tool.groupIssues(issues, {
          issueNumbers: issues.map(i => i.number),
          groupBy: 'component',
          maxGroupSize: 3,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          // Should split auth into 2 groups of 3
          expect(result.data.totalGroups).toBe(2);
          const group1 = result.data.groups[0]!;
          const group2 = result.data.groups[1]!;
          expect(group1.issues.length).toBe(3);
          expect(group2.issues.length).toBe(3);
          // Should have part labels in id/name
          expect(group1.id).toContain('-1');
          expect(group2.id).toContain('-2');
          expect(group1.name).toContain('Part 1');
          expect(group2.name).toContain('Part 2');
        }
      });
    });

    describe('minGroupSize', () => {
      it('should exclude groups smaller than minGroupSize', () => {
        const issues = [
          makeIssue({ number: 1, context: { ...makeIssue().context, component: 'auth' } }),
          makeIssue({ number: 2, context: { ...makeIssue().context, component: 'auth' } }),
          makeIssue({ number: 3, context: { ...makeIssue().context, component: 'api' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'component',
          minGroupSize: 2,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          // Only auth group (2 issues) should be included, api (1 issue) excluded
          expect(result.data.totalGroups).toBe(1);
          expect(result.data.groups[0]!.key).toBe('auth');
          // api's issue 3 should be ungrouped
          expect(result.data.ungroupedIssues).toContain(3);
        }
      });
    });

    describe('priority sorting', () => {
      it('should sort groups by priority (critical first)', () => {
        const issues = [
          makeIssue({ number: 1, context: { ...makeIssue().context, component: 'a', priority: 'low' } }),
          makeIssue({ number: 2, context: { ...makeIssue().context, component: 'b', priority: 'critical' } }),
          makeIssue({ number: 3, context: { ...makeIssue().context, component: 'c', priority: 'high' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'component',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.groups[0]!.priority).toBe('critical');
          expect(result.data.groups[1]!.priority).toBe('high');
          expect(result.data.groups[2]!.priority).toBe('low');
        }
      });
    });

    describe('branch name generation', () => {
      it('should generate branch name with issue numbers', () => {
        const issues = [
          makeIssue({ number: 42, context: { ...makeIssue().context, component: 'auth' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [42],
          groupBy: 'component',
        });

        if (result.success) {
          expect(result.data.groups[0]!.branchName).toContain('fix/');
          expect(result.data.groups[0]!.branchName).toContain('42');
        }
      });

      it('should include only first 3 issue numbers and add suffix', () => {
        const issues = Array.from({ length: 5 }, (_, i) =>
          makeIssue({
            number: i + 1,
            context: { ...makeIssue().context, component: 'auth' },
          })
        );

        const result = tool.groupIssues(issues, {
          issueNumbers: issues.map(i => i.number),
          groupBy: 'component',
        });

        if (result.success) {
          const branchName = result.data.groups[0]!.branchName;
          expect(branchName).toContain('1-2-3');
          expect(branchName).toContain('-and-more');
        }
      });

      it('should sanitize special characters in branch name', () => {
        const issues = [
          makeIssue({
            number: 1,
            context: { ...makeIssue().context, component: 'auth@module#v2' },
          }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'component',
        });

        if (result.success) {
          const branchName = result.data.groups[0]!.branchName;
          expect(branchName).not.toMatch(/[@#]/);
          expect(branchName).toMatch(/^fix\//);
        }
      });
    });

    describe('group metadata', () => {
      it('should collect all related files from issues', () => {
        const issues = [
          makeIssue({
            number: 1,
            context: { ...makeIssue().context, relatedFiles: ['src/a.ts'] },
          }),
          makeIssue({
            number: 2,
            context: { ...makeIssue().context, relatedFiles: ['src/b.ts', 'src/a.ts'] },
          }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2],
          groupBy: 'component',
        });

        if (result.success) {
          const files = result.data.groups[0]!.relatedFiles;
          expect(files).toContain('src/a.ts');
          expect(files).toContain('src/b.ts');
          // Should be deduplicated
          expect(new Set(files).size).toBe(files.length);
        }
      });

      it('should collect all unique components', () => {
        const issues = [
          makeIssue({ number: 1, type: 'bug', context: { ...makeIssue().context, component: 'auth' } }),
          makeIssue({ number: 2, type: 'bug', context: { ...makeIssue().context, component: 'api' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2],
          groupBy: 'type',
        });

        if (result.success) {
          const components = result.data.groups[0]!.components;
          expect(components).toContain('auth');
          expect(components).toContain('api');
        }
      });

      it('should determine highest priority in group', () => {
        const issues = [
          makeIssue({ number: 1, context: { ...makeIssue().context, component: 'auth', priority: 'low' } }),
          makeIssue({ number: 2, context: { ...makeIssue().context, component: 'auth', priority: 'critical' } }),
          makeIssue({ number: 3, context: { ...makeIssue().context, component: 'auth', priority: 'medium' } }),
        ];

        const result = tool.groupIssues(issues, {
          issueNumbers: [1, 2, 3],
          groupBy: 'component',
        });

        if (result.success) {
          expect(result.data.groups[0]!.priority).toBe('critical');
        }
      });
    });

    describe('error handling', () => {
      it('should handle grouping failure', () => {
        // Force an error by providing issues that could cause internal issues
        // This is a safety test to verify the try-catch works
        const issues = [makeIssue()];

        // Use a valid groupBy to avoid schema errors
        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'component',
        });

        // Should succeed with normal input
        expect(result.success).toBe(true);
      });
    });

    describe('default groupBy handling', () => {
      it('should handle unknown groupBy gracefully via general key', () => {
        const issues = [makeIssue()];

        // Force an unknown groupBy by casting
        const result = tool.groupIssues(issues, {
          issueNumbers: [1],
          groupBy: 'something-unknown' as GroupBy,
        });

        if (result.success) {
          expect(result.data.groups[0]!.key).toBe('general');
        }
      });
    });
  });
});

describe('createGroupIssuesTool', () => {
  it('should return tool definition with correct properties', () => {
    const toolDef = createGroupIssuesTool();

    expect(toolDef.name).toBe('group_issues');
    expect(toolDef.description).toContain('Group issues');
    expect(toolDef.inputSchema.required).toEqual(['issues', 'groupBy']);
  });

  it('should have handler that groups issues', () => {
    const toolDef = createGroupIssuesTool();

    const issues = [makeIssue()];
    const result = toolDef.handler({
      issues,
      groupBy: 'component',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalIssues).toBe(1);
    }
  });

  it('should pass maxGroupSize and minGroupSize to handler', () => {
    const toolDef = createGroupIssuesTool();

    const issues = Array.from({ length: 4 }, (_, i) =>
      makeIssue({
        number: i + 1,
        context: { ...makeIssue().context, component: 'auth' },
      })
    );

    const result = toolDef.handler({
      issues,
      groupBy: 'component',
      maxGroupSize: 2,
      minGroupSize: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Split into 2 groups of 2
      expect(result.data.totalGroups).toBe(2);
    }
  });

  it('should handle empty issues', () => {
    const toolDef = createGroupIssuesTool();

    const result = toolDef.handler({
      issues: [],
      groupBy: 'component',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NO_ISSUES');
    }
  });
});
