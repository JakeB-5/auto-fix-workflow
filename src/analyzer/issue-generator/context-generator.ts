/**
 * @module analyzer/issue-generator/context-generator
 * @description Generate Context section for GitHub Issues
 */

import type { CodeLocation } from '../code-locator/types.js';

/**
 * Context information for issue
 */
export interface ContextInfo {
  readonly component?: string | undefined;
  readonly priority?: string | undefined;
  readonly locations?: readonly CodeLocation[] | undefined;
  readonly files?: readonly string[] | undefined;
}

/**
 * Extract component name from file paths
 *
 * @param locations - Code locations
 * @returns Component name or undefined
 */
export function extractComponent(
  locations?: readonly CodeLocation[]
): string | undefined {
  if (!locations || locations.length === 0) {
    return undefined;
  }

  // Extract component from file path
  // Example: src/analyzer/code-locator/parser.ts -> analyzer/code-locator
  const firstLocation = locations[0];
  if (!firstLocation) {
    return undefined;
  }
  const filePath = firstLocation.filePath;
  const parts = filePath.split(/[/\\]/);

  // Find the component directory (usually after src/)
  const srcIndex = parts.findIndex((p) => p === 'src');
  if (srcIndex !== -1 && srcIndex + 2 < parts.length) {
    return `${parts[srcIndex + 1]}/${parts[srcIndex + 2]}`;
  }

  // Fallback: use first directory after src
  if (srcIndex !== -1 && srcIndex + 1 < parts.length) {
    return parts[srcIndex + 1];
  }

  return undefined;
}

/**
 * Generate context section content
 *
 * @param info - Context information
 * @returns Context section lines
 */
export function generateContextSection(info: ContextInfo): string[] {
  const lines: string[] = [];

  // Component
  const component = info.component || extractComponent(info.locations);
  if (component) {
    lines.push(`- **컴포넌트**: ${component}`);
  }

  // Priority
  if (info.priority) {
    lines.push(`- **우선순위**: ${info.priority}`);
  }

  // Primary file and location
  if (info.locations && info.locations.length > 0) {
    const primary = info.locations[0];
    if (primary) {
      lines.push(`- **파일**: \`${primary.filePath}\``);

      if (primary.functionName) {
        lines.push(`- **함수/메서드**: \`${primary.functionName}()\``);
      }

      if (primary.className) {
        lines.push(`- **클래스**: \`${primary.className}\``);
      }

      if (primary.lineNumber !== undefined) {
        lines.push(`- **라인**: ${primary.lineNumber}`);
      }

      // Additional related files
      if (info.locations.length > 1) {
        const additionalFiles = info.locations
          .slice(1, 4) // Limit to 3 additional files
          .map((loc) => `\`${loc.filePath}\``)
          .join(', ');
        lines.push(`- **관련 파일**: ${additionalFiles}`);
      }
    }
  } else if (info.files && info.files.length > 0) {
    // Fallback: just list files
    const fileList = info.files
      .slice(0, 4)
      .map((f) => `\`${f}\``)
      .join(', ');
    lines.push(`- **관련 파일**: ${fileList}`);
  }

  return lines;
}
