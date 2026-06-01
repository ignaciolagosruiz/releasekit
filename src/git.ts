/**
 * Git helpers used by the release pipeline.
 *
 * All commands are executed via `git` from the CLI rather than via a
 * library, so the tool works in any git environment without extra deps.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface RunGitOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  dryRun?: boolean;
}

export class GitError extends Error {
  constructor(public readonly command: string, public readonly exitCode: number, message: string) {
    super(`git ${command} failed (exit ${exitCode}): ${message}`);
    this.name = 'GitError';
  }
}

export async function runGit(
  args: string[],
  options: RunGitOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  if (options.dryRun) {
    return { stdout: '', stderr: `git ${args.join(' ')} (dry-run, not executed)` };
  }
  try {
    const res = await exec('git', args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { stdout: res.stdout, stderr: res.stderr };
  } catch (err: any) {
    throw new GitError(args.join(' '), err.code ?? 1, err.stderr ?? err.message);
  }
}

export async function tagExists(tag: string, options: RunGitOptions = {}): Promise<boolean> {
  // Reads always run, even in dry-run mode, so plan/release --dry-run
  // can still inspect the repository.
  const realOpts: RunGitOptions = { ...options, dryRun: false };
  const { stdout } = await runGit(['tag', '--list', tag], realOpts);
  return stdout.trim() === tag;
}

export async function currentBranch(options: RunGitOptions = {}): Promise<string> {
  const realOpts: RunGitOptions = { ...options, dryRun: false };
  const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], realOpts);
  return stdout.trim();
}

export async function isWorkingTreeClean(options: RunGitOptions = {}): Promise<boolean> {
  const realOpts: RunGitOptions = { ...options, dryRun: false };
  const { stdout } = await runGit(['status', '--porcelain'], realOpts);
  return stdout.trim() === '';
}

export async function getLatestTag(options: RunGitOptions = {}): Promise<string | null> {
  const realOpts: RunGitOptions = { ...options, dryRun: false };
  const { stdout } = await runGit(['describe', '--tags', '--abbrev=0'], realOpts).catch(
    () => ({ stdout: '' }),
  );
  return stdout.trim() || null;
}

export async function getCommitsSince(
  ref: string | null,
  options: RunGitOptions = {},
): Promise<string> {
  const range = ref ? `${ref}..HEAD` : 'HEAD';
  // Use a separator that cannot appear in real commit metadata.
  // Each commit's record spans multiple lines; we mark the end-of-commit
  // with a sentinel that is extremely unlikely to occur naturally.
  const commitEnd = '\n<<__RK_COMMIT_END__>>\n';
  const format = ['%H', '%an', '%aI', '%s', '%b'].join('%n');
  const { stdout } = await runGit(
    ['log', range, `--pretty=format:${format}${commitEnd}`, '--no-merges'],
    options,
  );
  return stdout;
}
