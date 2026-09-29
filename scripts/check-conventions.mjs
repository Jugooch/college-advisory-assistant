/**
 * @file Enforces the conventions ESLint cannot express: file roles per folder and comment tags.
 * @module scripts/check-conventions
 * @see docs/standards/01-repository-structure.md
 * @see docs/standards/03-comments.md
 * @see docs/standards/06-frontend.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { checkServerDirective } from './lib/server-directive-rules.mjs';
import { checkStructure } from './lib/structure-rules.mjs';
import { checkTestingExport } from './lib/testing-entry-rules.mjs';

// ---- Comment rules ----

const TAG_WORDS = ['TO' + 'DO', 'FIX' + 'ME'];
const TRACKED_TAG = new RegExp(`\\b(${TAG_WORDS.join('|')})\\b(?!\\(#\\d+\\): )`);
const BANNED_TAG = new RegExp(`\\b(${['HA' + 'CK', 'X' + 'XX'].join('|')})\\b`);
const INLINE_TAG = /^\s*\/\/\s*([A-Z]{2,})(\([^)]*\))?:/;
const ALLOWED_INLINE_TAGS = new Set(['NOTE', 'SAFETY', 'SECURITY', 'PERF', ...TAG_WORDS]);
const DIVIDER_LIKE = /^\s*(\/\/|\/\*)\s*[-=*#~]{3,}/;
const DIVIDER = /^\s*\/\/ ---- [A-Z].*\S ----$/;

/**
 * Checks the comment conventions in one file's source.
 *
 * @param {string} source - File contents.
 * @returns {string[]} Problems, each prefixed with its line number.
 */
function checkComments(source) {
  return source.split('\n').flatMap((line, index) => {
    const at = `line ${index + 1}`;
    const tag = line.match(INLINE_TAG)?.[1];
    if (TRACKED_TAG.test(line)) return [`${at}: task tags must read "${TAG_WORDS[0]}(#123): ..."`];
    if (BANNED_TAG.test(line))
      return [`${at}: banned tag; open an issue and use ${TAG_WORDS[0]}(#123)`];
    if (tag && !ALLOWED_INLINE_TAGS.has(tag))
      return [`${at}: unknown tag ${tag}; use ${[...ALLOWED_INLINE_TAGS].join(', ')}`];
    if (DIVIDER_LIKE.test(line) && !DIVIDER.test(line))
      return [`${at}: section dividers must read "// ---- Title ----"`];
    return [];
  });
}

// ---- Run ----

const SELF = 'scripts/check-conventions.mjs';
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((path) => path && !path.startsWith('docs/planning/'));

const problems = files.flatMap((path) => {
  const structure = checkStructure(path);
  const found = structure ? [`${path}: ${structure}`] : [];
  if (/\.(ts|tsx|mjs|css)$/.test(path) && path !== SELF) {
    const source = readFileSync(path, 'utf8');
    found.push(...checkComments(source).map((problem) => `${path}: ${problem}`));
    const directive = checkServerDirective(path, source);
    if (directive) found.push(`${path}: ${directive}`);
  }
  if (path === 'package.json' || path.endsWith('/package.json')) {
    const testingExport = checkTestingExport(path, JSON.parse(readFileSync(path, 'utf8')));
    if (testingExport) found.push(`${path}: ${testingExport}`);
  }
  return found;
});

if (problems.length > 0) {
  console.error(
    `Convention check failed (${problems.length}):\n${problems.map((p) => `  ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(`Convention check passed for ${files.length} files.`);
