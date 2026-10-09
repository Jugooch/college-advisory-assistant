/**
 * @file The student's side of a plan-review case, driven only through the screens: clear any open
 *   case the student already has (the saved draft allows one open case per plan), save a draft for
 *   the planning term, and send it to the advisor. AC49 uses it so it never depends on the state
 *   another case left behind.
 * @module @caa/tests/e2e/support/student-case
 * @requirement AC49
 * @requirement FR-12
 * @requirement T08
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { expect, type Page } from '@playwright/test';

import { expectNoAxeViolations } from './axe';

/** How long a search, a save or a case submission may take in CI before the step fails. */
const SLOW_STEP_MS = 30_000;

/** The term code the student plans for, as the term picker names it. */
const PLANNING_TERM_CODE = '2027SP';

/**
 * The four courses the student plans together. With the variable-credit course at two credits
 * they total the term's 12.00 minimum (README, sample record walkthrough step 3).
 */
const PLANNED_COURSE_CODES: readonly RegExp[] = [
  /DEMO-MATH 102/,
  /DEMO-PHYS 301/,
  /DEMO-ENGL 101/,
  /DEMO-IND 390/,
];

/** The course that offers a credit choice, and the credits the student enters for it. */
const VARIABLE_CREDIT_COURSE = 'DEMO-IND 390';
const VARIABLE_CREDIT_CHOICE = '2.00';

/** An ISO 8601 timestamp in UTC, as the `datetime` attribute of a shown time carries it. */
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** What the student saw when the draft was saved: the revision and the time shown for it. */
export interface SavedDraft {
  readonly revision: number;
  /** The `datetime` value of the saved time, an ISO 8601 timestamp. */
  readonly savedAtIso: string;
}

/**
 * Opens a screen from the student navigation.
 *
 * @param page - The browser page, signed in as the student.
 * @param label - The link's name.
 */
async function openStudentScreen(page: Page, label: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Student' })
    .getByRole('link', { name: label })
    .click();
}

/**
 * Waits until Help and cases has loaded the student's cases. The page heading also shows on the
 * loading screen, so the wait is for a link only the loaded page has.
 *
 * @param page - The browser page.
 */
async function waitForCaseList(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Report a problem with my record' })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
}

/**
 * Withdraws every open case the student has, so the saved draft can take a new one. A withdrawn
 * case is final, and a new question opens a new case.
 *
 * @param page - The browser page, signed in as the student.
 */
export async function withdrawOpenCases(page: Page): Promise<void> {
  await openStudentScreen(page, 'Help and cases');
  await waitForCaseList(page);
  const withdraw = page.getByRole('button', { name: 'Withdraw this case' });
  while ((await withdraw.count()) > 0) {
    await withdraw.first().click();
    await expect(page.getByText('Case withdrawn. No one will review it.')).toBeVisible({
      timeout: SLOW_STEP_MS,
    });
    await page.reload();
    await waitForCaseList(page);
  }
}

/**
 * Plans the term and saves the first option as a draft.
 *
 * @param page - The browser page, signed in as the student.
 * @returns The revision and the saved time the student saw.
 */
export async function saveDraftForPlanningTerm(page: Page): Promise<SavedDraft> {
  await openStudentScreen(page, 'Plan next term');
  await expect(page.getByRole('heading', { level: 1, name: 'Plan next term' })).toBeVisible();
  const term = page.getByLabel('Term', { exact: true });
  const value = await term.locator('option', { hasText: PLANNING_TERM_CODE }).getAttribute('value');
  await term.selectOption(value);
  await page.getByRole('button', { name: 'Review constraints' }).click();

  const courses = page.getByRole('group', { name: 'Courses to schedule' });
  for (const code of PLANNED_COURSE_CODES) {
    await courses.getByRole('checkbox', { name: code }).check();
  }
  await page.getByLabel(`Credits for ${VARIABLE_CREDIT_COURSE}`).fill(VARIABLE_CREDIT_CHOICE);
  await page.getByRole('button', { name: 'Review constraints' }).click();
  await expect(page.getByRole('heading', { name: 'Review your constraints' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm and find schedules' }).click();

  await page.getByRole('button', { name: 'Save as draft' }).first().click();
  const saved = page.locator('.notice').filter({
    hasText: 'Draft saved. This is a plan, not a registration.',
  });
  await expect(saved).toBeVisible({ timeout: SLOW_STEP_MS });
  const revisionText = await saved.getByText(/Revision \d+, saved/).innerText();
  const savedAtIso = await saved.locator('time').first().getAttribute('datetime');
  await expectNoAxeViolations(page);
  const revision = /Revision (\d+)/.exec(revisionText)?.[1];
  expect(revision, 'the saved draft names its revision').toBeDefined();
  expect(savedAtIso, 'the saved draft shows its saved time').toMatch(ISO_TIMESTAMP);
  return { revision: Number(revision), savedAtIso: savedAtIso ?? '' };
}

/**
 * Sends the saved draft to the advisor as a plan-review case, from the draft's row in My plans.
 *
 * @param page - The browser page, signed in as the student, after the draft was saved.
 * @param note - The student's note for the advisor.
 */
export async function sendPlanReviewCase(page: Page, note: string): Promise<void> {
  await openStudentScreen(page, 'My plans');
  await expect(page.getByRole('heading', { level: 1, name: 'My plans' })).toBeVisible();
  await page.getByRole('link', { name: /Ask an advisor/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ask an advisor' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Review my plan' })).toBeChecked();
  await page.getByLabel('Your note for your advisor').fill(note);
  await page.getByRole('button', { name: 'Send to my advisor' }).click();

  await expect(page.getByText('Case opened.')).toBeVisible({ timeout: SLOW_STEP_MS });
  await expectNoAxeViolations(page);
}
