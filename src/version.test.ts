import { describe, it, expect } from 'vitest';
import { parseVersion, formatVersion, bumpVersion, determineBumpType } from './version.js';
import { classifyCommits, type ParsedCommit } from './commits.js';

const fixed = (subject: string, type: any = 'feat', breaking = false, scope?: string): ParsedCommit => ({
  type,
  scope,
  subject,
  breaking,
  references: [],
  hash: '0'.repeat(40),
  author: 'tester',
  date: '2026-01-01T00:00:00Z',
});

describe('parseVersion / formatVersion', () => {
  it('round-trips a simple semver string', () => {
    expect(formatVersion(parseVersion('1.2.3'))).toBe('1.2.3');
  });
  it('handles prerelease and build metadata', () => {
    expect(formatVersion(parseVersion('1.0.0-rc.1+build.7'))).toBe('1.0.0-rc.1+build.7');
  });
  it('throws on invalid input', () => {
    expect(() => parseVersion('not-semver')).toThrow();
  });
});

describe('bumpVersion', () => {
  it('bumps major', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });
  it('bumps minor', () => {
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
  });
  it('bumps patch', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
  });
  it('returns the same version on none', () => {
    expect(bumpVersion('1.2.3', 'none')).toBe('1.2.3');
  });
});

describe('determineBumpType', () => {
  it('prefers major over minor over patch', () => {
    const c1 = classifyCommits([fixed('a', 'feat'), fixed('b', 'fix'), fixed('c', 'feat', true)]);
    expect(determineBumpType(c1)).toBe('major');
    const c2 = classifyCommits([fixed('a', 'fix'), fixed('b', 'feat')]);
    expect(determineBumpType(c2)).toBe('minor');
    const c3 = classifyCommits([fixed('a', 'fix')]);
    expect(determineBumpType(c3)).toBe('patch');
    const c4 = classifyCommits([fixed('a', 'docs')]);
    expect(determineBumpType(c4)).toBe('none');
  });
});
