/**
 * @file Tests that the pure packages, the engine and the domain's shared invariants (ADR-0005),
 * read no clock, randomness, or environment and import no Node built-ins (NFR-01), and that they
 * and api `.logic.ts` files use no timers, locale data, or sorts without a comparator
 * (standards/01 §Determinism in pure code).
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0005-shared-invariant-functions-in-domain.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintImport,
  lintWithRules,
  lintWithTypes,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, LINT_CONFIG_LOAD_TIMEOUT_MS);

const RULES = ['no-restricted-properties', 'no-restricted-syntax', 'no-restricted-globals'];

/** Production and test files of each pure package; the syntax bans apply to both. */
const PURE_FILES = [
  'packages/engine/src/verification/example.ts',
  'packages/engine/src/verification/example.test.ts',
  'packages/domain/src/invariants/example.ts',
  'packages/domain/src/models/example.model.ts',
  'packages/domain/src/invariants/example.test.ts',
];

/** Production files of each pure package, where Node built-in imports are also banned. */
const PURE_PRODUCTION_FILES = PURE_FILES.filter((path) => !path.endsWith('.test.ts'));

const NONDETERMINISTIC = [
  ['Date.now()', 'NFR-01'],
  ['Math.random()', 'NFR-01'],
  ['Date()', 'reads the clock'],
  ['new Date()', 'new Date() reads the clock'],
  ['new Date', 'new Date() reads the clock'],
  ['crypto.randomUUID()', 'no randomness'],
  ['performance.now()', 'reads no clock'],
  ['process.env.X', 'no environment'],
];

/** Every pure-code role: the pure packages plus api `.logic.ts` files (ADR-0008). */
const PURE_CODE_FILES = [...PURE_FILES, 'apps/api/src/modules/x/x.logic.ts'];

/** Locale and timer uses that standards/01 §Determinism in pure code bans in every pure role. */
const LOCALE_AND_TIMERS = [
  ['setTimeout(run, 0)', 'no timers'],
  ['setInterval(run, 10)', 'no timers'],
  ['setImmediate(run)', 'no timers'],
  ["new Intl.Collator('en')", 'Intl depends on locale data'],
  ['Intl.DateTimeFormat', 'Intl depends on locale data'],
  ["a.localeCompare('b')", 'localeCompare depends on locale data'],
];

const SORT_RULE = ['@typescript-eslint/require-array-sort-compare'];

/** Sorts that must name a comparator: anything but a string array (standards/01). */
const UNORDERED_SORTS = [
  'export const f = (xs: number[]) => xs.sort();',
  'export const f = (xs: number[]) => xs.toSorted();',
  'export const f = (xs: { id: string }[]) => [...xs].sort();',
];

/** Sorts that are deterministic: a comparator, or UTF-16 code-unit order on strings. */
const ORDERED_SORTS = [
  'export const f = (xs: string[]) => xs.sort();',
  'export const f = (xs: string[]) => xs.toSorted();',
  'export const f = (xs: number[]) => xs.toSorted((a, b) => a - b);',
  'export const f = (xs: string[]) => xs.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));',
];

describe.each(PURE_CODE_FILES)('%s uses no locale, timers, or unordered sorts', (path) => {
  it.each(LOCALE_AND_TIMERS)('forbids %s', async (expression, message) => {
    const messages = await lintWithRules(path, `export const x = ${expression};`, RULES);

    expect(messages.join('\n')).toContain(message);
  });

  it.each(UNORDERED_SORTS)('forbids %s', async (code) => {
    expect(await lintWithTypes(path, code, SORT_RULE)).toHaveLength(1);
  });

  it.each(ORDERED_SORTS)('allows %s', async (code) => {
    expect(await lintWithTypes(path, code, SORT_RULE)).toEqual([]);
  });

  it('allows ordering strings with < and >', async () => {
    const code = 'export const before = (a: string, b: string) => a < b;';

    expect(await lintWithRules(path, code, RULES)).toEqual([]);
  });
});

describe.each(PURE_FILES)('%s reads no clock, randomness, or environment', (path) => {
  it.each(NONDETERMINISTIC)('forbids %s', async (expression, message) => {
    const messages = await lintWithRules(path, `export const x = ${expression};`, RULES);

    expect(messages.join('\n')).toContain(message);
  });

  it('allows parsing a given time and keeps the language syntax bans', async () => {
    const allowed = await lintWithRules(path, 'export const at = new Date(value);', RULES);
    const banned = await lintWithRules(path, 'enum Color { Red }', RULES);

    expect(allowed).toEqual([]);
    expect(banned.join('\n')).toContain('as const');
  });
});

describe.each(PURE_PRODUCTION_FILES)('%s imports no Node built-ins', (path) => {
  it.each(['node:crypto', 'crypto', 'node:perf_hooks', 'fs', 'node:process'])(
    'forbids %s',
    async (specifier) => {
      expect((await lintImport(path, specifier)).join('\n')).toContain('NFR-01');
    },
  );

  it.each(['zod', './other'])('still allows %s', async (specifier) => {
    expect(await lintImport(path, specifier)).toEqual([]);
  });
});

describe('other packages keep their clock and environment access', () => {
  it.each([
    'packages/db/src/client.ts',
    'packages/api-contract/src/index.ts',
    'apps/api/src/app.ts',
    'apps/worker/src/main.ts',
  ])('allows Date.now(), new Date() and process.env in %s', async (path) => {
    const code = 'export const x = [Date.now(), new Date(), process.env.X];';

    expect(await lintWithRules(path, code, RULES)).toEqual([]);
  });

  it.each(['packages/db/src/client.ts', 'apps/api/src/modules/x/x.service.ts'])(
    'allows timers, locale data, and a bare numeric sort in %s',
    async (path) => {
      const code =
        "export const x = [setTimeout(run, 0), Intl.DateTimeFormat, a.localeCompare('b')];";
      const sort = 'export const f = (xs: number[]) => xs.sort();';

      expect(await lintWithRules(path, code, RULES)).toEqual([]);
      expect(await lintWithTypes(path, sort, SORT_RULE)).toEqual([]);
    },
  );

  it('keeps the domain import boundary', async () => {
    const messages = await lintImport('packages/domain/src/invariants/example.ts', '@caa/db');

    expect(messages.join('\n')).toContain('domain depends only on zod');
  });
});
