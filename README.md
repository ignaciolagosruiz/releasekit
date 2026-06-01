# releasekit

[![CI](https://github.com/ignaciolagosruiz/releasekit/actions/workflows/ci.yml/badge.svg)](https://github.com/ignaciolagosruiz/releasekit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/releasekit.svg)](https://www.npmjs.com/package/releasekit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Opinionated release automation for Node.js and TypeScript projects.
> Parses Conventional Commits, generates changelogs, bumps versions,
> creates GitHub releases, and publishes to npm — all from one config file.

`releasekit` is a small, single-binary alternative to heavier tools like
`release-please`, `semantic-release`, and `standard-version`. It deliberately
relies only on the system `git` and `gh` CLIs, so there is no extra
authentication surface and no per-tool token to manage.

## Why

Most release tools force you to commit to a full pipeline and bring a
dozen dependencies. `releasekit` ships with:

- **Zero required runtime deps beyond `git` and `gh`** — `chalk` and
  `commander` are the entire runtime footprint.
- **A working tree you can actually inspect** — `--dry-run` prints the
  plan without touching any file.
- **Escape hatches everywhere** — `--skip-push`, `--skip-publish`,
  `--skip-github-release`, `--bump`, `--version`.
- **Conventional Commits 1.0.0** parsing, including scope and breaking
  detection (both `!` and `BREAKING CHANGE:` footer).
- **Keep a Changelog 1.1.0** output format.

## Install

```bash
npm install --save-dev releasekit
```

## Quick start

```bash
# 1. Add a config (optional — defaults are sensible).
npx releasekit init

# 2. See what the next release will look like.
npx releasekit plan

# 3. Run the release.
npx releasekit release
```

## CLI

```
releasekit release [--dry-run] [--skip-push] [--skip-publish]
                   [--skip-github-release] [--bump major|minor|patch]
                   [--version <semver>]
releasekit plan
releasekit init
releasekit check
```

## Configuration

A `releasekit.config.json` at the project root overrides any default:

```json
{
  "publish": true,
  "npmTag": "latest",
  "githubRelease": true,
  "bumpVersion": true,
  "commitBump": true,
  "bumpCommitMessage": "chore(release): v{version}",
  "changelogPath": "./CHANGELOG.md",
  "packageJsonPath": "./package.json",
  "remote": "origin",
  "branch": "main",
  "repoUrl": "https://github.com/ignaciolagosruiz/releasekit"
}
```

## How a release runs

1. Verify the working tree is clean (unless `--dry-run`).
2. Read the previous tag with `git describe --tags --abbrev=0`.
3. Collect commits since that tag with `git log`.
4. Parse them with the Conventional Commits grammar.
5. Decide the next version: `BREAKING CHANGE` → major, `feat` → minor,
   `fix` / `perf` → patch, otherwise no bump.
6. Rewrite `CHANGELOG.md` with a new section at the top.
7. Bump `version` in `package.json`.
8. `git add` and `git commit` the version bump.
9. Create an annotated `git tag vX.Y.Z`.
10. `git push` the branch and the tag.
11. `gh release create` the tag with the rendered notes.
12. `npm publish` (only when `publish: true`).

If anything fails after the changelog is written, the operation stops;
subsequent `release` invocations are idempotent because the next call
will re-read the existing changelog and only insert a new section.

## Conventional Commits

```
<type>(<scope>)<!>: <subject>

<body>

<footer>
```

Recognized `<type>` values: `feat`, `fix`, `perf`, `refactor`, `docs`,
`test`, `build`, `ci`, `chore`, `style`, `revert`. Anything else is
grouped under "Other".

Breaking changes can be flagged either with a bang (`feat(api)!: ...`)
or with a `BREAKING CHANGE: ...` line in the body. Both are detected
and trigger a major version bump.

## Programmatic API

```ts
import { runRelease, loadConfig } from 'releasekit';

const config = await loadConfig();
const result = await runRelease({ config, dryRun: true });
console.log(result.version, result.bump);
```

The full module surface is exported from the package root. See
[`src/index.ts`](./src/index.ts) for the complete list.

## License

MIT — see [LICENSE](./LICENSE).
