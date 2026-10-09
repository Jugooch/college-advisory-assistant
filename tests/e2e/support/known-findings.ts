/**
 * @file Declares a Playwright test under the known-findings register (docs/standards/07-testing.md):
 *   it runs as `test.fail` while `tests/support/known-findings.ts` lists its key, and as a plain
 *   test otherwise. E2e files never hard-code `test.fail`; the register guard checks.
 * @module @caa/tests/e2e/support/known-findings
 * @requirement T08
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import { type Page, test } from '@playwright/test';

import { findingMode } from '../../support/known-findings-register';

/**
 * Declares one acceptance e2e test under the register key `<caseId>: <title>`. Pass both
 * arguments as single-quoted string literals: the register guard finds declared keys by reading
 * the source.
 *
 * @param caseId - The acceptance case, for example `AC48`.
 * @param title - The exact test title.
 * @param body - The test body.
 */
export function acceptanceTest(
  caseId: string,
  title: string,
  body: (args: { page: Page }) => Promise<void>,
): void {
  const mode = findingMode(`${caseId}: ${title}`);
  if (mode.kind === 'test') {
    test(title, body);
    return;
  }
  test.fail(`${title} (open finding #${String(mode.issue)})`, body);
}
