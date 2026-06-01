/**
 * Semantic version bumping
 *
 * Implements semver 2.0.0 (https://semver.org/) bump rules driven by
 * Conventional Commits classification.
 */

import type { ClassifiedCommits } from './commits.js';

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

export interface Version {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  buildMetadata?: string;
}

const SEMVER_RE =
  /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)(?:-(?<pre>[0-9A-Za-z.-]+))?(?:\+(?<build>[0-9A-Za-z.-]+))?$/;

export function parseVersion(input: string): Version {
  const m = input.trim().match(SEMVER_RE);
  if (!m || !m.groups) {
    throw new Error(`Invalid semver: ${JSON.stringify(input)}`);
  }
  return {
    major: Number(m.groups.major),
    minor: Number(m.groups.minor),
    patch: Number(m.groups.patch),
    preRelease: m.groups.pre || undefined,
    buildMetadata: m.groups.build || undefined,
  };
}

export function formatVersion(v: Version): string {
  let s = `${v.major}.${v.minor}.${v.patch}`;
  if (v.preRelease) s += `-${v.preRelease}`;
  if (v.buildMetadata) s += `+${v.buildMetadata}`;
  return s;
}

export function determineBumpType(commits: ClassifiedCommits): BumpType {
  if (commits.breaking.length > 0) return 'major';
  if (commits.features.length > 0) return 'minor';
  if (commits.fixes.length > 0 || commits.performance.length > 0) return 'patch';
  return 'none';
}

export function bumpVersion(current: string, bump: BumpType): string {
  if (bump === 'none') return current;
  const v = parseVersion(current);
  switch (bump) {
    case 'major':
      return formatVersion({ major: v.major + 1, minor: 0, patch: 0 });
    case 'minor':
      return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 });
    case 'patch':
      return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 });
  }
}
