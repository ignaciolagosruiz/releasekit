/**
 * Conventional Commits parser
 *
 * Implements the spec at https://www.conventionalcommits.org/en/v1.0.0/
 * with pragmatic extensions commonly used in the Node.js / TypeScript ecosystem.
 */

export type CommitType =
  | 'feat'
  | 'fix'
  | 'perf'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'style'
  | 'revert';

export interface ParsedCommit {
  type: CommitType;
  scope?: string;
  subject: string;
  body?: string;
  footer?: string;
  breaking: boolean;
  references: string[];
  hash: string;
  author: string;
  date: string;
}

const COMMIT_TYPE_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s*(?<subject>.+)$/;

const FOOTER_BREAKING_RE = /^BREAKING[ -]CHANGE:\s*(.+)$/im;

/**
 * Parse a single commit line in the form:
 *   <hash>|<author>|<date>|<subject>
 *
 * The subject is split off the first `|` delimiter so commit bodies
 * (which may contain pipes) are preserved as-is.
 */
export function parseCommitLine(line: string): ParsedCommit | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const firstPipe = trimmed.indexOf('|');
  if (firstPipe === -1) return null;

  const hash = trimmed.slice(0, firstPipe).trim();
  const rest = trimmed.slice(firstPipe + 1);
  const secondPipe = rest.indexOf('|');
  if (secondPipe === -1) return null;

  const author = rest.slice(0, secondPipe).trim();
  const after = rest.slice(secondPipe + 1);
  const thirdPipe = after.indexOf('|');
  if (thirdPipe === -1) return null;

  const date = after.slice(0, thirdPipe).trim();
  const subjectAndBody = after.slice(thirdPipe + 1).trim();

  const newline = subjectAndBody.indexOf('\n');
  const subject = newline === -1 ? subjectAndBody : subjectAndBody.slice(0, newline);
  const body = newline === -1 ? undefined : subjectAndBody.slice(newline + 1).trim() || undefined;

  const match = subject.match(COMMIT_TYPE_RE);
  if (!match || !match.groups) return null;

  const type = match.groups.type as CommitType;
  const scope = match.groups.scope || undefined;
  const bang = Boolean(match.groups.bang);
  const subjectText = match.groups.subject.trim();

  const breaking = bang || (body ? FOOTER_BREAKING_RE.test(body) : false);
  const references: string[] = [];
  if (body) {
    let m: RegExpExecArray | null;
    const refRe = /(?:Closes|Fixes|Resolves|Refs)\s+#(\d+)/gi;
    while ((m = refRe.exec(body)) !== null) {
      references.push(m[1]!);
    }
  }

  return {
    type,
    scope,
    subject: subjectText,
    body,
    breaking,
    references,
    hash,
    author,
    date,
  };
}

/**
 * Parse a multi-line git log blob into a list of commits.
 *
 * The expected format is produced by `getCommitsSince()`:
 *
 *   <hash>\n<author>\n<date>\n<subject>\n<body>\n<<__RK_COMMIT_END__>>\n
 *
 * (the body may span multiple lines and may be empty).
 */
export function parseCommits(log: string): ParsedCommit[] {
  if (!log.trim()) return [];
  const out: ParsedCommit[] = [];
  const blocks = log.split('<<__RK_COMMIT_END__>>');
  for (const block of blocks) {
    const trimmed = block.replace(/^\n+|\n+$/g, '');
    if (!trimmed) continue;
    // Reconstruct a single line `<hash>|<author>|<date>|<subject>` followed
    // by the body on a new line — the same shape `parseCommitLine` expects.
    const lines = trimmed.split('\n');
    if (lines.length < 4) continue;
    const [hash, author, date, ...rest] = lines;
    const subject = rest[0] ?? '';
    const body = rest.length > 1 ? rest.slice(1).join('\n').trim() : undefined;
    const headerLine = `${hash}|${author}|${date}|${subject}${body ? '\n' + body : ''}`;
    const parsed = parseCommitLine(headerLine);
    if (parsed) out.push(parsed);
  }
  return out;
}

export interface ClassifiedCommits {
  features: ParsedCommit[];
  fixes: ParsedCommit[];
  performance: ParsedCommit[];
  refactors: ParsedCommit[];
  documentation: ParsedCommit[];
  tests: ParsedCommit[];
  build: ParsedCommit[];
  ci: ParsedCommit[];
  chores: ParsedCommit[];
  breaking: ParsedCommit[];
  unknown: ParsedCommit[];
}

export function classifyCommits(commits: ParsedCommit[]): ClassifiedCommits {
  const result: ClassifiedCommits = {
    features: [],
    fixes: [],
    performance: [],
    refactors: [],
    documentation: [],
    tests: [],
    build: [],
    ci: [],
    chores: [],
    breaking: [],
    unknown: [],
  };
  for (const c of commits) {
    if (c.breaking) result.breaking.push(c);
    switch (c.type) {
      case 'feat':
        result.features.push(c);
        break;
      case 'fix':
        result.fixes.push(c);
        break;
      case 'perf':
        result.performance.push(c);
        break;
      case 'refactor':
        result.refactors.push(c);
        break;
      case 'docs':
        result.documentation.push(c);
        break;
      case 'test':
        result.tests.push(c);
        break;
      case 'build':
        result.build.push(c);
        break;
      case 'ci':
        result.ci.push(c);
        break;
      case 'chore':
        result.chores.push(c);
        break;
      default:
        result.unknown.push(c);
    }
  }
  return result;
}
