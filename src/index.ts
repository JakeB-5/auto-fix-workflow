#!/usr/bin/env node
/**
 * @module auto-fix-workflow
 * @description Main entry point for the Auto-fix Workflow MCP Server
 */

// Re-export common types for external use
export * from './common/types/index.js';

// Re-export MCP server for programmatic use
export { createServer, startServer, getAllTools } from './mcp/index.js';

// CLI entry point
import { routeCommand } from './cli/router.js';

// Route CLI commands
const args = process.argv.slice(2);
routeCommand(args).catch((error: unknown) => {
  console.error('Command failed:', error);
  process.exit(1);
});
