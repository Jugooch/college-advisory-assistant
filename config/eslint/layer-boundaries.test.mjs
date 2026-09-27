/**
 * @file Tests that the merged lint config keeps the `./testing` entry points test-only and blocks
 * cross-app imports, including subpaths, whichever flat-config block matches a file last.
 * @see docs/standards/01-repository-structure.md
 */
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** @type {ESLint} */
let eslint;

// NOTE: the first lookup loads every lint plugin, which is slow on some file systems.
beforeAll(async () => {
  eslint = new ESLint({ cwd: ROOT });
  await eslint.calculateConfigForFile('eslint.config.mjs');
}, 120_000);

/**
 * Lints one import statement with the `no-restricted-imports` entry the repo config gives a path.
 *
 * @param {string} path - Repository-relative file path whose config applies.
 * @param {string} specifier - The imported module.
 * @returns {Promise<string[]>} Messages reported for the import; empty when it is allowed.
 */
async function lintImport(path, specifier) {
  const config = await eslint.calculateConfigForFile(path);
  const entry = config.rules?.['no-restricted-imports'];
  if (entry === undefined) {
    return [];
  }
  const linter = new Linter({ configType: 'flat' });
  const results = linter.verify(`import '${specifier}';`, [
    { rules: { 'no-restricted-imports': entry } },
  ]);
  return results.map((result) => result.message);
}

const PRODUCTION_FILES = [
  'apps/api/src/app.ts',
  'apps/api/src/modules/health/health.controller.ts',
  'apps/api/src/modules/health/health.service.ts',
  'apps/api/src/modules/health/health.routes.ts',
  'apps/api/src/testing/fixtures.ts',
  'apps/worker/src/main.ts',
  'apps/web/src/app/page.tsx',
  'apps/web/src/components/ui/button.tsx',
  'packages/domain/src/models/student.model.ts',
  'packages/engine/src/verification/verify.ts',
  'packages/api-contract/src/index.ts',
  'packages/db/src/client.ts',
  'packages/assistant/src/index.ts',
  'packages/test-kit/src/index.ts',
];

describe('test-only ./testing entry points', () => {
  it.each(PRODUCTION_FILES)('forbids @caa/*/testing in %s', async (path) => {
    for (const specifier of ['@caa/api/testing', '@caa/worker/testing', '@caa/db/testing']) {
      const messages = await lintImport(path, specifier);

      expect(messages.join('\n')).toContain('for tests only');
    }
  });

  it.each([
    'apps/api/src/modules/health/health.service.test.ts',
    'apps/worker/src/jobs/import-roster.job.integration.test.ts',
    'apps/web/src/components/ui/button.test.tsx',
    'packages/test-kit/src/builders.test.ts',
    'tests/acceptance/ac01-plan-next-term.test.ts',
    'tests/support/api-harness.ts',
  ])('allows @caa/*/testing in %s', async (path) => {
    const messages = await lintImport(path, '@caa/api/testing');

    expect(messages).toEqual([]);
  });

  it('does not restrict the non-testing subpaths of a library package', async () => {
    const messages = await lintImport('apps/api/src/app.ts', '@caa/domain');

    expect(messages).toEqual([]);
  });
});

describe('app boundaries cover subpaths', () => {
  it.each([
    ['apps/api/src/app.ts', '@caa/worker'],
    ['apps/api/src/modules/health/health.service.ts', '@caa/worker/jobs'],
    ['apps/api/src/modules/health/health.controller.ts', '@caa/web/lib'],
    ['apps/web/src/app/page.tsx', '@caa/worker'],
    ['apps/web/src/components/ui/button.tsx', '@caa/api/app'],
    ['apps/worker/src/main.ts', '@caa/api/container'],
    ['packages/test-kit/src/index.ts', '@caa/worker'],
    ['packages/test-kit/src/index.ts', '@caa/worker/jobs'],
    ['packages/test-kit/src/index.ts', '@caa/api/app'],
  ])('forbids %s from importing %s', async (path, specifier) => {
    const messages = await lintImport(path, specifier);

    expect(messages).toHaveLength(1);
  });
});
