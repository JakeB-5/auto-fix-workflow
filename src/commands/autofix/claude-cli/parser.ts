/**
 * @module commands/autofix/claude-cli/parser
 * @description Claude CLI response parsing utilities
 */

/**
 * Parse stream-json format and extract content in real-time
 *
 * @param chunk - Raw data chunk from Claude CLI stdout
 * @param onText - Callback for text content
 * @returns Accumulated final result text
 */
export function parseStreamJsonChunk(
  chunk: string,
  onText?: (text: string) => void
): string {
  let finalResult = '';
  const lines = chunk.split('\n').filter((line: string) => line.trim());

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      // Handle different event types from Claude CLI stream-json
      if (event.type === 'assistant' && event.message?.content) {
        // Assistant message with content blocks
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            onText?.(block.text);
            finalResult += block.text;
          }
        }
      } else if (event.type === 'content_block_delta' && event.delta?.text) {
        // Streaming text delta
        onText?.(event.delta.text);
        finalResult += event.delta.text;
      } else if (event.type === 'result' && event.result) {
        // Final result
        finalResult = event.result;
      }
    } catch {
      // Not valid JSON, ignore (might be partial line)
    }
  }

  return finalResult;
}

/**
 * Parse usage information from Claude CLI JSON output
 *
 * @param output - Raw output string containing JSON
 * @returns Parsed usage information or undefined
 */
export function parseUsageInfo(output: string): {
  inputTokens: number;
  outputTokens: number;
  cost: number;
} | undefined {
  try {
    const jsonMatch = output.match(/\{[\s\S]*"usage"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.usage) {
        return {
          inputTokens: parsed.usage.input_tokens ?? 0,
          outputTokens: parsed.usage.output_tokens ?? 0,
          cost: parsed.usage.cost_usd ?? 0,
        };
      }
    }
  } catch {
    // Ignore parse errors for usage info
  }
  return undefined;
}

/**
 * Extract JSON from Claude output that contains a specific key
 *
 * @param output - Raw output string
 * @param key - Key to search for in JSON
 * @returns Extracted JSON string or null
 */
export function extractJsonWithKey(output: string, key: string): string | null {
  // Build regex pattern to match JSON containing the key
  const pattern = new RegExp(`\\{[\\s\\S]*?"${key}"[\\s\\S]*?\\}`, 's');
  const match = output.match(pattern);
  return match ? match[0] : null;
}

/**
 * Extract result text from stream-json wrapped output
 *
 * When using --output-format json, the output is wrapped in a JSON object
 * with the actual response in the "result" field.
 *
 * @param output - Raw output string
 * @returns Unwrapped text content
 */
export function extractResultFromWrapper(output: string): string {
  // Try to extract the "result" field from JSON wrapper
  const wrapperMatch = output.match(
    /"result"\s*:\s*"([\s\S]*?)(?:","stop_reason|"\s*,\s*"stop_reason)/
  );

  if (wrapperMatch && wrapperMatch[1]) {
    // Unescape the JSON string
    return wrapperMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  return output;
}

/**
 * Parse analysis result JSON from Claude output
 *
 * @param output - Claude output string
 * @returns Parsed analysis result or null
 */
export function parseAnalysisResult(output: string): {
  confidence: number;
  rootCause: string;
  suggestedFix: string;
  affectedFiles: string[];
  complexity: 'low' | 'medium' | 'high';
} | null {
  try {
    const jsonMatch = output.match(/\{[\s\S]*?"confidence"[\s\S]*?\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      confidence: parsed.confidence,
      rootCause: parsed.rootCause,
      suggestedFix: parsed.suggestedFix,
      affectedFiles: parsed.affectedFiles,
      complexity: parsed.complexity,
    };
  } catch {
    return null;
  }
}

/**
 * Parse fix result JSON from Claude output
 *
 * @param output - Claude output string
 * @returns Parsed fix result or null
 */
export function parseFixResult(output: string): {
  success: boolean;
  summary: string;
  filesChanged: string[];
} | null {
  try {
    const jsonMatch = output.match(/\{[\s\S]*?"success"[\s\S]*?\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      success: parsed.success,
      summary: parsed.summary,
      filesChanged: parsed.filesChanged,
    };
  } catch {
    return null;
  }
}

/**
 * Parse task analysis result JSON from Claude output
 *
 * @param output - Claude output string
 * @returns Parsed task analysis or null
 */
export function parseTaskAnalysisResult(output: string): {
  issueType: string;
  priority: string;
  labels: string[];
  component: string;
  relatedFiles: string[];
  summary: string;
  acceptanceCriteria: string[];
  confidence: number;
} | null {
  // First, try to extract from wrapper
  const textToSearch = extractResultFromWrapper(output);

  try {
    // Find the issueType JSON within the text (may be in a code block)
    const jsonMatch = textToSearch.match(/\{[^{}]*"issueType"[^{}]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Try a more lenient pattern for nested objects
    const lenientMatch = textToSearch.match(
      /\{\s*"issueType"\s*:\s*"[^"]+?"[\s\S]*?"confidence"\s*:\s*[\d.]+\s*\}/
    );
    if (lenientMatch) {
      return JSON.parse(lenientMatch[0]);
    }
  } catch {
    // Parse error, return null
  }

  return null;
}
