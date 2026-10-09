/**
 * @file The check behind AC48's "every academic value shown sits inside a verified block": on a
 *   screen, any credit amount or check-state wording must sit inside a named section, article or
 *   table the app renders from structured fields, and never in the assistant's own chat prose.
 * @module @caa/tests/e2e/support/verified-blocks
 * @requirement AC48
 * @requirement T08
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { expect, type Page } from '@playwright/test';

/** Credit amounts ("3 credits", "Total credits: 12") and the check-state labels the app shows. */
const ACADEMIC_VALUE =
  /\d+(\.\d+)?\s+credits?\b|credits?:\s*\d|Passed as of|Not met\b|Needs verification|Conditional\b|Blocked\b/i;

/** Inside a named section or article, a table or a fact list: a block the app renders from fields. */
const INSIDE_VERIFIED_BLOCK =
  ':is(section[aria-labelledby], article[aria-labelledby], table, dl) *';

/**
 * Fails when the page shows an academic value outside a verified block or inside chat prose.
 * Headings are skipped: a heading names a block and states no value.
 *
 * @param page - The page as it is now.
 */
export async function expectAcademicValuesInVerifiedBlocks(page: Page): Promise<void> {
  const shown = page.getByText(ACADEMIC_VALUE);
  const inChatProse = shown.and(page.locator('.chat-text'));
  const outsideBlocks = shown.and(
    page.locator(`:not(h1, h2, h3, h4, h5, h6, ${INSIDE_VERIFIED_BLOCK})`),
  );

  expect(await inChatProse.allTextContents(), 'academic value in chat prose').toEqual([]);
  expect(await outsideBlocks.allTextContents(), 'academic value outside a verified block').toEqual(
    [],
  );
}
