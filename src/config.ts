/**
 * Config loader for releasekit
 *
 * Reads a `releasekit.config.json` (or `.js`/`.cjs`/`.mjs`) from the
 * project root, falling back to defaults if no file is present.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ReleasekitConfig {
  /** Path to the package.json file. Default: `./package.json`. */
  packageJsonPath: string;
  /** Whether to publish to npm after a successful release. Default: `false`. */
  publish: boolean;
  /** npm tag to publish under. Default: `'latest'`. */
  npmTag: string;
  /** Whether to create a GitHub release. Default: `true`. */
  githubRelease: boolean;
  /** Whether to bump the version in package.json. Default: `true`. */
  bumpVersion: boolean;
  /** Whether to commit the version bump back to git. Default: `true`. */
  commitBump: boolean;
  /** Custom commit message for the version bump. */
  bumpCommitMessage: string;
  /** Path to the existing CHANGELOG.md. Default: `./CHANGELOG.md`. */
  changelogPath: string;
  /** Optional URL of the repository (used for changelog links). */
  repoUrl?: string;
  /** Git remote to push tags to. Default: `'origin'`. */
  remote: string;
  /** Branch to push the bump commit to. Default: `'main'`. */
  branch: string;
}

export const defaultConfig: ReleasekitConfig = {
  packageJsonPath: './package.json',
  publish: false,
  npmTag: 'latest',
  githubRelease: true,
  bumpVersion: true,
  commitBump: true,
  bumpCommitMessage: 'chore(release): v{version}',
  changelogPath: './CHANGELOG.md',
  remote: 'origin',
  branch: 'main',
};

export async function loadConfig(cwd: string = process.cwd()): Promise<ReleasekitConfig> {
  const candidates = [
    'releasekit.config.json',
    'releasekit.config.js',
    'releasekit.config.cjs',
    'releasekit.config.mjs',
  ];
  for (const name of candidates) {
    const p = resolve(cwd, name);
    if (!existsSync(p)) continue;
    if (name.endsWith('.json')) {
      const raw = await readFile(p, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...defaultConfig, ...parsed };
    }
    if (name.endsWith('.mjs')) {
      const mod = await import(p);
      return { ...defaultConfig, ...(mod.default ?? mod) };
    }
    if (name.endsWith('.js') || name.endsWith('.cjs')) {
      const mod = await import(p);
      return { ...defaultConfig, ...(mod.default ?? mod) };
    }
  }
  return { ...defaultConfig };
}
