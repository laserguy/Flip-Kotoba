import fs from 'node:fs';
import path from 'node:path';
import { is } from 'drizzle-orm';
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../src/infrastructure/db/schema';
import { BOX_INTERVAL_DAYS, DECK_NAME_MAX_LENGTH, MEMORIZE_STREAK_THRESHOLD } from '../src/domain/constants';
import { BACKUP_FORMAT_VERSION } from '../src/domain/entities/Backup';

// Fails when the documentation drifts from the code. Only mechanically
// checkable facts are covered — names, paths, numbers, commands. Whether a
// prose explanation is still accurate remains a review concern.

const REPO_ROOT = path.join(__dirname, '..');
const ARCHITECTURE_DOC = 'docs/ARCHITECTURE.md';

// Every non-test source module under these folders must be named in the
// architecture doc, so a new port, use case, adapter, screen, hook or
// component can't land undocumented.
const DOCUMENTED_SOURCE_DIRS = ['src/domain', 'src/infrastructure', 'src/screens', 'src/hooks', 'src/components'];

function readRepoFile(repoPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, repoPath), 'utf-8');
}

function listFilesRecursively(repoDir: string): string[] {
  return fs.readdirSync(path.join(REPO_ROOT, repoDir), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = `${repoDir}/${entry.name}`;
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });
}

function documentationFiles(): string[] {
  const docsFolder = fs
    .readdirSync(path.join(REPO_ROOT, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`);
  return ['README.md', 'AGENTS.md', ...docsFolder];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionsAsWord(doc: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`).test(doc);
}

function isSourceModule(repoPath: string): boolean {
  return /\.tsx?$/.test(repoPath) && !/\.test\.tsx?$/.test(repoPath);
}

function moduleName(repoPath: string): string {
  return path.basename(repoPath).replace(/\.tsx?$/, '');
}

// Supports the two wildcard forms the docs use: `*` within one path segment
// and `{a,b}` alternatives.
function globToRegExp(pattern: string): RegExp {
  const source = pattern
    .split(/(\*|\{[^}]*\})/)
    .map((part) => {
      if (part === '*') return '[^/]*';
      if (part.startsWith('{')) return `(?:${part.slice(1, -1).split(',').map(escapeRegExp).join('|')})`;
      return escapeRegExp(part);
    })
    .join('');
  return new RegExp(`^${source}$`);
}

function repoPathExists(repoPath: string): boolean {
  const withoutTrailingSlash = repoPath.replace(/\/$/, '');
  if (!/[*{]/.test(withoutTrailingSlash)) return fs.existsSync(path.join(REPO_ROOT, withoutTrailingSlash));

  const fixedPrefix = withoutTrailingSlash.split('/').filter((_, index, segments) =>
    segments.slice(0, index + 1).every((segment) => !/[*{]/.test(segment)),
  );
  const searchRoot = fixedPrefix.join('/');
  if (!fs.existsSync(path.join(REPO_ROOT, searchRoot))) return false;
  const matcher = globToRegExp(withoutTrailingSlash);
  return listFilesRecursively(searchRoot).some((file) => matcher.test(file));
}

function referencedPaths(docPath: string): string[] {
  const doc = readRepoFile(docPath);
  const backticked = [...doc.matchAll(/`((?:src|drizzle|docs)\/[^`\s]*)`/g)].map((match) => match[1]);
  const linked = [...doc.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target))
    .map((target) => path.posix.normalize(path.posix.join(path.posix.dirname(docPath), target)));
  return [...backticked, ...linked];
}

describe('documentation stays in sync with the code', () => {
  it(`names every source module in ${ARCHITECTURE_DOC}`, () => {
    const architectureDoc = readRepoFile(ARCHITECTURE_DOC);
    const undocumented = DOCUMENTED_SOURCE_DIRS.flatMap(listFilesRecursively)
      .filter(isSourceModule)
      .filter((file) => !mentionsAsWord(architectureDoc, moduleName(file)))
      .map((file) => `${file} — add "${moduleName(file)}" to ${ARCHITECTURE_DOC}`);

    expect(undocumented).toEqual([]);
  });

  it(`lists every database table in ${ARCHITECTURE_DOC}`, () => {
    const architectureDoc = readRepoFile(ARCHITECTURE_DOC);
    const undocumented = (Object.values(schema) as unknown[])
      .filter((value): value is SQLiteTable => is(value, SQLiteTable))
      .map((table) => getTableConfig(table).name)
      .filter((tableName) => !architectureDoc.includes(`\`${tableName}\``))
      .map((tableName) => `table "${tableName}" — add it to the schema section of ${ARCHITECTURE_DOC}`);

    expect(undocumented).toEqual([]);
  });

  it('only references files and folders that exist', () => {
    const broken = documentationFiles().flatMap((docPath) =>
      referencedPaths(docPath)
        .filter((repoPath) => !repoPathExists(repoPath))
        .map((repoPath) => `${docPath} → ${repoPath}`),
    );

    expect(broken).toEqual([]);
  });

  it('quotes domain constants with their current values', () => {
    const intervals = Object.values(BOX_INTERVAL_DAYS);
    const quotedFacts = [
      {
        doc: ARCHITECTURE_DOC,
        text: `{${Object.entries(BOX_INTERVAL_DAYS).map(([box, days]) => `${box}:${days}`).join(', ')}}`,
      },
      { doc: 'docs/decisions.md', text: intervals.join('/') },
      { doc: 'docs/usage.md', text: `${intervals.filter((days) => days > 0).join(' → ')} days` },
      { doc: ARCHITECTURE_DOC, text: `MEMORIZE_STREAK_THRESHOLD (${MEMORIZE_STREAK_THRESHOLD})` },
      { doc: 'docs/usage.md', text: `${MEMORIZE_STREAK_THRESHOLD}-right streak` },
      { doc: 'docs/decisions.md', text: `${MEMORIZE_STREAK_THRESHOLD}-right streak` },
      { doc: 'README.md', text: `${MEMORIZE_STREAK_THRESHOLD} right answers in a row` },
      { doc: ARCHITECTURE_DOC, text: `DECK_NAME_MAX_LENGTH = ${DECK_NAME_MAX_LENGTH}` },
      { doc: 'docs/usage.md', text: `capped at ${DECK_NAME_MAX_LENGTH} characters` },
      { doc: ARCHITECTURE_DOC, text: `BACKUP_FORMAT_VERSION = ${BACKUP_FORMAT_VERSION}` },
    ];

    const stale = quotedFacts
      .filter(({ doc, text }) => !readRepoFile(doc).includes(text))
      .map(({ doc, text }) => `${doc} should contain "${text}"`);

    expect(stale).toEqual([]);
  });

  it('only mentions npm scripts that exist in package.json', () => {
    const scripts = Object.keys(JSON.parse(readRepoFile('package.json')).scripts);
    const unknown = documentationFiles().flatMap((docPath) =>
      [...readRepoFile(docPath).matchAll(/\bnpm run ([\w:-]+)/g)]
        .map((match) => match[1])
        .filter((script) => !scripts.includes(script))
        .map((script) => `${docPath} → npm run ${script}`),
    );

    expect(unknown).toEqual([]);
  });
});
