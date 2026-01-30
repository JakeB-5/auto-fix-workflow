import * as readline from 'readline';

/**
 * Create a readline interface for user input
 */
export function createPromptInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Close the readline interface
 */
export function closePromptInterface(rl: readline.Interface): void {
  rl.close();
}

/**
 * Ask a question and return the user's answer
 */
export async function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Ask for a token with optional masking
 * Note: Masking is simplified - input is hidden on terminal
 */
export async function askToken(
  rl: readline.Interface,
  name: string
): Promise<string> {
  const question = `Enter ${name} (input hidden): `;

  return new Promise((resolve) => {
    // Cast to any to access private _writeToOutput
    const rlAny = rl as any;

    // Save the original _writeToOutput function
    const originalWriteToOutput = rlAny._writeToOutput;

    // Override to hide input
    rlAny._writeToOutput = function _writeToOutput(stringToWrite: string) {
      // Only show the question, hide the input
      if (stringToWrite.includes(question)) {
        rlAny.output.write(question);
      }
    };

    rl.question(question, (answer) => {
      // Restore original function
      rlAny._writeToOutput = originalWriteToOutput;

      // Add newline since input was hidden
      rlAny.output.write('\n');

      resolve(answer.trim());
    });
  });
}

/**
 * Ask a yes/no confirmation question
 * @param defaultYes - If true, default is yes when user presses enter
 */
export async function askConfirmation(
  rl: readline.Interface,
  message: string,
  defaultYes: boolean = false
): Promise<boolean> {
  const promptSuffix = defaultYes ? ' [Y/n]: ' : ' [y/N]: ';
  const answer = await askQuestion(rl, message + promptSuffix);

  // Empty answer uses default
  if (answer === '') {
    return defaultYes;
  }

  // Check for yes/no
  const normalized = answer.toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}
