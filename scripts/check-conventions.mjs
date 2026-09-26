/**
 * @file Enforces the conventions ESLint cannot express: file roles per folder and comment tags.
 * @module scripts/check-conventions
 * @see docs/standards/01-repository-structure.md
 * @see docs/standards/03-comments.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// ---- Structure rules ----

const TEST = String.raw`(\.test)?`;

/**
 * Where each kind of file must live. The first rule whose `scope` matches a path applies.
 * `allow` receives the file name and the scope match, and returns true when the name is valid.
 */
const STRUCTURE_RULES = [
  {
    scope: /^apps\/web\/src\/app\/.*route\.tsx?$/,
    allow: () => false,
    expected: 'no route handlers in Next.js; add the endpoint to apps/api',
  },
  {
    scope: /^apps\/api\/src\/modules\/([a-z0-9-]+)\/[^/]+$/,
    allow: (name, match) =>
      new RegExp(`^${match[1]}\\.(routes|controller|service|mapper)${TEST}\\.ts$`).test(name),
    expected:
      '<module>.routes.ts | <module>.controller.ts | <module>.service.ts | <module>.mapper.ts',
  },
  {
    scope: /^apps\/api\/src\/plugins\//,
    allow: (name) => /\.plugin(\.test)?\.ts$/.test(name),
    expected: '*.plugin.ts',
  },
  {
    scope: /^apps\/api\/src\/[^/]+$/,
    allow: (name) => /^(server|app|container)(\.test)?\.ts$/.test(name),
    expected:
      'server.ts | app.ts | container.ts (other code goes in modules/, plugins/, shared/, config/)',
  },
  {
    scope: /^packages\/domain\/src\/models\//,
    allow: (name) => /\.model(\.test)?\.ts$/.test(name),
    expected: '*.model.ts',
  },
  {
    scope: /^packages\/domain\/src\/enums\//,
    allow: (name) => /\.enum(\.test)?\.ts$/.test(name),
    expected: '*.enum.ts',
  },
  {
    scope: /^packages\/api-contract\/src\/contracts\//,
    allow: (name) => /\.contract(\.test)?\.ts$/.test(name),
    expected: '*.contract.ts',
  },
  {
    scope: /^packages\/db\/src\/tables\//,
    allow: (name) => /\.table\.ts$/.test(name),
    expected: '*.table.ts',
  },
  {
    scope: /^packages\/db\/src\/mappers\//,
    allow: (name) => /\.mapper(\.test)?\.ts$/.test(name),
    expected: '*.mapper.ts',
  },
  {
    scope: /^packages\/db\/src\/repositories\//,
    allow: (name) => /\.repository(\.test)?\.ts$/.test(name),
    expected: '*.repository.ts',
  },
  {
    scope: /^apps\/worker\/src\/jobs\//,
    allow: (name) => /\.job(\.test)?\.ts$/.test(name),
    expected: '*.job.ts',
  },
  {
    scope: /^apps\/worker\/src\/adapters\//,
    allow: (name) => /\.adapter(\.test)?\.ts$/.test(name),
    expected: '*.adapter.ts',
  },
  {
    scope: /^apps\/web\/src\/app\//,
    allow: (name) =>
      /^(page|layout|loading|error|not-found|global-error|template|default)\.tsx$/.test(name) ||
      /^(globals\.css|[a-z0-9-]+\.module\.css|favicon\.ico|icon\.(png|svg))$/.test(name),
    expected:
      'Next.js reserved files only (page.tsx, layout.tsx, ...); put UI in features/ or components/',
  },
  {
    scope: /^apps\/web\/src\/api\//,
    allow: (name) => /\.api(\.test)?\.ts$/.test(name),
    expected: '*.api.ts',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/hooks\//,
    allow: (name) => /^use-[a-z0-9-]+(\.test)?\.tsx?$/.test(name),
    expected: 'use-*.ts',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/components\//,
    allow: (name) => /(\.test)?\.tsx$/.test(name),
    expected: '*.tsx',
  },
  {
    scope: /^apps\/web\/src\/features\/[a-z0-9-]+\/[^/]+$/,
    allow: () => false,
    expected: 'files inside features/<name>/components/, hooks/, or utils/',
  },
  {
    scope: /^apps\/web\/src\/components\//,
    allow: (name) => /(\.test)?\.tsx$/.test(name),
    expected: '*.tsx',
  },
  {
    scope: /^tests\/acceptance\//,
    allow: (name) => /^ac\d{2}-[a-z0-9-]+\.test\.ts$/.test(name) || name === 'README.md',
    expected: 'acNN-short-description.test.ts',
  },
  {
    scope: /^(apps|packages)\/[^/]+\/src\/.+\/index\.ts$/,
    allow: () => false,
    expected: 'no nested index.ts barrels; only <package>/src/index.ts',
  },
];

/**
 * Checks one path against the structure rules.
 *
 * @param {string} path - Repository-relative path.
 * @returns {string | null} A problem description, or null when the file is placed correctly.
 */
function checkStructure(path) {
  const name = basename(path);
  if (name === '.gitkeep') {
    return null;
  }
  for (const rule of STRUCTURE_RULES) {
    const match = path.match(rule.scope);
    if (match) {
      return rule.allow(name, match)
        ? null
        : `misplaced or misnamed file; expected ${rule.expected}`;
    }
  }
  return null;
}

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
    found.push(
      ...checkComments(readFileSync(path, 'utf8')).map((problem) => `${path}: ${problem}`),
    );
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
