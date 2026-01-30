/**
 * @module commands/init/generators/mcp-config
 * @description MCP config (.mcp.json) generator for auto-fix-workflow
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { ok, err, type Result } from '../../../common/types/index.js';

/**
 * MCP config structure
 */
interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Generate MCP config object with empty env
 * (tokens are stored in .auto-fix.yaml)
 *
 * @returns MCP config object
 */
export function generateMcpConfig(): McpConfig {
  return {
    mcpServers: {
      'auto-fix-workflow': {
        command: 'npx',
        args: ['auto-fix-workflow'],
        env: {},
      },
    },
  };
}

/**
 * Read existing .mcp.json if it exists
 *
 * @param projectRoot - Project root directory
 * @returns Result containing config object or null if not exists
 */
export async function readExistingMcpConfig(
  projectRoot: string
): Promise<Result<object | null, Error>> {
  const configPath = join(projectRoot, '.mcp.json');

  try {
    // Check if file exists
    try {
      await fs.access(configPath);
    } catch {
      // File doesn't exist, return null
      return ok(null);
    }

    // Read and parse the file
    const content = await fs.readFile(configPath, 'utf-8');

    try {
      const parsed = JSON.parse(content);
      return ok(parsed);
    } catch (parseError) {
      return err(
        new Error(
          `Failed to parse existing .mcp.json: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        )
      );
    }
  } catch (readError) {
    return err(
      new Error(
        `Failed to read .mcp.json: ${readError instanceof Error ? readError.message : String(readError)}`
      )
    );
  }
}

/**
 * Merge new MCP config with existing config
 * Preserves other mcpServers entries
 *
 * @param existing - Existing config object or null
 * @param newConfig - New config to merge
 * @returns Merged config object
 */
export function mergeMcpConfig(
  existing: object | null,
  newConfig: McpConfig
): McpConfig {
  if (!existing || typeof existing !== 'object') {
    return newConfig;
  }

  const existingTyped = existing as Partial<McpConfig>;

  // If existing doesn't have mcpServers, just return new config
  if (!existingTyped.mcpServers || typeof existingTyped.mcpServers !== 'object') {
    return newConfig;
  }

  // Merge mcpServers, with new config taking precedence for 'auto-fix-workflow'
  return {
    mcpServers: {
      ...existingTyped.mcpServers,
      ...newConfig.mcpServers,
    },
  };
}

/**
 * Write .mcp.json to project root
 * Merges with existing config if present
 *
 * @param projectRoot - Project root directory
 * @returns Result indicating success or failure
 */
export async function writeMcpConfig(
  projectRoot: string
): Promise<Result<boolean, Error>> {
  const configPath = join(projectRoot, '.mcp.json');

  try {
    // Read existing config
    const existingResult = await readExistingMcpConfig(projectRoot);
    if (!existingResult.success) {
      return existingResult;
    }

    // Generate new config
    const newConfig = generateMcpConfig();

    // Merge with existing
    const mergedConfig = mergeMcpConfig(existingResult.data, newConfig);

    // Write to file with pretty formatting
    const content = JSON.stringify(mergedConfig, null, 2) + '\n';
    await fs.writeFile(configPath, content, 'utf-8');

    return ok(true);
  } catch (writeError) {
    return err(
      new Error(
        `Failed to write .mcp.json: ${writeError instanceof Error ? writeError.message : String(writeError)}`
      )
    );
  }
}

/**
 * Check if .mcp.json file exists
 *
 * @param projectRoot - Project root directory
 * @returns True if file exists
 */
export async function mcpConfigExists(projectRoot: string): Promise<boolean> {
  const configPath = join(projectRoot, '.mcp.json');

  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}
