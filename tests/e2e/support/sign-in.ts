/**
 * @file Signs a browser in through the development sign-in page, the way a person would. It never
 *   sets cookies by hand, so the session the test uses is the one the app issues.
 * @module @caa/tests/e2e/support/sign-in
 * @requirement T08
 * @requirement FR-01
 */
import { expect, type Page } from '@playwright/test';

import { DEV_PERSONAS, type DevPersona } from './personas';

/**
 * Signs in through `/dev/sign-in` and waits until the app leaves that page.
 *
 * @param page - The browser page.
 * @param persona - Whose dev token to submit.
 */
export async function signInAs(page: Page, persona: DevPersona): Promise<void> {
  await page.goto('/dev/sign-in');
  await page.getByLabel('Dev token').fill(DEV_PERSONAS[persona].token);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/dev\/sign-in/);
}
