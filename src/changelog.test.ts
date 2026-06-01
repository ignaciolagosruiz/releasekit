import { describe, it, expect } from 'vitest';
import { renderChangelog, renderChangelogDocument, generateChangelog } from './changelog.js';
import { classifyCommits, type ParsedCommit } from './commits.js';

const mk = (overrides: Partial<ParsedCommit>): ParsedCommit => ({
  type: 'feat',
  subject: 'subject',
  breaking: false,
  references: [],
  hash: 'aaa0000000000000000000000000000000000aaa',
  author: 'tester',
  date: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('generateChangelog', () => {
  it('emits sections in canonical order and skips empty ones', () => {
    const c = classifyCommits([mk({ type: 'feat' }), mk({ type: 'fix' })]);
    const sections = generateChangelog(c, { version: '1.0.0', date: '2026-01-01' });
    expect(sections.map((s: { heading: string }) => s.heading)).toEqual(['Features', 'Bug Fixes']);
  });
});

describe('renderChangelog', () => {
  it('produces markdown with version, date, and bullet items', () => {
    const c = classifyCommits([
      mk({ type: 'feat', subject: 'add foo', scope: 'cli' }),
      mk({ type: 'fix', subject: 'handle bar', scope: 'core', references: ['42'] }),
    ]);
    const md = renderChangelog(c, {
      version: '1.2.3',
      date: '2026-01-15',
      repoUrl: 'https://github.com/x/y',
    });
    expect(md).toContain('## [1.2.3] - 2026-01-15');
    expect(md).toContain('### Features');
    expect(md).toContain('### Bug Fixes');
    expect(md).toContain('**cli**: add foo');
    expect(md).toContain('**core**: handle bar');
    expect(md).toContain('closes [#42](https://github.com/x/y/issues/42)');
  });
});

describe('renderChangelogDocument', () => {
  it('wraps the rendered changelog with a header block', () => {
    const c = classifyCommits([mk({ type: 'feat' })]);
    const md = renderChangelogDocument(c, { version: '0.1.0', date: '2026-01-01' });
    expect(md.startsWith('# Changelog')).toBe(true);
    expect(md).toContain('Keep a Changelog');
    expect(md).toContain('## [0.1.0] - 2026-01-01');
  });
});
