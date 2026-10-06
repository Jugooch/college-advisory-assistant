/**
 * @file Tests that app test support may import only `@caa/db/testing`, and that production files
 * cannot import it (ADR-0009 Amendment 1).
 * @see docs/standards/01-repository-structure.md
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  LINT_CONFIG_LOAD_TIMEOUT_MS,
  lintImport,
  loadRepoLintConfig,
} from './lint-test-harness.mjs';

beforeAll(loadRepoLintConfig, LINT_CONFIG_LOAD_TIMEOUT_MS);

describe('app test support (ADR-0009 Amendment 1)', () => {
  it.each([
    'apps/api/src/testing/x.ts',
    'apps/api/src/testing.ts',
    'apps/worker/src/testing.ts',
    'apps/worker/src/testing/x.ts',
  ])('allows @caa/db/testing in %s', async (path) => {
    expect(await lintImport(path, '@caa/db/testing')).toEqual([]);
  });

  it.each([
    ['apps/api/src/testing/x.ts', '@caa/api-contract/testing'],
    ['apps/api/src/testing/x.ts', '@caa/worker/testing'],
    ['apps/worker/src/testing.ts', '@caa/api/testing'],
    ['apps/worker/src/testing/x.ts', '@caa/api-contract/testing'],
  ])('keeps other testing entries banned in %s (%s)', async (path, specifier) => {
    expect((await lintImport(path, specifier)).length).toBeGreaterThan(0);
  });

  it.each([
    'apps/api/src/modules/x/x.service.ts',
    'apps/api/src/modules/x/x.controller.ts',
    'apps/api/src/modules/x/x.logic.ts',
    'apps/api/src/app.ts',
    'apps/worker/src/main.ts',
  ])('keeps the TEST_ONLY message for @caa/db/testing in %s', async (path) => {
    expect((await lintImport(path, '@caa/db/testing')).join('\n')).toContain('for tests only');
  });

  it.each([
    ['apps/api/src/modules/x/x.service.ts', '../../testing/fixtures'],
    ['apps/api/src/modules/x/x.service.ts', '../../testing'],
    ['apps/api/src/app.ts', './testing'],
    ['apps/api/src/modules/x/x.logic.ts', '../../testing/fixtures'],
    ['apps/worker/src/main.ts', './testing'],
    ['apps/worker/src/jobs/x.job.ts', '../testing/fixtures'],
  ])('forbids production file %s from importing %s', async (path, specifier) => {
    expect((await lintImport(path, specifier)).join('\n')).toContain('standards/01');
  });

  it.each([
    ['apps/api/src/modules/x/x.service.test.ts', '../../testing/fixtures'],
    ['apps/api/src/testing/x.ts', './fixtures'],
    ['apps/api/src/testing/x.ts', '../testing'],
    ['apps/worker/src/jobs/x.job.test.ts', '../testing'],
  ])('allows %s to import %s', async (path, specifier) => {
    expect(await lintImport(path, specifier)).toEqual([]);
  });
});
