/**
 * @file Vitest helpers over the known-findings register: a listed test runs as `it.fails`, every
 *   other test runs as `it`. Test files never hard-code `it.fails`; they declare tests through
 *   {@link itForFinding} or {@link acceptanceIt}. This module imports Vitest, so Playwright code
 *   reads the register from {@link ./known-findings} instead.
 * @module @caa/tests/support/known-findings-declarations
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 */
import { it } from 'vitest';

import { findingMode } from './known-findings';

/**
 * An `acceptanceIt('ACNN', '<title>', …)` declaration: the case ID, then the title in single or
 * double quotes (Prettier picks double quotes when the title holds an apostrophe). The Playwright
 * helper `acceptanceTest` in `tests/e2e/support` declares keys the same way.
 */
const ACCEPTANCE_DECLARATION =
  /(?:acceptanceIt|acceptanceTest)\(\s*'(AC\d{2})',\s*(['"])((?:\\.|(?!\2)[^\\\n])*)\2/g;

/**
 * Lists the register keys that a test file declares through {@link acceptanceIt}.
 *
 * @param source - The test file's source text.
 * @returns `ACNN: <title>` for each declaration, in source order.
 */
export function declaredAcceptanceKeys(source: string): readonly string[] {
  return [...source.matchAll(ACCEPTANCE_DECLARATION)].map(
    ([, caseId = '', , title = '']) => `${caseId}: ${title.replaceAll(/\\(.)/g, '$1')}`,
  );
}

/**
 * A hard-coded expected failure in a test file, such as `it.fails(`, `test.fails(`,
 * Playwright's `test.fail(` or `it.fails.each(`. Test files declare expected failures through
 * the register instead.
 */
export const HARD_CODED_EXPECTED_FAILURE = /\b(?:it|test)\.fails?\b/;

/**
 * Declares a test that runs as `it.fails` while its key is a known finding, and as `it`
 * otherwise. An expected failure's title names the open issue.
 *
 * @param key - The test's register key.
 * @param title - The test title.
 * @param test - The test body.
 */
export function itForFinding(key: string, title: string, test: () => void | Promise<void>): void {
  const mode = findingMode(key);
  if (mode.kind === 'test') {
    it(title, test);
    return;
  }
  it.fails(`${title} (open finding #${String(mode.issue)})`, test);
}

/**
 * Declares one acceptance test under the register key `<caseId>: <title>`. Pass both arguments as
 * single-quoted string literals: the register guard finds declared keys by reading the source.
 *
 * @param caseId - The acceptance case, for example `AC29`.
 * @param title - The exact test title.
 * @param test - The test body.
 */
export function acceptanceIt(
  caseId: string,
  title: string,
  test: () => void | Promise<void>,
): void {
  itForFinding(`${caseId}: ${title}`, title, test);
}
