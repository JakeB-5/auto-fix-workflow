/**
 * @module commands/init
 * @description Main entry point for init command
 */

import type { Result } from '../../common/types/index.js';
import { ok, err, isFailure } from '../../common/types/index.js';
import type { InitOptions, InitResult } from './types.js';
import { parseArgs, HelpRequestedError, VersionRequestedError } from './cli.js';

/**
 * Execute the init command
 *
 * @param args - Command line arguments
 * @returns Result containing initialization status
 */
export async function init(args: readonly string[]): Promise<Result<InitResult, Error>> {
  // Parse CLI arguments
  const parseResult = parseArgs(args);

  // Handle help/version requests
  if (isFailure(parseResult)) {
    const error = parseResult.error;
    if (error instanceof HelpRequestedError) {
      console.log(error.helpText);
      return err(error);
    }
    if (error instanceof VersionRequestedError) {
      console.log(error.version);
      return err(error);
    }
    return parseResult;
  }

  const options = parseResult.data;
  const projectRoot = process.cwd();

  // Import required modules (dynamic imports to ensure proper initialization)
  const {
    createPromptInterface,
    closePromptInterface,
    askToken,
    askConfirmation,
  } = await import('./prompts.js');
  const {
    writeMcpConfig,
    writeYamlConfig,
    ensureAutoFixYamlIgnored,
    yamlConfigExists,
  } = await import('./generators/index.js');
  const { validateToken } = await import('./validators.js');
  const {
    printCompletionMessage,
    printSkippedTokenWarning,
  } = await import('./output.js');

  // Track what was created/updated
  let mcpConfigCreated = false;
  let yamlConfigCreated = false;
  let gitignoreUpdated = false;
  let githubToken: string | undefined;
  let asanaToken: string | undefined;

  // Check for existing .auto-fix.yaml file
  const yamlExists = await yamlConfigExists(projectRoot);
  if (yamlExists && !options.force) {
    if (options.nonInteractive) {
      return err(
        new Error(
          '.auto-fix.yaml already exists. Use --force to overwrite or remove the file manually.'
        )
      );
    }

    // In interactive mode, ask for confirmation
    const rl = createPromptInterface();
    const shouldOverwrite = await askConfirmation(
      rl,
      '.auto-fix.yaml already exists. Overwrite?',
      false
    );
    closePromptInterface(rl);

    if (!shouldOverwrite) {
      console.log('Initialization cancelled.');
      return ok({
        mcpConfigCreated: false,
        yamlConfigCreated: false,
        gitignoreUpdated: false,
        tokensConfigured: {
          github: false,
          asana: false,
        },
      });
    }
  }

  // Get tokens based on mode
  if (options.nonInteractive) {
    // Non-interactive mode: read from environment variables
    githubToken = process.env.GITHUB_TOKEN;
    asanaToken = process.env.ASANA_TOKEN;

    if (!githubToken || !asanaToken) {
      return err(
        new Error(
          'GITHUB_TOKEN and ASANA_TOKEN environment variables must be set in non-interactive mode'
        )
      );
    }

    // Validate tokens if not skipping validation
    if (!options.skipValidation) {
      console.log('Validating tokens...');

      if (githubToken) {
        const githubResult = await validateToken('github', githubToken);
        if (isFailure(githubResult)) {
          return err(
            new Error(`GitHub token validation failed: ${githubResult.error.message}`)
          );
        }
        if (!githubResult.data.valid) {
          return err(
            new Error(
              `GitHub token validation failed: ${githubResult.data.error || 'Invalid token'}`
            )
          );
        }
        console.log(
          `✓ GitHub token validated${githubResult.data.username ? ` (${githubResult.data.username})` : ''}`
        );
      }

      if (asanaToken) {
        const asanaResult = await validateToken('asana', asanaToken);
        if (isFailure(asanaResult)) {
          return err(
            new Error(`Asana token validation failed: ${asanaResult.error.message}`)
          );
        }
        if (!asanaResult.data.valid) {
          return err(
            new Error(
              `Asana token validation failed: ${asanaResult.data.error || 'Invalid token'}`
            )
          );
        }
        console.log(
          `✓ Asana token validated${asanaResult.data.username ? ` (${asanaResult.data.username})` : ''}`
        );
      }
    }
  } else {
    // Interactive mode: prompt for tokens
    const rl = createPromptInterface();

    try {
      // Ask for GitHub token
      console.log('\n📝 Setting up GitHub integration');
      const githubInput = await askToken(rl, 'GitHub token');

      if (githubInput) {
        // Validate if not skipping
        if (!options.skipValidation) {
          console.log('Validating GitHub token...');
          const githubResult = await validateToken('github', githubInput);

          if (isFailure(githubResult)) {
            console.warn(
              `⚠️  Could not validate GitHub token: ${githubResult.error.message}`
            );
            console.warn('   Token will be saved anyway. Please verify it manually.');
          } else if (!githubResult.data.valid) {
            console.warn(
              `⚠️  GitHub token validation failed: ${githubResult.data.error || 'Invalid token'}`
            );
            console.warn('   Token will be saved anyway. Please verify it manually.');
          } else {
            console.log(
              `✓ GitHub token validated${githubResult.data.username ? ` (${githubResult.data.username})` : ''}`
            );
          }
        }
        githubToken = githubInput;
      } else {
        printSkippedTokenWarning('GitHub token');
      }

      // Ask for Asana token
      console.log('\n📝 Setting up Asana integration');
      const asanaInput = await askToken(rl, 'Asana token');

      if (asanaInput) {
        // Validate if not skipping
        if (!options.skipValidation) {
          console.log('Validating Asana token...');
          const asanaResult = await validateToken('asana', asanaInput);

          if (isFailure(asanaResult)) {
            console.warn(
              `⚠️  Could not validate Asana token: ${asanaResult.error.message}`
            );
            console.warn('   Token will be saved anyway. Please verify it manually.');
          } else if (!asanaResult.data.valid) {
            console.warn(
              `⚠️  Asana token validation failed: ${asanaResult.data.error || 'Invalid token'}`
            );
            console.warn('   Token will be saved anyway. Please verify it manually.');
          } else {
            console.log(
              `✓ Asana token validated${asanaResult.data.username ? ` (${asanaResult.data.username})` : ''}`
            );
          }
        }
        asanaToken = asanaInput;
      } else {
        printSkippedTokenWarning('Asana token');
      }
    } finally {
      closePromptInterface(rl);
    }
  }

  // Generate configuration files
  console.log('\n📝 Generating configuration files...');

  // Write .mcp.json (always merge with existing)
  const mcpResult = await writeMcpConfig(projectRoot);
  if (isFailure(mcpResult)) {
    return err(new Error(`Failed to write .mcp.json: ${mcpResult.error.message}`));
  }
  mcpConfigCreated = true;
  console.log('✓ .mcp.json created/updated');

  // Write .auto-fix.yaml with tokens
  const yamlResult = await writeYamlConfig(projectRoot, {
    github: githubToken,
    asana: asanaToken,
  });
  if (isFailure(yamlResult)) {
    return err(new Error(`Failed to write .auto-fix.yaml: ${yamlResult.error.message}`));
  }
  yamlConfigCreated = true;
  console.log('✓ .auto-fix.yaml created');

  // Update .gitignore
  const gitignoreResult = await ensureAutoFixYamlIgnored(projectRoot);
  if (isFailure(gitignoreResult)) {
    return err(
      new Error(`Failed to update .gitignore: ${gitignoreResult.error.message}`)
    );
  }
  gitignoreUpdated = true;
  console.log('✓ .gitignore updated');

  // Print completion message
  printCompletionMessage({
    filesCreated: yamlConfigCreated
      ? ['.auto-fix.yaml', '.mcp.json']
      : ['.mcp.json'],
    filesUpdated: gitignoreUpdated ? ['.gitignore'] : [],
    filesSkipped: [],
    tokensMissing: [
      ...(!githubToken ? ['GitHub token'] : []),
      ...(!asanaToken ? ['Asana token'] : []),
    ],
    tokensProvided: [
      ...(githubToken ? ['GitHub token'] : []),
      ...(asanaToken ? ['Asana token'] : []),
    ],
  });

  return ok({
    mcpConfigCreated,
    yamlConfigCreated,
    gitignoreUpdated,
    tokensConfigured: {
      github: !!githubToken,
      asana: !!asanaToken,
    },
  });
}

/**
 * Export types and utilities
 */
export type { InitOptions, InitResult } from './types.js';
export { parseArgs, getHelpMessage, formatOptions, HelpRequestedError, VersionRequestedError } from './cli.js';
export type { ValidationResult } from './validators.js';
export {
  validateGitHubToken,
  validateAsanaToken,
  validateGitHubTokenFormat,
  validateAsanaTokenFormat,
  validateToken,
} from './validators.js';
