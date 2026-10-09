/**
 * @file AC49: the advisor flow in a browser. The student saves a draft and sends a plan-review
 *   case through the screens. The assigned advisor finds it in the review queue, opens it and sees
 *   the pinned plan revision with the time the student saved it, claims it (a second claim from a
 *   stale page shows the conflict and changes nothing) and resolves it with a note. An advisor
 *   with no assignment sees neither the case in the queue nor a different result for its address
 *   than for a missing case. The student then reads the resolution labelled as advice, not
 *   permission to enroll. Every step that shows a new page or result passes axe.
 * @requirement AC49
 * @requirement FR-12
 * @requirement NFR-02
 * @requirement T08
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { acceptanceTest } from './support/known-findings';
import { signInAs } from './support/sign-in';
import {
  ISO_TIMESTAMP,
  type SavedDraft,
  saveDraftForPlanningTerm,
  sendPlanReviewCase,
  withdrawOpenCases,
} from './support/student-case';
import { expectAcademicValuesInVerifiedBlocks } from './support/verified-blocks';

/** The whole flow's time limit, well above Playwright's 30 s default. */
const FLOW_TIMEOUT_MS = 240_000;

/** How long a save, a claim or a resolve may take in CI before the step fails. */
const SLOW_STEP_MS = 30_000;

/** The student's note and the advisor's note, stated here and looked for on the other side. */
const STUDENT_NOTE = 'Please check my plan for next term before I register.';
const ADVISOR_NOTE = 'Your plan looks reasonable. Bring it to our next meeting.';

/** A case address no case has, in the shape the app accepts. */
const MISSING_CASE_ID = '00000000-0000-4000-8000-000000000000';

/** The wording the app shows. It is stated here, never read from the app. */
const ADVICE_NOT_PERMISSION = 'This is advice, not permission to enroll.';
const NO_ACCESS_HEADING = 'You no longer have access to this student';
const RESOLVE_DISCLAIMER =
  'The student can read your note. Resolving a case is advice only: it is not an official waiver, exception, or approval. It does not change any record or give the student permission to enroll.';

/** A time as the app writes it, for example `Sep 12, 2026, 2:00 PM UTC`. */
const DISPLAYED_TIME = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M UTC$/;

/** The case the flow works on, once the advisor has opened it. */
interface OpenedCase {
  readonly path: string;
}

/**
 * Switches the browser to another person, the way a person would: the session cookie goes and the
 * next sign-in issues a new one.
 *
 * @param page - The browser page.
 * @param persona - Who signs in next.
 */
async function switchTo(page: Page, persona: 'advisor' | 'advisorTwo' | 'student'): Promise<void> {
  await page.context().clearCookies();
  await signInAs(page, persona);
}

/**
 * Finds the history list on a case page.
 *
 * @param page - The browser page.
 * @returns The history entries.
 */
function historyOf(page: Page): Locator {
  return page.getByRole('region', { name: 'History' }).getByRole('listitem');
}

/**
 * Step: the student saves a draft and sends it to the advisor as a case.
 *
 * @param page - The browser page.
 * @returns What the student saw when the draft was saved.
 */
async function studentSendsCase(page: Page): Promise<SavedDraft> {
  await signInAs(page, 'student');
  await withdrawOpenCases(page);
  const draft = await saveDraftForPlanningTerm(page);
  await sendPlanReviewCase(page, STUDENT_NOTE);
  return draft;
}

/**
 * Step: the advisor sees the case in the queue and opens it. The case is the newest open plan
 * review, because the queue lists the oldest first.
 *
 * @param page - The browser page.
 * @returns The opened case's address.
 */
async function advisorOpensCase(page: Page): Promise<OpenedCase> {
  await switchTo(page, 'advisor');
  await page.goto('/advisor/queue');

  await expect(page.getByRole('heading', { level: 1, name: 'Review queue' })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  const rows = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Open', exact: true }) })
    .filter({ has: page.getByRole('rowheader', { name: 'Plan review' }) });
  await expect(rows.last()).toBeVisible();
  await expectAcademicValuesInVerifiedBlocks(page);
  await expectNoAxeViolations(page);

  await rows
    .last()
    .getByRole('link', { name: /^Review “Plan review”, opened / })
    .click();

  await expect(page.getByRole('heading', { level: 1, name: 'Plan review' })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  return { path: new URL(page.url()).pathname };
}

/**
 * Step: the case page shows the student's note and the plan revision as the student saved it.
 *
 * @param page - The browser page.
 * @param draft - What the student saw when the draft was saved.
 */
async function checkPinnedRevision(page: Page, draft: SavedDraft): Promise<void> {
  const request = page.getByRole('region', { name: 'What the student asked' });
  await expect(request.getByText(STUDENT_NOTE)).toBeVisible();
  await expect(page.getByText('No one has claimed this case yet.')).toBeVisible();

  const plan = page.getByRole('region', { name: 'Plan attached to this case' });
  await expect(plan.getByText(`Revision ${String(draft.revision)}, as saved on`)).toBeVisible();
  const saved = plan.locator('time').first();
  await expect(saved).toHaveAttribute('datetime', draft.savedAtIso);
  await expect(saved).toHaveText(DISPLAYED_TIME);
  expect(draft.savedAtIso).toMatch(ISO_TIMESTAMP);
  const year = draft.savedAtIso.slice(0, 4);
  await expect(saved).toContainText(year);
  await expect(plan.getByText('A saved plan is not a registration.')).toBeVisible();
  await expect(plan.getByRole('heading', { name: 'Checks that did not pass' })).toBeVisible();

  await expectAcademicValuesInVerifiedBlocks(page);
  await expectNoAxeViolations(page);
}

/**
 * Step: the advisor claims the case, and a second claim from a page loaded earlier is refused.
 *
 * @param page - The browser page, on the case.
 * @param opened - The case.
 */
async function claimTwice(page: Page, opened: OpenedCase): Promise<void> {
  const stale = await page.context().newPage();
  await stale.goto(opened.path);
  await expect(stale.getByRole('button', { name: 'Claim this case' })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });

  await page.getByRole('button', { name: 'Claim this case' }).click();
  await expect(page.getByText('You claimed this case. It is now in your review.')).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expect(page.getByText('You are reviewing this case.')).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expect(historyOf(page)).toHaveCount(2);
  await expectAcademicValuesInVerifiedBlocks(page);
  await expectNoAxeViolations(page);

  await stale.getByRole('button', { name: 'Claim this case' }).click();
  await expect(stale.getByText('Someone else updated this case.')).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expect(
    stale.getByText(
      'Another person acted on this case after you opened it, so your action was not applied.',
    ),
  ).toBeVisible();
  await expect(stale.getByText('You are reviewing this case.')).toBeVisible();
  await expect(historyOf(stale)).toHaveCount(2);
  await expectNoAxeViolations(stale);
  await stale.reload();
  await expect(historyOf(stale)).toHaveCount(2);
  await stale.close();
}

/**
 * Step: the advisor resolves the case with a note.
 *
 * @param page - The browser page, on the claimed case.
 */
async function resolveCase(page: Page): Promise<void> {
  await expect(page.getByText(RESOLVE_DISCLAIMER)).toBeVisible({ timeout: SLOW_STEP_MS });
  await page.getByRole('radio', { name: 'I reviewed this' }).check();
  await page.getByLabel('Note for the student').fill(ADVISOR_NOTE);
  await page.getByRole('button', { name: 'Resolve this case' }).click();

  await expect(
    page.getByText(
      'You resolved this case. The student can now read your note. It is advice, not an official waiver or approval.',
    ),
  ).toBeVisible({ timeout: SLOW_STEP_MS });
  await expectNoAxeViolations(page);
}

/**
 * Step: an advisor with no assignment gets the same result for the case as for a missing case.
 *
 * @param page - The browser page.
 * @param opened - The case.
 */
async function unassignedAdvisorSeesNothing(page: Page, opened: OpenedCase): Promise<void> {
  await switchTo(page, 'advisorTwo');
  await page.goto('/advisor/queue');

  await expect(page.getByRole('heading', { level: 1, name: 'Review queue' })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expect(page.getByRole('heading', { level: 2, name: 'No cases to review' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Review “/ })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await page.goto(opened.path);
  await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_HEADING })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expect(page.getByText(STUDENT_NOTE)).toHaveCount(0);
  const forRealCase = await page.getByRole('main').innerText();
  await expectNoAxeViolations(page);

  await page.goto(`/advisor/cases/${MISSING_CASE_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_HEADING })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  expect(await page.getByRole('main').innerText()).toBe(forRealCase);
}

/**
 * Step: the student reads the resolution as advice, not permission to enroll.
 *
 * @param page - The browser page.
 */
async function studentReadsResolution(page: Page): Promise<void> {
  await switchTo(page, 'student');
  await page
    .getByRole('navigation', { name: 'Student' })
    .getByRole('link', { name: 'Help and cases' })
    .click();

  await expect(page.getByRole('heading', { level: 2, name: 'Your cases' })).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  const resolved = page
    .getByRole('article')
    .filter({ hasText: STUDENT_NOTE })
    .filter({ hasText: 'Reviewed by an advisor' });
  await expect(resolved).toHaveCount(1);
  const review = resolved.getByRole('region', { name: 'Advisor review' });
  await expect(review.getByText(ADVICE_NOT_PERMISSION)).toBeVisible();
  await expect(review.getByText('Reviewed by your advisor on')).toBeVisible();
  await expect(review.getByText('Your advisor reviewed this.')).toBeVisible();
  await expect(review.getByText(ADVISOR_NOTE)).toBeVisible();
  await expect(review.getByRole('heading', { name: 'Note from your advisor' })).toBeVisible();
  expect(await review.innerText()).not.toMatch(/approved|granted|you may enroll|waiver/i);
  await expect(resolved.getByRole('button', { name: 'Withdraw this case' })).toHaveCount(0);

  await expectAcademicValuesInVerifiedBlocks(page);
  await expectNoAxeViolations(page);
}

acceptanceTest(
  'AC49',
  'the advisor claims and resolves a student case and the student reads it as advice',
  async ({ page }) => {
    // One long flow through two people, a development server that compiles on first visit.
    test.setTimeout(FLOW_TIMEOUT_MS);
    const draft = await test.step('the student saves a draft and sends a plan-review case', () =>
      studentSendsCase(page));
    const opened = await test.step('the advisor finds the case in the queue and opens it', () =>
      advisorOpensCase(page));
    await test.step('the case shows the pinned revision and the time it was saved', () =>
      checkPinnedRevision(page, draft));
    await test.step('the advisor claims the case and a second claim is refused', () =>
      claimTwice(page, opened));
    await test.step('the advisor resolves the case with a note', () => resolveCase(page));
    await test.step('an advisor with no assignment sees nothing', () =>
      unassignedAdvisorSeesNothing(page, opened));
    await test.step('the student reads the resolution as advice, not permission', () =>
      studentReadsResolution(page));
  },
);
