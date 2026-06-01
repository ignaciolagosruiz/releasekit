/**
 * npm publish wrapper.
 *
 * Uses the locally installed `npm` binary. Authentication is expected to
 * be handled via `NPM_TOKEN` env var or `~/.npmrc`.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface NpmPublishOptions {
  cwd?: string;
  tag?: string;
  dryRun?: boolean;
}

export async function publishToNpm(options: NpmPublishOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const args = ['publish', '--access', 'public'];
  if (options.tag) args.push('--tag', options.tag);
  if (options.dryRun) args.push('--dry-run');
  try {
    const res = await exec('npm', args, {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: res.stdout, stderr: res.stderr };
  } catch (err: any) {
    throw new Error(`npm publish failed (exit ${err.code ?? 1}): ${err.stderr ?? err.message}`);
  }
}
