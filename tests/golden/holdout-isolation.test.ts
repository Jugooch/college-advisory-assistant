/**
 * @file Keeps the frozen holdout apart from development: no package or app source imports it, and
 *   it shares no case ID or input set with the development corpus.
 * @requirement NFR-01
 * @see packages/test-kit/src/golden/holdout/README.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GOLDEN_DEVELOPMENT_CORPUS } from '@caa/test-kit';
import { GOLDEN_HOLDOUT_CORPUS } from '@caa/test-kit/golden-holdout';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HOLDOUT_FOLDER = 'packages/test-kit/src/golden/holdout/';
const HOLDOUT_IMPORT = /golden-holdout|golden\/holdout/;

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
      return ['node_modules', 'dist', '.next'].includes(entry.name) ? [] : typeScriptFiles(path);
    }
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Lists the source folders of every package and app.
 *
 * @returns Absolute `src` folder paths.
 */
function workspaceSourceFolders(): string[] {
  return ['packages', 'apps'].flatMap((group) =>
    readdirSync(join(REPO_ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(REPO_ROOT, group, entry.name, 'src')),
  );
}

describe('golden holdout isolation', () => {
  it('is imported by no package or app source outside the holdout folder', () => {
    const importers = workspaceSourceFolders()
      .flatMap((folder) => {
        try {
          return typeScriptFiles(folder);
        } catch {
          return [];
        }
      })
      .map((path) => relative(REPO_ROOT, path).replaceAll('\\', '/'))
      .filter((path) => !path.startsWith(HOLDOUT_FOLDER))
      .filter((path) => HOLDOUT_IMPORT.test(readFileSync(join(REPO_ROOT, path), 'utf8')));

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
