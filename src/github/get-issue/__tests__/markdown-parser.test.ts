/**
 * @module github/get-issue/__tests__/markdown-parser
 * @description Unit tests for markdown parsing utilities
 */

import { describe, it, expect } from 'vitest';
import {
  extractCodeBlocks,
  extractLinks,
  extractIssueReferences,
  extractTaskList,
  extractHeaders,
} from '../markdown-parser.js';

describe('markdown-parser', () => {
  describe('extractCodeBlocks', () => {
    it('should extract code block with language', () => {
      const markdown = '```typescript\nconst x = 1;\n```';

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('typescript');
      expect(blocks[0].content).toBe('const x = 1;');
    });

    it('should extract code block without language', () => {
      const markdown = '```\nplain text\n```';

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('text');
      expect(blocks[0].content).toBe('plain text');
    });

    it('should extract multiple code blocks', () => {
      const markdown = `
\`\`\`javascript
const x = 1;
\`\`\`

Some text

\`\`\`python
x = 1
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].content).toBe('const x = 1;');
      expect(blocks[1].language).toBe('python');
      expect(blocks[1].content).toBe('x = 1');
    });

    it('should trim whitespace from content', () => {
      const markdown = '```js\n  const x = 1;  \n\n```';

      const blocks = extractCodeBlocks(markdown);

      expect(blocks[0].content).toBe('const x = 1;');
    });

    it('should handle multi-line code blocks', () => {
      const markdown = `\`\`\`typescript
function hello() {
  console.log('Hello');
  return true;
}
\`\`\``;

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe(`function hello() {
  console.log('Hello');
  return true;
}`);
    });

    it('should handle empty code blocks', () => {
      const markdown = '```js\n\n```';

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe('');
    });

    it('should return empty array for no code blocks', () => {
      const markdown = 'Just plain text without code blocks';

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toEqual([]);
    });

    it('should handle various language identifiers', () => {
      const markdown = `
\`\`\`ts
typescript
\`\`\`
\`\`\`js
javascript
\`\`\`
\`\`\`py
python
\`\`\`
\`\`\`go
golang
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toHaveLength(4);
      expect(blocks[0].language).toBe('ts');
      expect(blocks[1].language).toBe('js');
      expect(blocks[2].language).toBe('py');
      expect(blocks[3].language).toBe('go');
    });

    it('should ignore incomplete code blocks', () => {
      const markdown = '```javascript\nconst x = 1;';

      const blocks = extractCodeBlocks(markdown);

      expect(blocks).toEqual([]);
    });
  });

  describe('extractLinks', () => {
    it('should extract markdown link', () => {
      const markdown = '[Example](https://example.com)';

      const links = extractLinks(markdown);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe('Example');
      expect(links[0].url).toBe('https://example.com');
    });

    it('should extract multiple links', () => {
      const markdown = '[Link 1](https://one.com) and [Link 2](https://two.com)';

      const links = extractLinks(markdown);

      expect(links).toHaveLength(2);
      expect(links[0].text).toBe('Link 1');
      expect(links[0].url).toBe('https://one.com');
      expect(links[1].text).toBe('Link 2');
      expect(links[1].url).toBe('https://two.com');
    });

    it('should handle link text with spaces', () => {
      const markdown = '[Click Here Now](https://example.com)';

      const links = extractLinks(markdown);

      expect(links[0].text).toBe('Click Here Now');
    });

    it('should handle URLs with paths', () => {
      const markdown = '[API](https://api.example.com/v1/users)';

      const links = extractLinks(markdown);

      expect(links[0].url).toBe('https://api.example.com/v1/users');
    });

    it('should handle URLs with query parameters', () => {
      const markdown = '[Search](https://example.com?q=test&page=1)';

      const links = extractLinks(markdown);

      expect(links[0].url).toBe('https://example.com?q=test&page=1');
    });

    it('should return empty array for no links', () => {
      const markdown = 'Plain text without links';

      const links = extractLinks(markdown);

      expect(links).toEqual([]);
    });

    it('should handle relative URLs', () => {
      const markdown = '[Docs](/docs/readme)';

      const links = extractLinks(markdown);

      expect(links[0].url).toBe('/docs/readme');
    });

    it('should handle anchor links', () => {
      const markdown = '[Section](#section-1)';

      const links = extractLinks(markdown);

      expect(links[0].url).toBe('#section-1');
    });
  });

  describe('extractIssueReferences', () => {
    it('should extract single issue reference', () => {
      const markdown = 'See #123';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123]);
    });

    it('should extract multiple issue references', () => {
      const markdown = 'Fixes #123 and #456, related to #789';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123, 456, 789]);
    });

    it('should deduplicate issue references', () => {
      const markdown = 'Issue #123 is related to #123';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123]);
    });

    it('should sort issue references', () => {
      const markdown = 'Issues #789, #123, #456';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123, 456, 789]);
    });

    it('should return empty array for no references', () => {
      const markdown = 'No issue references here';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([]);
    });

    it('should ignore invalid issue numbers', () => {
      const markdown = 'Check #abc and #123';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123]);
    });

    it('should handle issue references at start', () => {
      const markdown = '#123 is the main issue';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123]);
    });

    it('should handle issue references at end', () => {
      const markdown = 'Main issue is #123';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([123]);
    });

    it('should handle multi-digit issue numbers', () => {
      const markdown = 'Issue #12345678';

      const refs = extractIssueReferences(markdown);

      expect(refs).toEqual([12345678]);
    });
  });

  describe('extractTaskList', () => {
    it('should extract completed task', () => {
      const markdown = '- [x] Completed task';

      const tasks = extractTaskList(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Completed task');
      expect(tasks[0].completed).toBe(true);
    });

    it('should extract incomplete task', () => {
      const markdown = '- [ ] Incomplete task';

      const tasks = extractTaskList(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Incomplete task');
      expect(tasks[0].completed).toBe(false);
    });

    it('should handle uppercase X', () => {
      const markdown = '- [X] Completed with uppercase';

      const tasks = extractTaskList(markdown);

      expect(tasks[0].completed).toBe(true);
    });

    it('should extract multiple tasks', () => {
      const markdown = `
- [x] Task 1
- [ ] Task 2
- [X] Task 3
      `;

      const tasks = extractTaskList(markdown);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].text).toBe('Task 1');
      expect(tasks[0].completed).toBe(true);
      expect(tasks[1].text).toBe('Task 2');
      expect(tasks[1].completed).toBe(false);
      expect(tasks[2].text).toBe('Task 3');
      expect(tasks[2].completed).toBe(true);
    });

    it('should handle asterisk list marker', () => {
      const markdown = '* [x] Task with asterisk';

      const tasks = extractTaskList(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Task with asterisk');
    });

    it('should trim task text', () => {
      const markdown = '- [x]   Task with spaces   ';

      const tasks = extractTaskList(markdown);

      expect(tasks[0].text).toBe('Task with spaces');
    });

    it('should return empty array for no tasks', () => {
      const markdown = 'Plain text without tasks';

      const tasks = extractTaskList(markdown);

      expect(tasks).toEqual([]);
    });

    it('should handle tasks with long text', () => {
      const markdown = '- [x] This is a very long task description that spans multiple words';

      const tasks = extractTaskList(markdown);

      expect(tasks[0].text).toBe('This is a very long task description that spans multiple words');
    });

    it('should ignore regular list items', () => {
      const markdown = `
- Regular item
- [ ] Task item
- Another item
      `;

      const tasks = extractTaskList(markdown);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Task item');
    });
  });

  describe('extractHeaders', () => {
    it('should extract h1 header', () => {
      const markdown = '# Title';

      const headers = extractHeaders(markdown);

      expect(headers).toHaveLength(1);
      expect(headers[0].level).toBe(1);
      expect(headers[0].text).toBe('Title');
    });

    it('should extract h2 header', () => {
      const markdown = '## Subtitle';

      const headers = extractHeaders(markdown);

      expect(headers).toHaveLength(1);
      expect(headers[0].level).toBe(2);
      expect(headers[0].text).toBe('Subtitle');
    });

    it('should extract multiple header levels', () => {
      const markdown = `
# H1
## H2
### H3
#### H4
##### H5
###### H6
      `;

      const headers = extractHeaders(markdown);

      expect(headers).toHaveLength(6);
      expect(headers[0].level).toBe(1);
      expect(headers[1].level).toBe(2);
      expect(headers[2].level).toBe(3);
      expect(headers[3].level).toBe(4);
      expect(headers[4].level).toBe(5);
      expect(headers[5].level).toBe(6);
    });

    it('should trim header text', () => {
      const markdown = '##   Subtitle with spaces   ';

      const headers = extractHeaders(markdown);

      expect(headers[0].text).toBe('Subtitle with spaces');
    });

    it('should return empty array for no headers', () => {
      const markdown = 'Plain text without headers';

      const headers = extractHeaders(markdown);

      expect(headers).toEqual([]);
    });

    it('should handle headers with special characters', () => {
      const markdown = '# Title with `code` and **bold**';

      const headers = extractHeaders(markdown);

      expect(headers[0].text).toBe('Title with `code` and **bold**');
    });

    it('should handle headers at start of line only', () => {
      const markdown = 'Text # Not a header\n# Real header';

      const headers = extractHeaders(markdown);

      expect(headers).toHaveLength(1);
      expect(headers[0].text).toBe('Real header');
    });

    it('should ignore more than 6 hashes', () => {
      const markdown = '####### Too many hashes';

      const headers = extractHeaders(markdown);

      expect(headers).toEqual([]);
    });

    it('should handle mixed content', () => {
      const markdown = `
# Title

Some content

## Section 1

More content

### Subsection
      `;

      const headers = extractHeaders(markdown);

      expect(headers).toHaveLength(3);
      expect(headers[0].text).toBe('Title');
      expect(headers[1].text).toBe('Section 1');
      expect(headers[2].text).toBe('Subsection');
    });
  });
});
