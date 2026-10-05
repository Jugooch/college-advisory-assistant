/**
 * @file Keeps the frozen holdout apart from development: nothing outside `tests/golden/` imports it,
 *   and it shares no case ID or input set with the development corpus.
 * @requirement NFR-01
 * @see tests/golden/holdout/README.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GOLDEN_DEVELOPMENT_CORPUS } from '@caa/test-kit';

import { sourceFiles } from '../support/source-files';
import { GOLDEN_HOLDOUT_CORPUS, GOLDEN_HOLDOUT_SCHEDULE_CORPUS } from './holdout/holdout-corpus';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The only folder whose files may import the holdout. */
const ALLOWED_FOLDER = 'tests/golden/';
/** A module specifier that points at a holdout file. */
const HOLDOUT_SPECIFIER =
  /['"][^'"]*(golden\/holdout|holdout-corpus|holdout-[a-z-]+\.cases)[^'"]*['"]/;

/**
 * Tells whether a file name is TypeScript or an ES module script.
 *
 * @param fileName - The file name.
 * @returns `true` for `.ts`, `.tsx` and `.mjs` files.
 */
function isScript(fileName: string): boolean {
  return /\.(tsx?|mjs)$/.test(fileName);
}

describe('golden holdout isolation', () => {
  it('is imported by nothing outside tests/golden/', () => {
    const importers = ['packages', 'apps', 'tests']
      .flatMap((root) => sourceFiles(join(REPO_ROOT, root), isScript))
      .map((path) => relative(REPO_ROOT, path).replaceAll('\\', '/'))
      .filter((path) => !path.startsWith(ALLOWED_FOLDER))
      .filter((path) => HOLDOUT_SPECIFIER.test(readFileSync(join(REPO_ROOT, path), 'utf8')));

    expect(importers).toEqual([]);
  });

  it('shares no case ID with the development corpus', () => {
    const developmentIds = new Set(GOLDEN_DEVELOPMENT_CORPUS.map((golden) => golden.id));

    expect(GOLDEN_HOLDOUT_CORPUS.filter((golden) => developmentIds.has(golden.id))).toEqual([]);
    expect(GOLDEN_HOLDOUT_CORPUS.every((golden) => golden.id.startsWith('GH-'))).toBe(true);
  });

  it('keeps scheduling holdout IDs in the GH- scheme and apart from the check holdout', () => {
    const checkIds = new Set(GOLDEN_HOLDOUT_CORPUS.map((golden) => golden.id));

    expect(GOLDEN_HOLDOUT_SCHEDULE_CORPUS.filter((golden) => checkIds.has(golden.id))).toEqual([]);
    expect(GOLDEN_HOLDOUT_SCHEDULE_CORPUS.every((golden) => golden.id.startsWith('GH-'))).toBe(
      true,
    );
  });

  it('shares no input set with the development corpus', () => {
    const developmentInputs = new Set(
      GOLDEN_DEVELOPMENT_CORPUS.map((golden) => JSON.stringify([golden.check, golden.inputs])),
    );

    const repeated = GOLDEN_HOLDOUT_CORPUS.filter((golden) =>
      developmentInputs.has(JSON.stringify([golden.check, golden.inputs])),
    );

    expect(repeated.map((golden) => golden.id)).toEqual([]);
  });
});
