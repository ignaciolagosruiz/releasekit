# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-01

### Features

- First public release of releasekit
- Conventional Commits parser with scope and breaking-change detection
- Automatic semver bump (major / minor / patch / none) from commit history
- Keep a Changelog 1.1.0 output writer with prepending strategy
- `releasekit release` runs the full pipeline end-to-end
- `releasekit plan` previews the next release without writing anything
- `releasekit init` writes a starter config file
- `releasekit check` reports working-tree state and the latest tag
- Programmatic API (`runRelease`, `loadConfig`, etc.) for embedded use
- `gh release create` integration for GitHub release notes
- Optional `npm publish` step, controlled by the `publish` config flag
