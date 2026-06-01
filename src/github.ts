/**
 * GitHub release creation via the `gh` CLI.
 *
 * The user is expected to have `gh` installed and authenticated; we
 * intentionally avoid bringing in @octokit/rest to keep the dependency
 * surface tiny and let users reuse their existing `gh` config.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface GitHubReleaseOptions {
  tag: string;
  title?: string;
  body: string;
  repo?: string; // owner/name
  draft?: boolean;
  prerelease?: boolean;
  dryRun?: boolean;
}

export async function createGitHubRelease(options: GitHubReleaseOptions): Promise<{ stdout: string; url?: string }> {
  if (options.dryRun) {
    return { stdout: `[dry-run] gh release create ${options.tag}`, url: undefined };
  }
  const args = [
    'release',
    'create',
    options.tag,
    '--title',
    options.title ?? options.tag,
    '--notes',
    options.body,
  ];
  if (options.repo) args.push('--repo', options.repo);
  if (options.draft) args.push('--draft');
  if (options.prerelease) args.push('--prerelease');
  try {
    const res = await exec('gh', args, {
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    });
    // gh prints the release URL on the last line of stdout
    const stdout = res.stdout.trim();
    const url = stdout.split('\n').pop();
    return { stdout, url: url && url.startsWith('https') ? url : undefined };
  } catch (err: any) {
    throw new Error(`gh release create failed (exit ${err.code ?? 1}): ${err.stderr ?? err.message}`);
  }
}
