/**
 * releasekit — release automation library
 *
 * This module exports the public API used by programmatic consumers.
 * The CLI entrypoint lives in `cli.ts`.
 */

export { runRelease, type ReleaseOptions, type ReleaseResult } from './release.js';
export { parseCommits, classifyCommits, type ParsedCommit, type CommitType, type ClassifiedCommits } from './commits.js';
export { bumpVersion, determineBumpType, formatVersion, parseVersion, type BumpType, type Version } from './version.js';
export { generateChangelog, renderChangelog, renderChangelogDocument, type ChangelogSection, type ChangelogOptions } from './changelog.js';
export { loadConfig, defaultConfig, type ReleasekitConfig } from './config.js';
export { runGit, tagExists, currentBranch, isWorkingTreeClean, getLatestTag, getCommitsSince, GitError } from './git.js';
export { publishToNpm } from './npm.js';
export { createGitHubRelease } from './github.js';
