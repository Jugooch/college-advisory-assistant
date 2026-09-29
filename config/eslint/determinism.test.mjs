/**
 * @file Tests that the pure packages, the engine and the domain's shared invariants (ADR-0005),
 * read no clock, randomness, or environment and import no Node built-ins (NFR-01).
 * @see docs/standards/01-repository-structure.md
 * @see docs/adr/0005-shared-invariant-functions-in-domain.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { lintImport, lintWithRules, loadRepoLintConfig } from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, 120_000);

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

  it('keeps the domain import boundary', async () => {
    const messages = await lintImport('packages/domain/src/invariants/example.ts', '@caa/db');

    expect(messages.join('\n')).toContain('domain depends only on zod');
  });
});
