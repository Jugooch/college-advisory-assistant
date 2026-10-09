/**
 * @file Smoke case for the e2e harness: the sign-in page and the student overview load, and both
 *   pass axe with the WCAG 2.2 AA tags.
 * @requirement T08
 * @requirement NFR-02
 */
import { expect, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { signInAs } from './support/sign-in';

test('the sign-in page loads and passes axe', async ({ page }) => {
  await page.goto('/dev/sign-in');

  await expect(page.getByRole('heading', { level: 1, name: 'Development sign-in' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('the student overview loads after sign-in and passes axe', async ({ page }) => {
  await signInAs(page, 'student');
  await page.goto('/overview');

  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('the axe helper fails on an image with no alternative text, naming the rule and target', async ({
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

test('the axe helper passes a page with no violations', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Fixture</title></head>' +
      '<body><main><h1>Fixture</h1><p>Plain text.</p></main></body></html>',
  );

  await expectNoAxeViolations(page);
});
