/**
 * @file Guards the known-findings register (docs/standards/07-testing.md, Known findings): every
 *   entry is well formed and matches a golden case or an acceptance test declared through
 *   `acceptanceIt`, and no test file hard-codes `it.fails` or `test.fails`. It lives in `tests/golden/`, like the
 *   holdout isolation test, because it reads the holdout's case IDs.
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 * @see tests/golden/holdout/README.md
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  GOLDEN_DEVELOPMENT_CORPUS,
  GOLDEN_DEVELOPMENT_COUNTING_CORPUS,
  GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS,
} from '@caa/test-kit';

import {
  declaredAcceptanceKeys,
  FINDING_KEY,
  HARD_CODED_EXPECTED_FAILURE,
  KNOWN_FINDINGS,
} from '../support/known-findings';
import { sourceFiles } from '../support/source-files';
import { GOLDEN_HOLDOUT_CORPUS, GOLDEN_HOLDOUT_SCHEDULE_CORPUS } from './holdout/holdout-corpus';

const TESTS_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ACCEPTANCE_FOLDER = join(TESTS_ROOT, 'acceptance');
/**
 * Files that name the forbidden calls to describe the rule, not to use them: this guard and the
 * register's own test, which holds literal examples of the pattern.
 */
const DESCRIBES_THE_RULE = [
  'golden/known-findings-guard.test.ts',
  'support/known-findings.test.ts',
];

/**
 * Lists the test files under a folder.
 *
 * @param folder - Absolute folder path.
 * @returns Absolute file paths.
 */
function testFiles(folder: string): string[] {
  return sourceFiles(folder, (fileName) => fileName.endsWith('.test.ts'));
}

/**
 * Collects every key a finding may name: golden case IDs and declared acceptance tests.
 *
 * @returns The known keys.
 */
function knownKeys(): ReadonlySet<string> {
  return new Set([
    ...GOLDEN_DEVELOPMENT_CORPUS.map((golden) => golden.id),
    ...GOLDEN_DEVELOPMENT_SCHEDULE_CORPUS.map((golden) => golden.id),
    ...GOLDEN_DEVELOPMENT_COUNTING_CORPUS.map((golden) => golden.id),
    ...GOLDEN_HOLDOUT_CORPUS.map((golden) => golden.id),
    ...GOLDEN_HOLDOUT_SCHEDULE_CORPUS.map((golden) => golden.id),
    ...testFiles(ACCEPTANCE_FOLDER).flatMap((path) =>
      declaredAcceptanceKeys(readFileSync(path, 'utf8')),
    ),
  ]);
}

describe('known-findings register', () => {
  it('uses only golden case IDs and ACNN: <title> keys', () => {
    const malformed = [...KNOWN_FINDINGS.keys()].filter((key) => !FINDING_KEY.test(key));

    expect(malformed).toEqual([]);
  });

  it('lists no finding that matches no golden case and no declared acceptance test', () => {
    const known = knownKeys();

    const unmatched = [...KNOWN_FINDINGS.keys()].filter((key) => !known.has(key));

    expect(unmatched).toEqual([]);
  });

  it('leaves expected failures to the register: no test file hard-codes it.fails or test.fails', () => {
    const hardCoded = testFiles(TESTS_ROOT)
      .map((path) => ({
        path: relative(TESTS_ROOT, path).replaceAll('\\', '/'),
        source: readFileSync(path, 'utf8'),
      }))
      .filter(({ path }) => !DESCRIBES_THE_RULE.includes(path))
      .filter(({ source }) => HARD_CODED_EXPECTED_FAILURE.test(source))
      .map(({ path }) => path);

    expect(hardCoded).toEqual([]);
  });
});
