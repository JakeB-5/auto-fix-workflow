/**
 * @module common/issue-parser/ast
 * @description Markdown AST parsing utilities using remark
 */

import type { Root, Content, Heading, Text, Code, InlineCode, List, ListItem } from 'mdast';
import type { Result } from '../types/index.js';
import { ok, err } from '../types/index.js';

// Re-export commonly used mdast types for convenience
export type { Root, Content, Heading, Text, Code, InlineCode, List, ListItem };

/**
 * Parse error structure for AST operations
 */
export interface AstParseError {
  readonly code: 'AST_PARSE_ERROR' | 'SECTION_NOT_FOUND' | 'INVALID_AST';
  readonly message: string;
  readonly cause?: unknown;
}

/**
 * Generic MDAST node type alias
 */
export type MdastNode = Root | Content;

/**
 * Section extraction result with heading and content nodes
 */
export interface SectionResult {
  readonly heading: Heading;
  readonly content: readonly Content[];
}

/**
 * Dynamically import remark for parsing
 */
async function getRemarkParser(): Promise<typeof import('remark')> {
  return import('remark');
}

/**
 * Parse markdown content into an MDAST Abstract Syntax Tree
 *
 * @param content - Raw markdown string
 * @returns Result containing the parsed AST Root or an error
 */
export async function parseMarkdownToAst(
  content: string
): Promise<Result<Root, AstParseError>> {
  try {
    const remark = await getRemarkParser();
    const processor = remark.remark();
    const ast = processor.parse(content);
    return ok(ast);
  } catch (cause) {
    return err({
      code: 'AST_PARSE_ERROR',
      message: `Failed to parse markdown: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    });
  }
}

/**
 * Synchronous version of parseMarkdownToAst for use when remark is already loaded
 * Note: Requires remark to be passed in to avoid async import
 */
export function parseMarkdownToAstSync(
  content: string,
  remarkInstance: { parse: (content: string) => Root }
): Result<Root, AstParseError> {
  try {
    const ast = remarkInstance.parse(content);
    return ok(ast);
  } catch (cause) {
    return err({
      code: 'AST_PARSE_ERROR',
      message: `Failed to parse markdown: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    });
  }
}

/**
 * Check if a node is a heading
 */
export function isHeading(node: MdastNode): node is Heading {
  return 'type' in node && node.type === 'heading';
}

/**
 * Check if a node is a text node
 */
export function isText(node: MdastNode): node is Text {
  return 'type' in node && node.type === 'text';
}

/**
 * Check if a node is a code block
 */
export function isCode(node: MdastNode): node is Code {
  return 'type' in node && node.type === 'code';
}

/**
 * Check if a node is an inline code
 */
export function isInlineCode(node: MdastNode): node is InlineCode {
  return 'type' in node && node.type === 'inlineCode';
}

/**
 * Check if a node is a list
 */
export function isList(node: MdastNode): node is List {
  return 'type' in node && node.type === 'list';
}

/**
 * Check if a node is a list item
 */
export function isListItem(node: MdastNode): node is ListItem {
  return 'type' in node && node.type === 'listItem';
}

/**
 * Extract text content from a node (recursively collects all text)
 */
export function extractText(node: MdastNode): string {
  if (isText(node)) {
    return node.value;
  }

  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as MdastNode[])
      .map((child) => extractText(child))
      .join('');
  }

  return '';
}

/**
 * Find a section by its heading text (case-insensitive)
 *
 * @param ast - The root AST node
 * @param heading - The heading text to search for
 * @returns Result containing the section or null if not found
 */
export function findSection(
  ast: Root,
  heading: string
): Result<SectionResult | null, AstParseError> {
  const normalizedTarget = heading.toLowerCase().trim();
  const children = ast.children;

  for (let i = 0; i < children.length; i++) {
    const node = children[i];

    if (node === undefined || !isHeading(node)) {
      continue;
    }

    const headingText = extractText(node).toLowerCase().trim();
    if (headingText !== normalizedTarget) {
      continue;
    }

    // Found the heading, now collect content until next heading of same or higher level
    const content: Content[] = [];
    const headingLevel = node.depth;

    for (let j = i + 1; j < children.length; j++) {
      const nextNode = children[j];

      if (nextNode === undefined) {
        continue;
      }

      // Stop at next heading of same or higher level
      if (isHeading(nextNode) && nextNode.depth <= headingLevel) {
        break;
      }

      content.push(nextNode);
    }

    return ok({
      heading: node,
      content,
    });
  }

  return ok(null);
}

/**
 * Find all sections matching a pattern
 *
 * @param ast - The root AST node
 * @param pattern - RegExp pattern to match heading text
 * @returns Array of matching sections
 */
export function findSectionsByPattern(
  ast: Root,
  pattern: RegExp
): SectionResult[] {
  const results: SectionResult[] = [];
  const children = ast.children;

  for (let i = 0; i < children.length; i++) {
    const node = children[i];

    if (node === undefined || !isHeading(node)) {
      continue;
    }

    const headingText = extractText(node);
    if (!pattern.test(headingText)) {
      continue;
    }

    // Collect content until next heading of same or higher level
    const content: Content[] = [];
    const headingLevel = node.depth;

    for (let j = i + 1; j < children.length; j++) {
      const nextNode = children[j];

      if (nextNode === undefined) {
        continue;
      }

      if (isHeading(nextNode) && nextNode.depth <= headingLevel) {
        break;
      }

      content.push(nextNode);
    }

    results.push({
      heading: node,
      content,
    });
  }

  return results;
}

/**
 * Extract all code blocks from an AST subtree
 */
export function extractCodeBlocks(nodes: readonly Content[]): Code[] {
  const codeBlocks: Code[] = [];

  function traverse(node: Content): void {
    if (isCode(node)) {
      codeBlocks.push(node);
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as Content);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return codeBlocks;
}

/**
 * Extract all list items as text from an AST subtree
 */
export function extractListItems(nodes: readonly Content[]): string[] {
  const items: string[] = [];

  function traverse(node: Content): void {
    if (isListItem(node)) {
      items.push(extractText(node).trim());
    } else if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as Content);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return items;
}

/**
 * Get the raw text content of a section
 */
export function getSectionText(section: SectionResult): string {
  return section.content.map((node) => extractText(node)).join('\n').trim();
}
