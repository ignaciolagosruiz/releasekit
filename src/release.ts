/**
 * Release pipeline orchestrator.
 *
 * Ties together commit parsing, version bumping, changelog rendering,
 * git tagging, GitHub release creation, and optional npm publishing.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCommits, classifyCommits, type ParsedCommit } from './commits.js';
import { bumpVersion, determineBumpType, type BumpType } from './version.js';
import { renderChangelogDocument } from './changelog.js';
import {
  runGit,
  tagExists,
  isWorkingTreeClean,
  getLatestTag,
  getCommitsSince,
  currentBranch,
} from './git.js';
import { loadConfig, type ReleasekitConfig } from './config.js';
import { publishToNpm } from './npm.js';
import { createGitHubRelease } from './github.js';

export interface ReleaseOptions {
  /** Override the auto-detected bump type (major|minor|patch|none). */
  bump?: BumpType;
  /** Override the version that should be released. */
  version?: string;
  /** Skip actually writing any state; print the plan and exit. */
  dryRun?: boolean;
  /** Do not push tags or create remote releases. */
  skipPush?: boolean;
  /** Custom cwd (defaults to process.cwd()). */
  cwd?: string;
  /** Pre-loaded config (skips loadConfig if provided). */
  config?: ReleasekitConfig;
  /** Do not publish to npm. */
  skipPublish?: boolean;
  /** Do not create a GitHub release. */
  skipGitHubRelease?: boolean;
}

export interface ReleaseResult {
  bump: BumpType;
  version: string;
  previousVersion: string | null;
  commitCount: number;
  breakingCount: number;
  featureCount: number;
  fixCount: number;
  changelogWritten: boolean;
  packageJsonBumped: boolean;
  tagCreated: boolean;
  githubReleaseUrl: string | undefined;
  npmPublished: boolean;
}

interface PackageJsonShape {
  name: string;
  version: string;
  [key: string]: unknown;
}

function readPackageJson(path: string): Promise<PackageJsonShape> {
  return readFile(path, 'utf8').then((raw) => JSON.parse(raw));
}

async function writePackageJson(path: string, pkg: PackageJsonShape): Promise<void> {
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inferRepoUrl(pkg: PackageJsonShape, config: ReleasekitConfig): string | undefined {
  if (config.repoUrl) return config.repoUrl;
  const repo = (pkg.repository as { url?: string } | string | undefined);
  if (typeof repo === 'string') return repo.replace(/\.git$/, '');
  if (repo && typeof repo.url === 'string') return repo.url.replace(/\.git$/, '');
  return undefined;
}

function inferGhRepo(pkg: PackageJsonShape): string | undefined {
  const repo = (pkg.repository as { url?: string } | string | undefined);
  if (typeof repo === 'string') {
    const m = repo.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
    return m ? `${m[1]}/${m[2]}` : undefined;
  }
  if (repo && typeof repo.url === 'string') {
    const m = repo.url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
    return m ? `${m[1]}/${m[2]}` : undefined;
  }
  return undefined;
}

export async function runRelease(options: ReleaseOptions = {}): Promise<ReleaseResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? (await loadConfig(cwd));
  const dryRun = options.dryRun ?? false;

  if (!dryRun) {
    const clean = await isWorkingTreeClean({ cwd });
    if (!clean) {
      throw new Error('Working tree has uncommitted changes; commit or stash them first.');
    }
  }

  const pkgPath = resolve(cwd, config.packageJsonPath);
  const pkg = await readPackageJson(pkgPath);
  const previousVersion = pkg.version as string;
  const repoUrl = inferRepoUrl(pkg, config);
  const ghRepo = inferGhRepo(pkg);

  const previousTag = await getLatestTag({ cwd, dryRun });
  const logBlob = await getCommitsSince(previousTag, { cwd, dryRun });
  const commits: ParsedCommit[] = parseCommits(logBlob);
  const classified = classifyCommits(commits);

  const autoBump = determineBumpType(classified);
  const bump = options.bump ?? autoBump;
  const newVersion = options.version ?? bumpVersion(previousVersion, bump);

  if (bump === 'none' && !options.version) {
    return {
      bump: 'none',
      version: previousVersion,
      previousVersion,
      commitCount: commits.length,
      breakingCount: classified.breaking.length,
      featureCount: classified.features.length,
      fixCount: classified.fixes.length,
      changelogWritten: false,
      packageJsonBumped: false,
      tagCreated: false,
      githubReleaseUrl: undefined,
      npmPublished: false,
    };
  }

  if (!options.skipPush) {
    if (!dryRun && (await tagExists(`v${newVersion}`, { cwd }))) {
      throw new Error(`Tag v${newVersion} already exists.`);
    }
  }

  const changelogPath = resolve(cwd, config.changelogPath);
  const existing = await readFile(changelogPath, 'utf8').catch(() => '');

  let compareUrl: string | undefined;
  if (previousTag && repoUrl) {
    compareUrl = `${repoUrl}/compare/${previousTag}...v${newVersion}`;
  }

  const changelogBody = renderChangelogDocument(classified, {
    version: `v${newVersion}`,
    date: todayISO(),
    repoUrl,
    compareUrl,
    previousTag: previousTag ?? undefined,
  });

  const newChangelog = existing
    ? prependNewSection(existing, changelogBody)
    : changelogBody;

  let changelogWritten = false;
  if (!dryRun) {
    await writeFile(changelogPath, newChangelog, 'utf8');
    changelogWritten = true;
  }

  let packageJsonBumped = false;
  if (config.bumpVersion) {
    pkg.version = newVersion;
    if (!dryRun) {
      await writePackageJson(pkgPath, pkg);
      packageJsonBumped = true;
    }
  }

  let tagCreated = false;
  if (!options.skipPush) {
    if (config.commitBump) {
      await runGit(['add', config.packageJsonPath, config.changelogPath], { cwd, dryRun });
      const msg = config.bumpCommitMessage.replace('{version}', newVersion);
      await runGit(['commit', '-m', msg], { cwd, dryRun });
    }
    if (!dryRun) {
      await runGit(['tag', `v${newVersion}`], { cwd, dryRun: false });
      tagCreated = true;
    } else {
      tagCreated = true;
    }
  }

  let githubReleaseUrl: string | undefined;
  if (config.githubRelease && !options.skipGitHubRelease) {
    const releaseBody = renderReleaseNotes(classified, newVersion, todayISO(), repoUrl, previousTag);
    const res = await createGitHubRelease({
      tag: `v${newVersion}`,
      title: `v${newVersion}`,
      body: releaseBody,
      repo: ghRepo,
      dryRun,
    });
    githubReleaseUrl = res.url;
  }

  if (!options.skipPush) {
    const branch = config.branch || (await currentBranch({ cwd, dryRun }));
    await runGit(['push', config.remote, branch, `v${newVersion}`], { cwd, dryRun });
  }

  let npmPublished = false;
  if (config.publish && !options.skipPublish) {
    await publishToNpm({ cwd, tag: config.npmTag, dryRun });
    npmPublished = true;
  }

  return {
    bump,
    version: newVersion,
    previousVersion,
    commitCount: commits.length,
    breakingCount: classified.breaking.length,
    featureCount: classified.features.length,
    fixCount: classified.fixes.length,
    changelogWritten,
    packageJsonBumped,
    tagCreated,
    githubReleaseUrl,
    npmPublished,
  };
}

function prependNewSection(existing: string, newBody: string): string {
  // Insert the new section after the existing header block (line containing
  // the first "## [" heading, or right after the intro paragraph).
  const lines = existing.split('\n');
  let insertAt = lines.findIndex((l) => l.startsWith('## ['));
  if (insertAt === -1) {
    // No prior section, append after the header (line with empty line after # Changelog).
    let headerEnd = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim() === '') {
        headerEnd = i + 1;
        break;
      }
    }
    insertAt = headerEnd;
  }
  return [...lines.slice(0, insertAt), newBody.trimEnd(), '', ...lines.slice(insertAt)].join('\n');
}

function renderReleaseNotes(
  classified: ReturnType<typeof classifyCommits>,
  version: string,
  date: string,
  repoUrl: string | undefined,
  previousTag: string | null,
): string {
  const lines: string[] = [];
  lines.push(`# v${version} (${date})`);
  lines.push('');
  if (previousTag && repoUrl) {
    lines.push(`[Compare changes](${repoUrl}/compare/${previousTag}...v${version})`);
    lines.push('');
  }
  if (classified.breaking.length > 0) {
    lines.push('## Breaking Changes');
    for (const c of classified.breaking) lines.push(`- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}`);
    lines.push('');
  }
  if (classified.features.length > 0) {
    lines.push('## Features');
    for (const c of classified.features) lines.push(`- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}`);
    lines.push('');
  }
  if (classified.fixes.length > 0) {
    lines.push('## Bug Fixes');
    for (const c of classified.fixes) lines.push(`- ${c.scope ? `**${c.scope}**: ` : ''}${c.subject}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
