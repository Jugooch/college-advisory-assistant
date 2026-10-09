/**
 * @file AC48: the student flow in a browser. Student A signs in, opens the overview and the
 *   planner, asks chat for "no Fridays" and confirms the chip, gets verified options, a cited
 *   policy excerpt and an aid referral, saves a draft, and sends a case through the existing case
 *   form. Every step that shows a new page or chat result passes axe. Assertions are on roles,
 *   headings and fixed wording, never on model prose (docs/planning/13, AC48).
 * @requirement AC48
 * @requirement FR-01
 * @requirement FR-08
 * @requirement FR-10
 * @requirement FR-12
 * @requirement FR-16
 * @requirement NFR-02
 * @requirement T08
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { expectNoAxeViolations } from './support/axe';
import { acceptanceTest } from './support/known-findings';
import { signInAs } from './support/sign-in';

/**
 * Finds the chat column.
 *
 * @param page - The browser page.
 * @returns The assistant landmark.
 */
function assistantOf(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Assistant' });
}

/** How long a search, a save or a chat reply may take in CI before the step fails. */
const SLOW_STEP_MS = 30_000;

/**
 * Sends one chat message and waits until the reply has replaced the pending row.
 *
 * @param page - The browser page.
 * @param text - The message.
 * @returns The newest assistant turn.
 */
async function sendChat(page: Page, text: string): Promise<Locator> {
  const turns = page.getByRole('list', { name: 'Conversation' }).locator('> li');
  const before = await turns.count();
  await page.getByLabel('Message to the assistant').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(turns).toHaveCount(before + 2, { timeout: SLOW_STEP_MS });
  await expect(page.getByText('Checking your records…')).toHaveCount(0, {
    timeout: SLOW_STEP_MS,
  });
  return turns.last();
}

/**
 * Step: sign in and open the overview.
 *
 * @param page - The browser page.
 */
async function signInAndOpenOverview(page: Page): Promise<void> {
  await signInAs(page, 'student');

  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await expectNoAxeViolations(page);
}

/**
 * Step: open the planner and pick the term.
 *
 * @param page - The browser page.
 */
async function openPlannerAndPickTerm(page: Page): Promise<void> {
  const assistant = assistantOf(page);
  await page
    .getByRole('navigation', { name: 'Student' })
    .getByRole('link', { name: 'Plan next term' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Plan next term' })).toBeVisible();
  await page.getByLabel('Term', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Review constraints' }).click();

  await expect(assistant.getByRole('heading', { name: 'Ask the assistant' })).toBeVisible();
  await expect(assistant.getByText('This chat is not registration.')).toBeVisible();
  await expectNoAxeViolations(page);
}

/**
 * Step: write "no Fridays", see a preferred chip and confirm it.
 *
 * @param page - The browser page.
 */
async function confirmNoFridaysChip(page: Page): Promise<void> {
  const assistant = assistantOf(page);
  await sendChat(page, "I'd like no Fridays");

  const chips = assistant.getByRole('region', { name: 'Suggested limits' });
  await expect(chips.getByText('Not available on Friday, all day.')).toBeVisible();
  await expect(
    chips
      .getByRole('group', { name: 'How firm is this?' })
      .getByRole('radio', { name: 'Preferred' }),
  ).toBeChecked();
  await expect(
    page
      .getByRole('group', { name: 'Unavailable time 1' })
      .getByRole('checkbox', { name: 'Friday' }),
  ).not.toBeChecked();
  await expectNoAxeViolations(page);

  await chips.getByRole('button', { name: 'Confirm: Not available on Friday, all day.' }).click();

  await expect(chips.getByText('added to the form.')).toBeVisible();
  await expect(
    page
      .getByRole('group', { name: 'Unavailable time 1' })
      .getByRole('checkbox', { name: 'Friday' }),
  ).toBeChecked();
  await expectNoAxeViolations(page);
}

/**
 * Step: choose a course and confirm the search so chat has inputs.
 *
 * @param page - The browser page.
 */
async function confirmSearch(page: Page): Promise<void> {
  await page
    .getByRole('group', { name: 'Courses to schedule' })
    .getByRole('checkbox')
    .first()
    .check();
  await page.getByRole('button', { name: 'Review constraints' }).click();

  await expect(page.getByRole('heading', { name: 'Review your constraints' })).toBeVisible();
  await expect(page.getByText('Not available on Friday, all day.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirm and find schedules' }).click();

  await expect(page.getByRole('button', { name: 'Save as draft' }).first()).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expectNoAxeViolations(page);
}

/**
 * Step: ask for options and see verified cards with no Friday section.
 *
 * @param page - The browser page.
 */
async function askForOptions(page: Page): Promise<void> {
  const assistant = assistantOf(page);
  await sendChat(page, 'Show me my options');

  const option = assistant.getByRole('article', { name: 'Option 1' });
  await expect(option).toBeVisible();
  await expect(option.getByRole('heading', { name: 'Checks, shown separately' })).toBeVisible();
  await expect(option.getByRole('heading', { name: 'Courses and sections' })).toBeVisible();
  await expect(option.getByText('Friday')).toHaveCount(0);
  await expectNoAxeViolations(page);
}

/**
 * Step: ask a policy question and see a cited excerpt.
 *
 * @param page - The browser page.
 */
async function askPolicyQuestion(page: Page): Promise<void> {
  const turn = await sendChat(page, 'What is the policy on dropping a course?');

  const hit = turn
    .getByRole('listitem')
    .filter({ has: page.getByRole('term', { name: 'Revision' }) });
  await expect(hit.first()).toBeVisible();
  await expect(hit.first().getByRole('heading')).toBeVisible();
  await expect(hit.first().getByRole('term', { name: 'Effective' })).toBeVisible();
  await expect(hit.first().getByRole('term', { name: 'Source' })).toBeVisible();
  await expectNoAxeViolations(page);
}

/**
 * Step: ask about financial aid and see the referral with no determination.
 *
 * @param page - The browser page.
 */
async function askAboutAid(page: Page): Promise<void> {
  const turn = await sendChat(page, 'Can I get financial aid for this term?');

  await expect(turn.getByRole('note')).toBeVisible();
  await expect(turn.getByRole('article')).toHaveCount(0);
  await expect(turn.getByRole('term', { name: 'Revision' })).toHaveCount(0);
  await expectNoAxeViolations(page);
}

/**
 * Step: save a draft from an option.
 *
 * @param page - The browser page.
 */
async function saveDraft(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save as draft' }).first().click();

  await expect(page.getByText('Draft saved. This is a plan, not a registration.')).toBeVisible({
    timeout: SLOW_STEP_MS,
  });
  await expectNoAxeViolations(page);
}

/**
 * Step: ask for an advisor review and open the prefilled case form.
 *
 * @param page - The browser page.
 */
async function openCaseForm(page: Page): Promise<void> {
  const assistant = assistantOf(page);
  await sendChat(page, 'Ask my advisor to review my plan');

  const preview = assistant.getByRole('region', {
    name: 'Preview of a request to your advisor',
  });
  await expect(preview.getByText('Nothing has been sent.')).toBeVisible();
  await expect(preview.getByText('Your chat is not shared.')).toBeVisible();
  await expectNoAxeViolations(page);

  await preview.getByRole('link', { name: 'Continue to the request form' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Ask an advisor' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Review my plan' })).toBeChecked();
  await expect(page.getByText('Your chat is not shared.')).toBeVisible();
  await expectNoAxeViolations(page);
}

/**
 * Step: submit the case form.
 *
 * @param page - The browser page.
 */
async function submitCase(page: Page): Promise<void> {
  await page.getByLabel('Your note for your advisor').fill('Please review my plan for next term.');
  await page.getByRole('button', { name: 'Send to my advisor' }).click();

  await expect(page.getByText('Case opened.')).toBeVisible({ timeout: SLOW_STEP_MS });
  await expectNoAxeViolations(page);
}

/**
 * Step: see the case as waiting for an advisor, with no transcript.
 *
 * @param page - The browser page.
 */
async function checkCaseListed(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Open Help and cases' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Your cases' })).toBeVisible();
  const submitted = page.getByRole('article').filter({ hasText: 'Review my plan' }).first();
  await expect(submitted.getByText('Waiting for an advisor')).toBeVisible();
  await expect(submitted.getByText('Please review my plan for next term.')).toBeVisible();
  await expect(page.getByText("I'd like no Fridays")).toHaveCount(0);
  await expectNoAxeViolations(page);
}

acceptanceTest(
  'AC48',
  'the student plans next term, asks for help and opens an advisor case',
  async ({ page }) => {
    await test.step('sign in and open the overview', () => signInAndOpenOverview(page));
    await test.step('open the planner and pick the term', () => openPlannerAndPickTerm(page));
    await test.step('write "no Fridays", see a preferred chip and confirm it', () =>
      confirmNoFridaysChip(page));
    await test.step('choose a course and confirm the search so chat has inputs', () =>
      confirmSearch(page));
    await test.step('ask for options and see verified cards with no Friday section', () =>
      askForOptions(page));
    await test.step('ask a policy question and see a cited excerpt', () => askPolicyQuestion(page));
    await test.step('ask about financial aid and see the referral with no determination', () =>
      askAboutAid(page));
    await test.step('save a draft from an option', () => saveDraft(page));
    await test.step('ask for an advisor review and open the prefilled case form', () =>
      openCaseForm(page));
    await test.step('submit the case form', () => submitCase(page));
    await test.step('see the case as waiting for an advisor, with no transcript', () =>
      checkCaseListed(page));
  },
);
