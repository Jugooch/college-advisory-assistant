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
