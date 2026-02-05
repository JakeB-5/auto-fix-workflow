/**
 * @module commands/autofix/mcp-tools/worktree
 * @description Git Worktree MCP tool
 */

import { z } from 'zod';
import type {
  WorktreeInfo,
  WorktreeStatus,
  CreateWorktreeParams,
  RemoveWorktreeParams,
} from '../../../common/types/index.js';
import type { Result } from '../../../common/types/result.js';
import { ok, err } from '../../../common/types/result.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Schema for worktree operations
 */
export const WorktreeOperationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    branchName: z.string(),
    baseBranch: z.string().optional().default('autofixing'),
    issueNumbers: z.array(z.number()),
  }),
  z.object({
    action: z.literal('cleanup'),
    path: z.string(),
    force: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal('list'),
  }),
  z.object({
    action: z.literal('status'),
    path: z.string(),
  }),
]);

export type WorktreeOperation = z.infer<typeof WorktreeOperationSchema>;

/**
 * Worktree tool error
 */
export interface WorktreeError {
  readonly code: WorktreeErrorCode;
  readonly message: string;
  readonly cause?: Error;
}

export type WorktreeErrorCode =
  | 'INVALID_OPERATION'
  | 'WORKTREE_EXISTS'
  | 'WORKTREE_NOT_FOUND'
  | 'BRANCH_EXISTS'
  | 'GIT_ERROR'
  | 'PATH_ERROR'
  | 'UNKNOWN';

/**
 * Worktree configuration
 */
export interface WorktreeConfig {
  readonly baseDir: string;
  readonly prefix: string;
  readonly repoPath: string;
}

/**
 * Git Worktree MCP Tool
 *
 * Manages git worktrees for parallel issue processing
 */
export class WorktreeTool {
  private readonly config: WorktreeConfig;

  constructor(config: WorktreeConfig) {
    this.config = config;
  }

  /**
   * Tool name for MCP registration
   */
  static readonly toolName = 'git_worktree';

  /**
   * Tool description
   */
  static readonly toolDescription = 'Manage git worktrees for parallel development';

  /**
   * Create a new worktree
   */
  async create(
    params: CreateWorktreeParams
  ): Promise<Result<WorktreeInfo, WorktreeError>> {
    try {
      const worktreePath = params.path ?? this.generateWorktreePath(params.branchName);
      const baseBranch = params.baseBranch ?? 'autofixing';

      // Ensure base directory exists
      await fs.mkdir(this.config.baseDir, { recursive: true });

      // Check if worktree already exists
      const existing = await this.getWorktreeByPath(worktreePath);
      if (existing) {
        return err({
          code: 'WORKTREE_EXISTS',
          message: `Worktree already exists at ${worktreePath}`,
        });
      }

      // Fetch latest from remote
      await this.execGit('fetch origin');

      // Check if branch already exists locally or remotely
      const branchExists = await this.branchExists(params.branchName);

      let createCmd: string;
      if (branchExists) {
        // If branch exists, check it out in the worktree instead of creating new
        // First, ensure it's not already checked out somewhere else
        try {
          // Delete the existing local branch (if it has no uncommitted work)
          await this.execGit(`branch -D ${params.branchName}`);
        } catch {
          // Branch might be checked out elsewhere or doesn't exist locally - that's ok
        }
        // Create worktree with new branch from base
        createCmd = `worktree add -b ${params.branchName} "${worktreePath}" origin/${baseBranch}`;
      } else {
        // Create the worktree with new branch
        createCmd = `worktree add -b ${params.branchName} "${worktreePath}" origin/${baseBranch}`;
      }

      await this.execGit(createCmd);

      const info: WorktreeInfo = {
        path: worktreePath,
        branch: params.branchName,
        status: 'ready',
        issueNumbers: params.issueNumbers,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      return ok(info);
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * Remove a worktree
   */
  async remove(
    params: RemoveWorktreeParams
  ): Promise<Result<void, WorktreeError>> {
    try {
      const forceFlag = params.force ? '--force' : '';

      // Remove the worktree
      await this.execGit(`worktree remove ${forceFlag} "${params.path}"`);

      // Optionally delete the branch
      if (params.deleteBranch !== false) {
        const worktree = await this.getWorktreeByPath(params.path);
        if (worktree?.branch && !['main', 'master', 'develop'].includes(worktree.branch)) {
          try {
            await this.execGit(`branch -D ${worktree.branch}`);
          } catch {
            // Branch might already be deleted
          }
        }
      }

      return ok(undefined);
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * List all worktrees
   */
  async list(): Promise<Result<WorktreeInfo[], WorktreeError>> {
    try {
      const { stdout } = await this.execGit('worktree list --porcelain');
      const worktrees = this.parseWorktreeList(stdout);
      return ok(worktrees);
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * Get worktree status
   */
  async getStatus(
    worktreePath: string
  ): Promise<Result<WorktreeInfo, WorktreeError>> {
    try {
      const worktrees = await this.list();
      if (!worktrees.success) {
        return worktrees;
      }

      const worktree = worktrees.data.find(w => w.path === worktreePath);
      if (!worktree) {
        return err({
          code: 'WORKTREE_NOT_FOUND',
          message: `Worktree not found at ${worktreePath}`,
        });
      }

      // Check for uncommitted changes
      const hasChanges = await this.hasUncommittedChanges(worktreePath);
      const status: WorktreeStatus = hasChanges ? 'in_use' : 'ready';

      return ok({
        ...worktree,
        status,
        lastActivityAt: new Date(),
      });
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * Execute git command in repo
   */
  private async execGit(command: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(`git ${command}`, {
      cwd: this.config.repoPath,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  /**
   * Execute git command in worktree
   */
  async execInWorktree(
    worktreePath: string,
    command: string
  ): Promise<Result<{ stdout: string; stderr: string }, WorktreeError>> {
    try {
      const result = await execAsync(`git ${command}`, {
        cwd: worktreePath,
        maxBuffer: 10 * 1024 * 1024,
      });
      return ok(result);
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * Check for uncommitted changes in worktree
   */
  private async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: worktreePath,
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get worktree by path
   */
  private async getWorktreeByPath(worktreePath: string): Promise<WorktreeInfo | null> {
    const result = await this.list();
    if (!result.success) {
      return null;
    }
    return result.data.find(w => w.path === worktreePath) ?? null;
  }

  /**
   * Check if branch exists locally or remotely
   */
  private async branchExists(branchName: string): Promise<boolean> {
    try {
      // Check local branches
      const { stdout: localBranches } = await this.execGit('branch --list');
      if (localBranches.includes(branchName)) {
        return true;
      }

      // Check remote branches
      const { stdout: remoteBranches } = await this.execGit('branch -r --list');
      if (remoteBranches.includes(`origin/${branchName}`)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generate worktree path from branch name
   */
  private generateWorktreePath(branchName: string): string {
    const sanitized = branchName
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-');
    return path.join(this.config.baseDir, `${this.config.prefix}${sanitized}`);
  }

  /**
   * Parse git worktree list output
   */
  private parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const blocks = output.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      let worktreePath = '';
      let branch = '';
      let headCommit = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktreePath = line.substring(9);
        } else if (line.startsWith('HEAD ')) {
          headCommit = line.substring(5);
        } else if (line.startsWith('branch ')) {
          branch = line.substring(7).replace('refs/heads/', '');
        }
      }

      if (worktreePath && branch) {
        worktrees.push({
          path: worktreePath,
          branch,
          status: 'ready',
          issueNumbers: [],
          createdAt: new Date(),
          lastActivityAt: new Date(),
          headCommit,
        });
      }
    }

    return worktrees;
  }

  /**
   * Map error to WorktreeError
   */
  private mapError(error: unknown): WorktreeError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('already exists')) {
        return { code: 'WORKTREE_EXISTS', message: error.message, cause: error };
      }
      if (message.includes('not a valid')) {
        return { code: 'WORKTREE_NOT_FOUND', message: error.message, cause: error };
      }
      if (message.includes('branch') && message.includes('exists')) {
        return { code: 'BRANCH_EXISTS', message: error.message, cause: error };
      }
      if (message.includes('fatal:') || message.includes('error:')) {
        return { code: 'GIT_ERROR', message: error.message, cause: error };
      }

      return { code: 'UNKNOWN', message: error.message, cause: error };
    }

    return { code: 'UNKNOWN', message: String(error) };
  }
}

/**
 * Create tool definition for MCP server
 */
export function createWorktreeTool(config: WorktreeConfig) {
  const tool = new WorktreeTool(config);

  return {
    name: WorktreeTool.toolName,
    description: WorktreeTool.toolDescription,
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'cleanup', 'list', 'status'],
          description: 'Worktree operation',
        },
        branchName: {
          type: 'string',
          description: 'Branch name (for create)',
        },
        baseBranch: {
          type: 'string',
          description: 'Base branch (for create)',
        },
        issueNumbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Issue numbers (for create)',
        },
        path: {
          type: 'string',
          description: 'Worktree path (for cleanup/status)',
        },
        force: {
          type: 'boolean',
          description: 'Force removal (for cleanup)',
        },
      },
      required: ['action'],
    },
    handler: async (params: WorktreeOperation) => {
      switch (params.action) {
        case 'create':
          return tool.create({
            branchName: params.branchName,
            baseBranch: params.baseBranch,
            issueNumbers: params.issueNumbers,
          });
        case 'cleanup':
          return tool.remove({
            path: params.path,
            force: params.force,
          });
        case 'list':
          return tool.list();
        case 'status':
          return tool.getStatus(params.path);
      }
    },
  };
}
