/**
 * @module commands/init/generators/yaml-config
 * @description .auto-fix.yaml generator for auto-fix-workflow
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { ok, err, type Result } from '../../../common/types/index.js';
import type { TokenConfig } from '../types.js';

/**
 * YAML config structure matching the spec
 */
interface YamlConfig {
  tokens: {
    github: string;
    asana: string;
  };
  github: {
    owner: string;
    repo: string;
    baseBranch: string;
    fixBranch: string;
    labels: {
      autoFix: string;
      skip: string;
      failed: string;
      processing: string;
    };
  };
  asana: {
    workspaceId: string;
    projectId: string;
    sections: {
      triage: string;
      needsInfo: string;
      triaged: string;
    };
    tags: {
      triaged: string;
      needsInfo: string;
      cannotReproduce: string;
      unclear: string;
      needsContext: string;
      skip: string;
    };
  };
  checks: {
    order: string[];
    timeout: number;
    failFast: boolean;
  };
  worktree: {
    basePath: string;
    maxParallel: number;
  };
}

/**
 * Generate .auto-fix.yaml config content with tokens
 *
 * @param tokens - Token configuration (github and/or asana)
 * @returns YAML config string
 */
export function generateYamlConfig(tokens: TokenConfig = {}): string {
  const config: YamlConfig = {
    tokens: {
      github: tokens.github || '<token or empty>',
      asana: tokens.asana || '<token or empty>',
    },
    github: {
      owner: '<TODO: GitHub 조직/사용자명>',
      repo: '<TODO: 저장소명>',
      baseBranch: 'main',
      fixBranch: 'autofixing',
      labels: {
        autoFix: 'auto-fix',
        skip: 'auto-fix-skip',
        failed: 'auto-fix-failed',
        processing: 'auto-fix-processing',
      },
    },
    asana: {
      workspaceId: '<TODO: Asana 워크스페이스 ID>',
      projectId: '<TODO: Asana 프로젝트 ID>',
      sections: {
        triage: 'To Triage',
        needsInfo: 'Needs More Info',
        triaged: 'Triaged',
      },
      tags: {
        triaged: 'triaged',
        needsInfo: 'needs-more-info',
        cannotReproduce: 'cannot-reproduce',
        unclear: 'unclear-requirement',
        needsContext: 'needs-context',
        skip: 'auto-fix-skip',
      },
    },
    checks: {
      order: ['typecheck', 'lint', 'test'],
      timeout: 300000,
      failFast: true,
    },
    worktree: {
      basePath: '.worktrees',
      maxParallel: 3,
    },
  };

  // Generate YAML with comment at the top
  const yamlContent = yamlStringify(config, {
    indent: 2,
    lineWidth: 0, // Disable line wrapping
  });

  return `# 인증 토큰 (이 파일은 .gitignore에 추가됨)\n${yamlContent}`;
}

/**
 * Write .auto-fix.yaml to project root
 *
 * @param projectRoot - Project root directory
 * @param tokens - Token configuration
 * @returns Result indicating success or failure
 */
export async function writeYamlConfig(
  projectRoot: string,
  tokens: TokenConfig = {}
): Promise<Result<boolean, Error>> {
  const configPath = join(projectRoot, '.auto-fix.yaml');

  try {
    const content = generateYamlConfig(tokens);
    await fs.writeFile(configPath, content, 'utf-8');

    return ok(true);
  } catch (writeError) {
    return err(
      new Error(
        `Failed to write .auto-fix.yaml: ${writeError instanceof Error ? writeError.message : String(writeError)}`
      )
    );
  }
}

/**
 * Check if .auto-fix.yaml file exists
 *
 * @param projectRoot - Project root directory
 * @returns True if file exists
 */
export async function yamlConfigExists(projectRoot: string): Promise<boolean> {
  const configPath = join(projectRoot, '.auto-fix.yaml');

  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}
