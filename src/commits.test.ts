import { describe, it, expect } from 'vitest';
import { parseCommitLine, parseCommits, classifyCommits } from './commits.js';

describe('parseCommitLine', () => {
  it('parses a basic feat commit', () => {
    const line = 'abc1234|John Doe|2026-05-01T10:00:00Z|feat(cli): add dry-run flag';
    const c = parseCommitLine(line)!;
    expect(c.type).toBe('feat');
    expect(c.scope).toBe('cli');
    expect(c.subject).toBe('add dry-run flag');
    expect(c.breaking).toBe(false);
    expect(c.hash).toBe('abc1234');
    expect(c.author).toBe('John Doe');
    expect(c.references).toEqual([]);
  });

  it('detects a breaking change via the bang prefix', () => {
    const line = 'def5678|Alice|2026-05-02T11:00:00Z|feat(api)!: rename /v1 to /v2';
    const c = parseCommitLine(line)!;
    expect(c.breaking).toBe(true);
    expect(c.subject).toBe('rename /v1 to /v2');
  });

  it('detects a breaking change via the footer', () => {
    const line = [
      'ghi9012|Bob|2026-05-03T12:00:00Z|refactor: drop legacy support',
      '',
      'BREAKING CHANGE: the old config file format is no longer supported.',
    ].join('\n');
    const c = parseCommitLine(line)!;
    expect(c.breaking).toBe(true);
    expect(c.body).toContain('BREAKING CHANGE');
  });

  it('extracts reference numbers from the body', () => {
    const line = [
      'aaa1111|Carol|2026-05-04T13:00:00Z|fix: handle null input',
      '',
      'Closes #42, Refs #99',
    ].join('\n');
    const c = parseCommitLine(line)!;
    expect(c.references).toEqual(['42', '99']);
  });

  it('returns null for a non-conventional line', () => {
    expect(parseCommitLine('this is not a conventional commit')).toBeNull();
  });
});

describe('parseCommits', () => {
  it('parses a multi-commit log', () => {
    const log = [
      'commit 1111111111111111111111111111111111111111',
      'aaa|John|2026-01-01T00:00:00Z|feat: one',
      '',
      'commit 2222222222222222222222222222222222222222',
      'bbb|Alice|2026-01-02T00:00:00Z|fix: two',
    ].join('\n');
    const out = parseCommits(log);
    expect(out).toHaveLength(2);
    expect(out[0]!.subject).toBe('one');
    expect(out[1]!.subject).toBe('two');
  });
});

describe('classifyCommits', () => {
  it('groups commits by type', () => {
    const log = [
      'commit 3333333333333333333333333333333333333333',
      'a|John|2026-01-01T00:00:00Z|feat: a',
      '',
      'commit 4444444444444444444444444444444444444444',
      'b|John|2026-01-02T00:00:00Z|fix: b',
      '',
      'commit 5555555555555555555555555555555555555555',
      'c|John|2026-01-03T00:00:00Z|docs: c',
    ].join('\n');
    const commits = parseCommits(log);
    const c = classifyCommits(commits);
    expect(c.features).toHaveLength(1);
    expect(c.fixes).toHaveLength(1);
    expect(c.documentation).toHaveLength(1);
  });

  it('puts breaking changes into their own bucket regardless of type', () => {
    const log = [
      'commit 6666666666666666666666666666666666666666',
      'a|John|2026-01-01T00:00:00Z|feat(api)!: switch to v2',
    ].join('\n');
    const commits = parseCommits(log);
    const c = classifyCommits(commits);
    expect(c.features).toHaveLength(1);
    expect(c.breaking).toHaveLength(1);
  });
});
