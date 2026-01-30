/**
 * @module commands/init/types
 * @description Type definitions for init command
 */

/**
 * Init command options
 */
export interface InitOptions {
  /** Read tokens from environment variables instead of prompting */
  readonly nonInteractive: boolean;
  /** Overwrite existing configuration files */
  readonly force: boolean;
  /** Skip token validation steps */
  readonly skipValidation: boolean;
}

/**
 * Init command result
 */
export interface InitResult {
  /** Whether MCP config file was created/updated */
  readonly mcpConfigCreated: boolean;
  /** Whether YAML config file was created/updated */
  readonly yamlConfigCreated: boolean;
  /** Whether .gitignore was updated */
  readonly gitignoreUpdated: boolean;
  /** Token configuration status */
  readonly tokensConfigured: TokenConfigStatus;
}

/**
 * Token configuration status
 */
export interface TokenConfigStatus {
  /** Whether GitHub token was configured */
  readonly github: boolean;
  /** Whether Asana token was configured */
  readonly asana: boolean;
}

/**
 * Token configuration data
 */
export interface TokenConfig {
  /** GitHub personal access token */
  readonly github?: string;
  /** Asana personal access token */
  readonly asana?: string;
}

/**
 * Validation result for a token
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  readonly valid: boolean;
  /** Error message if validation failed */
  readonly error?: string;
  /** Additional information (e.g., username, permissions) */
  readonly info?: Record<string, unknown>;
}

/**
 * Init configuration
 */
export interface InitConfig {
  /** Default MCP config filename */
  readonly mcpConfigFile: string;
  /** Default YAML config filename */
  readonly yamlConfigFile: string;
  /** Template content for MCP config */
  readonly mcpTemplate: string;
  /** Template content for YAML config */
  readonly yamlTemplate: string;
  /** Entries to add to .gitignore */
  readonly gitignoreEntries: readonly string[];
  /** Environment variable names */
  readonly envVars: {
    readonly github: string;
    readonly asana: string;
  };
}

/**
 * Default init configuration
 */
export const DEFAULT_INIT_CONFIG: InitConfig = {
  mcpConfigFile: '.mcp.json',
  yamlConfigFile: 'auto-fix-workflow.yaml',
  mcpTemplate: JSON.stringify(
    {
      mcpServers: {
        'auto-fix-workflow': {
          command: 'node',
          args: ['./dist/index.js'],
          env: {
            GITHUB_TOKEN: '${GITHUB_TOKEN}',
            ASANA_TOKEN: '${ASANA_TOKEN}',
          },
        },
      },
    },
    null,
    2
  ),
  yamlTemplate: `# Auto-Fix Workflow Configuration

github:
  owner: your-org
  repo: your-repo
  defaultBranch: main

asana:
  workspace: your-workspace-gid
  defaultProject: your-project-gid

worktree:
  basePath: .worktrees
  prefix: autofix-

checks:
  enabled:
    - lint
    - test
    - typecheck
  parallel: true

logging:
  level: info
  format: json
`,
  gitignoreEntries: [
    '.mcp.json',
    'auto-fix-workflow.yaml',
    '.worktrees/',
    '.env',
  ],
  envVars: {
    github: 'GITHUB_TOKEN',
    asana: 'ASANA_TOKEN',
  },
};
