#!/usr/bin/env node
/**
 * releasekit CLI
 *
 * Usage:
 *   releasekit release [--dry-run] [--skip-push] [--bump major|minor|patch]
 *   releasekit plan
 *   releasekit init
 *   releasekit --version
 *   releasekit --help
 */

import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runRelease, parseCommits, classifyCommits, determineBumpType, bumpVersion } from './index.js';
import { getCommitsSince, getLatestTag, isWorkingTreeClean } from './git.js';
import { defaultConfig } from './config.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('releasekit')
  .description('Opinionated release automation for Node.js / TypeScript projects.')
  .version('0.1.0');

program
  .command('release')
  .description('Run a full release: bump version, write changelog, tag, push, GitHub release, npm publish.')
  .option('--dry-run', 'Show what would happen without modifying anything')
  .option('--skip-push', 'Do not push tags or branches to the remote')
  .option('--skip-publish', 'Do not publish to npm')
  .option('--skip-github-release', 'Do not create a GitHub release')
  .option('--bump <type>', 'Override bump type: major, minor, patch')
  .option('--version <semver>', 'Override the next version (e.g. 1.2.3)')
  .action(async (opts) => {
    try {
      const result = await runRelease({
        dryRun: Boolean(opts.dryRun),
        skipPush: Boolean(opts.skipPush),
        skipPublish: Boolean(opts.skipPublish),
        skipGitHubRelease: Boolean(opts.skipGithubRelease),
        bump: opts.bump,
        version: opts.version,
      });
      console.log(chalk.green('\n✓ Release complete\n'));
      console.log(chalk.bold('Summary'));
      console.log(`  previous:  ${result.previousVersion ?? '(none)'}`);
      console.log(`  next:      ${result.version}`);
      console.log(`  bump:      ${result.bump}`);
      console.log(`  commits:   ${result.commitCount} (${result.breakingCount} breaking, ${result.featureCount} feat, ${result.fixCount} fix)`);
      console.log(`  tag:       ${result.tagCreated ? `v${result.version}` : 'not created'}`);
      console.log(`  changelog: ${result.changelogWritten ? 'written' : 'not written'}`);
      console.log(`  package:   ${result.packageJsonBumped ? 'bumped' : 'not bumped'}`);
      console.log(`  github:    ${result.githubReleaseUrl ?? 'not created'}`);
      console.log(`  npm:       ${result.npmPublished ? 'published' : 'not published'}`);
    } catch (err) {
      console.error(chalk.red(`\n✗ Release failed: ${(err as Error).message}\n`));
      process.exitCode = 1;
    }
  });

program
  .command('plan')
  .description('Show what the next release would look like without changing anything.')
  .action(async () => {
    try {
      const previousTag = await getLatestTag();
      const log = await getCommitsSince(previousTag);
      const commits = parseCommits(log);
      const classified = classifyCommits(commits);
      const bump = determineBumpType(classified);
      const pkgRaw = await import('node:fs/promises').then((m) =>
        m.readFile(resolve(process.cwd(), 'package.json'), 'utf8'),
      );
      const pkg = JSON.parse(pkgRaw);
      const next = bumpVersion(pkg.version, bump);
      console.log(chalk.bold('\nNext release plan\n'));
      console.log(`  current:  ${pkg.version}`);
      console.log(`  bump:     ${chalk.cyan(bump)}`);
      console.log(`  next:     ${chalk.green(next)}`);
      console.log(`  commits:  ${commits.length}`);
      console.log(`    breaking: ${classified.breaking.length}`);
      console.log(`    features: ${classified.features.length}`);
      console.log(`    fixes:    ${classified.fixes.length}`);
      console.log(`    perf:     ${classified.performance.length}`);
      console.log(`    refactor: ${classified.refactors.length}`);
      console.log(`    docs:     ${classified.documentation.length}`);
      console.log(`    other:    ${classified.tests.length + classified.build.length + classified.ci.length + classified.chores.length + classified.unknown.length}`);
      if (bump === 'none' && commits.length > 0) {
        console.log(chalk.yellow('\n  Note: only chore/ci/docs/test commits found; no version bump will be performed.'));
      }
    } catch (err) {
      console.error(chalk.red(`\n✗ Plan failed: ${(err as Error).message}\n`));
      process.exitCode = 1;
    }
  });

program
  .command('init')
  .description('Write a starter releasekit.config.json in the current directory.')
  .action(async () => {
    const path = resolve(process.cwd(), 'releasekit.config.json');
    await writeFile(path, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf8');
    console.log(chalk.green(`\n✓ Wrote ${path}\n`));
  });

program
  .command('check')
  .description('Verify the working tree is clean and report on the latest tag.')
  .action(async () => {
    const clean = await isWorkingTreeClean();
    const tag = await getLatestTag();
    console.log(`working tree: ${clean ? chalk.green('clean') : chalk.yellow('dirty')}`);
    console.log(`latest tag:   ${tag ?? chalk.gray('(none)')}`);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
