/**
 * @file Proves the axe helper fails on an injected violation and names the rule id and target.
 *   The page is a fixture, so this case needs a browser but no running app.
 * @requirement T08
 * @requirement NFR-02
 */
import { expect, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';

test('fails on an image with no alternative text, naming the rule and the target', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Fixture</title></head>' +
      '<body><main><h1>Fixture</h1><img id="injected" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>',
  );

  const failure = await expectNoAxeViolations(page).then(
    () => '',
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

  expect(failure).toContain('image-alt');
  expect(failure).toContain('#injected');
});

test('passes a page with no violations', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Fixture</title></head>' +
      '<body><main><h1>Fixture</h1><p>Plain text.</p></main></body></html>',
  );

  await expectNoAxeViolations(page);
});
