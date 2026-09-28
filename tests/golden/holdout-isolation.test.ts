/**
 * @file Keeps the frozen holdout apart from development: nothing outside `tests/golden/` imports it,
 *   and it shares no case ID or input set with the development corpus.
 * @requirement NFR-01
 * @see tests/golden/holdout/README.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GOLDEN_DEVELOPMENT_CORPUS } from '@caa/test-kit';

import { GOLDEN_HOLDOUT_CORPUS } from './holdout/holdout-corpus';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The only folder whose files may import the holdout. */
const ALLOWED_FOLDER = 'tests/golden/';
/** A module specifier that points at a holdout file. */
const HOLDOUT_SPECIFIER =
  /['"][^'"]*(golden\/holdout|holdout-corpus|holdout-[a-z-]+\.cases)[^'"]*['"]/;
const SKIPPED_FOLDERS = ['node_modules', 'dist', '.next', 'coverage'];

/**
 * Lists the TypeScript files under a folder, skipping dependencies and build output.
 *
 * @param folder - Absolute folder path.
 * @returns Absolute file paths.
 */
function typeScriptFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_FOLDERS.includes(entry.name) ? [] : typeScriptFiles(path);
    }
    return /\.(tsx?|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe('golden holdout isolation', () => {
  it('is imported by nothing outside tests/golden/', () => {
    const importers = ['packages', 'apps', 'tests']
      .flatMap((root) => typeScriptFiles(join(REPO_ROOT, root)))
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
