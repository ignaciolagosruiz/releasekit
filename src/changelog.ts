/**
 * Changelog generation
 *
 * Produces a Markdown changelog grouped by Conventional Commits type.
 * Follows "Keep a Changelog" (https://keepachangelog.com/) structure.
 */

import type { ClassifiedCommits, ParsedCommit } from './commits.js';
import { formatVersion } from './version.js';

export interface ChangelogSection {
  heading: string;
  commits: ParsedCommit[];
}

export interface ChangelogOptions {
  version: string;
  date: string;
  repoUrl?: string;
  compareUrl?: string;
  previousTag?: string;
}

const SECTION_LABELS: Record<keyof ClassifiedCommits, string> = {
  breaking: 'Breaking Changes',
  features: 'Features',
  fixes: 'Bug Fixes',
  performance: 'Performance',
  refactors: 'Refactors',
  documentation: 'Documentation',
  tests: 'Tests',
  build: 'Build System',
  ci: 'CI',
  chores: 'Chores',
  unknown: 'Other',
};

const SECTION_ORDER: (keyof ClassifiedCommits)[] = [
  'breaking',
  'features',
  'fixes',
  'performance',
  'refactors',
  'documentation',
  'tests',
  'build',
  'ci',
  'chores',
  'unknown',
];

function formatCommit(c: ParsedCommit, repoUrl?: string): string {
  const scope = c.scope ? `**${c.scope}**: ` : '';
  let line = `- ${scope}${c.subject} ([${c.hash.slice(0, 7)}]`;
  if (repoUrl) {
    line += `(${repoUrl}/commit/${c.hash})`;
  }
  line += ')';
  for (const ref of c.references) {
    if (repoUrl) {
      line += `, closes [#${ref}](${repoUrl}/issues/${ref})`;
    } else {
      line += `, closes #${ref}`;
    }
  }
  return line;
}

export function generateChangelog(classified: ClassifiedCommits): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  for (const key of SECTION_ORDER) {
    const commits = classified[key];
    if (commits.length === 0) continue;
    sections.push({ heading: SECTION_LABELS[key], commits });
  }
  return sections;
}

export function renderChangelog(
  classified: ClassifiedCommits,
  options: ChangelogOptions,
): string {
  const sections = generateChangelog(classified);
  const lines: string[] = [];
  lines.push(`## [${options.version}] - ${options.date}`);
  if (options.compareUrl) {
    lines.push(`[Compare changes](${options.compareUrl})`);
  }
  lines.push('');
  for (const section of sections) {
    lines.push(`### ${section.heading}`);
    lines.push('');
    for (const c of section.commits) {
      lines.push(formatCommit(c, options.repoUrl));
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function renderChangelogDocument(
  classified: ClassifiedCommits,
  options: ChangelogOptions,
): string {
  const out: string[] = [];
  out.push('# Changelog');
  out.push('');
  out.push('All notable changes to this project will be documented in this file.');
  out.push('');
  out.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),');
  out.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
  out.push('');
  out.push(renderChangelog(classified, options));
  return out.join('\n');
}

export { formatVersion };
