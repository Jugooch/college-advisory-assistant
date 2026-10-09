/**
 * @file The accessibility check every e2e step that shows a new page or chat result runs: axe
 *   with the WCAG 2.2 AA tags (ADR-0016 §2) and no disabled rule. Any violation fails the test.
 * @module @caa/tests/e2e/support/axe
 * @requirement T08
 * @requirement NFR-02
 * @see docs/adr/0016-browser-end-to-end-tests-and-local-demo.md
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

import { formatAxeViolations } from './axe-violations';

/** The axe tag set for WCAG 2.2 AA. */
export const WCAG_22_AA_TAGS: readonly string[] = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

/**
 * Fails the test when axe finds any violation on the page as it is now.
 *
 * @param page - The page to check.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_22_AA_TAGS]).analyze();
  expect(results.violations.length, formatAxeViolations(results.violations)).toBe(0);
}
