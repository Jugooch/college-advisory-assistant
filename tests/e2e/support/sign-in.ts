/**
 * @file Signs a browser in through the development sign-in page, the way a person would. It never
 *   sets cookies by hand, so the session the test uses is the one the app issues.
 * @module @caa/tests/e2e/support/sign-in
 * @requirement T08
 * @requirement FR-01
 */
import { expect, type Page } from '@playwright/test';

/** The dev tokens from `DEV_AUTH_TOKENS` in `infra/env.example`. */
export const DEV_TOKENS = {
  admin: 'dev-token-admin',
  advisor: 'dev-token-advisor',
  advisorTwo: 'dev-token-advisor-2',
  student: 'dev-token-student',
} as const;

/** A dev token name. */
export type DevPersona = keyof typeof DEV_TOKENS;

/**
 * Signs in through `/dev/sign-in` and waits until the app leaves that page.
 *
 * @param page - The browser page.
 * @param persona - Whose dev token to submit.
 */
export async function signInAs(page: Page, persona: DevPersona): Promise<void> {
  await page.goto('/dev/sign-in');
  await page.getByLabel('Dev token').fill(DEV_TOKENS[persona]);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/dev\/sign-in/);
}
