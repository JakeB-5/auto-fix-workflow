/**
 * @module cli/router
 * @description CLI command routing and help display
 */

import { init } from '../commands/init/index.js';
import { startServer } from '../mcp/server.js';
import { isFailure } from '../common/types/index.js';

/**
 * Show CLI help message
 */
export function showHelp(): void {
  console.log(`
auto-fix-workflow - Automated GitHub Issue Fix Workflow

USAGE:
  npx auto-fix-workflow <command> [options]

COMMANDS:
  init              Initialize configuration files
  autofix           Run autofix workflow on GitHub issues
  triage            Triage Asana tasks and create GitHub issues
  help              Show this help message

MCP SERVER MODE:
  When run without a command (or via MCP client), starts as an MCP server
  providing tools for GitHub and Asana integration.

AVAILABLE MCP TOOLS:
  GitHub:
    - list_issues           List GitHub issues
    - get_github_issue      Get issue details
    - github_create_issue   Create a new issue
    - update_github_issue   Update an issue
    - github_create_pr      Create a pull request

  Asana:
    - asana_list_tasks      List Asana tasks
    - asana_get_task        Get task details
    - asana_update_task     Update a task
    - asana_analyze_task    Analyze task for triage

EXAMPLES:
  npx auto-fix-workflow init              # Initialize config
  npx auto-fix-workflow autofix           # Run autofix workflow
  npx auto-fix-workflow help              # Show this help

CONFIGURATION:
  Create .auto-fix.yaml in your project root with GitHub and Asana settings.
  Run 'npx auto-fix-workflow init' to create a template.

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN       GitHub personal access token
  ASANA_TOKEN        Asana personal access token
  AUTO_FIX_CONFIG    Path to config file (optional)

For more information, visit: https://github.com/your-org/auto-fix-workflow
`);
}

/**
 * Check if running in interactive TTY mode (not as MCP server)
 */
export function isInteractiveCLI(): boolean {
  // Check if stdin is a TTY (terminal) - if true, user is running directly
  // MCP clients pipe JSON-RPC through stdin, so isTTY will be false
  return process.stdin.isTTY === true;
}

/**
 * Route CLI commands
 */
export async function routeCommand(args: string[]): Promise<void> {
  const command = args[0];

  if (command === 'init') {
    // Run init command
    const result = await init(args.slice(1));
    if (isFailure(result)) {
      // Check if it's a help request (not an error)
      if (result.error.message === 'Help requested' || result.error.message === 'Version requested') {
        process.exit(0);
      }
      console.error('Init failed:', result.error.message);
      process.exit(1);
    }
    process.exit(0);
  } else if (command === 'help' || command === '--help' || command === '-h') {
    // Show help
    showHelp();
    process.exit(0);
  } else if (command === '--version' || command === '-v') {
    // Show version
    console.log('auto-fix-workflow v0.4.23');
    process.exit(0);
  } else if (command === 'autofix') {
    // Run autofix command
    const { main } = await import('../commands/autofix/index.js');
    await main(args.slice(1));
  } else if (command === 'triage') {
    // Run triage command in standalone mode
    const { main } = await import('../commands/triage/cli-entry.js');
    await main(args.slice(1));
  } else if (isInteractiveCLI() && !command) {
    // Running in terminal without command - show help instead of hanging
    console.log('auto-fix-workflow: Running in interactive mode without MCP client.\n');
    showHelp();
    console.log('\nTo start as MCP server, run via an MCP client (e.g., Claude Code).');
    process.exit(0);
  } else {
    // Run MCP server (default for non-TTY or unknown commands)
    await startServer();
  }
}
