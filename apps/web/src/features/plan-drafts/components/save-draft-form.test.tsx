/**
 * @file Tests for the save-as-draft form in a browser-like DOM: the exact fields it sends, the
 * live-region result for every outcome, focus on the confirmation, and axe.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScheduleOptionsRequestSchema } from '@caa/api-contract';
import {
  buildPlanFreshnessView,
  buildPlanView,
  buildScheduleConstraintSet,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  syntheticId,
} from '@caa/test-kit';

import { DRAFT_FIELD, optionSectionIds, parseSaveDraftForm } from '../utils/save-draft-form';
import { type SaveDraftState, toSavedState } from '../utils/save-draft-state';
import { SaveDraftForm } from './save-draft-form';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const STUDENT_ID = syntheticId('student', 1);
const RESULT = buildScheduleOptionsResponse();
const DRAFT = {
  request: ScheduleOptionsRequestSchema.parse({
    termId: RESULT.term.id,
    courseIds: RESULT.courseIds,
    creditSelections: [],
    constraints: buildScheduleConstraintSet(),
  }),
  selectedSectionIds: optionSectionIds(buildScheduleOption()),
  expectedPinnedInputs: RESULT.pinnedInputs,
};

/**
 * Renders the form with an action that returns a fixed state.
 *
 * @param state - The state the action returns.
 * @returns The action mock and the container.
 */
function renderForm(state: SaveDraftState) {
  const saveAction = vi.fn(async () => Promise.resolve(state));
  const view = render(
    <SaveDraftForm
      saveAction={saveAction}
      studentId={STUDENT_ID}
      draft={DRAFT}
      label="Save as draft"
      idPrefix="save-option-1"
      plansHref={`/my-plans?studentId=${STUDENT_ID}`}
    />,
  );
  return { saveAction, container: view.container };
}

/**
 * Runs axe on a container.
 *
 * @param container - The rendered DOM.
 * @returns The violation rule IDs.
 */
async function violations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.map((violation) => violation.id);
}

describe('SaveDraftForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends the exact request, sections, and pinned inputs through the action', async () => {
    const { saveAction } = renderForm({ kind: 'conflict' });

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    await waitFor(() => {
      expect(saveAction).toHaveBeenCalledTimes(1);
    });
    const submitted = saveAction.mock.calls[0] as unknown as [SaveDraftState, FormData];
    expect(parseSaveDraftForm(submitted[1])).toEqual({ studentId: STUDENT_ID, body: DRAFT });
    expect(submitted[1].get(DRAFT_FIELD)).toBe(JSON.stringify(DRAFT));
  });

  it('confirms a save, with the revision, as a plan and not a registration', async () => {
    const saved = toSavedState(buildPlanView());
    const { container } = renderForm(saved);

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    const confirmation = await screen.findByText(
      /Draft saved\. This is a plan, not a registration\./,
    );
    expect(confirmation.parentElement?.textContent).toContain('Revision 1');
    expect(container.textContent).toContain('Up to date');
    expect(container.textContent).not.toMatch(/registered|enrolled|approved/i);
    expect(screen.getByRole('link', { name: 'Open My plans' }).getAttribute('href')).toBe(
      `/my-plans?studentId=${STUDENT_ID}`,
    );
  });

  it('moves focus to the confirmation, outside the polite live region', async () => {
    renderForm(toSavedState(buildPlanView()));

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    const confirmation = await screen.findByText(/Draft saved\./);
    const focused = confirmation.closest('[tabindex="-1"]');
    await waitFor(() => {
      expect(document.activeElement).toBe(focused);
    });
    // One announcement: the focused confirmation is outside the polite region.
    expect(screen.getByRole('status').contains(focused)).toBe(false);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('tells the student the options changed and refreshes them on request', async () => {
    renderForm({ kind: 'conflict' });

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    const region = screen.getByRole('status');
    await within(region).findByText('Your options changed since you loaded them. Refresh options.');
    fireEvent.click(within(region).getByRole('button', { name: 'Refresh options' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'STALE_SOURCE',
      'Your record is being refreshed',
      'Results aren’t shown until the record is current',
    ],
    ['SOURCE_UNAVAILABLE', 'A source system is unavailable', 'Nothing was changed'],
  ] as const)(
    'shows the existing %s message with the API’s text and reference',
    async (code, heading, step) => {
      renderForm({ kind: 'failed', code, message: 'The API’s own text', requestId: 'req-7' });

      fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

      const region = screen.getByRole('status');
      await within(region).findByText(new RegExp(heading));
      expect(region.textContent).toContain('The API’s own text');
      expect(region.textContent).toContain(step);
      expect(region.textContent).toContain('req-7');
    },
  );

  it('says a rejected form saved nothing', async () => {
    renderForm({ kind: 'rejected' });

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText(/nothing was saved/)).toBeTruthy();
  });

  it('says plainly that a saved result can’t be displayed, and shows no result', async () => {
    const saved = {
      ...toSavedState(buildPlanView()),
      isResultUnavailable: true,
    } as SaveDraftState;
    renderForm(saved);

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText(/The saved result can’t be displayed right now/)).toBeTruthy();
  });

  it('shows UNKNOWN freshness as couldn’t check, never as up to date', async () => {
    const unknown = buildPlanFreshnessView({ state: 'UNKNOWN', reasons: ['SOURCE_UNAVAILABLE'] });
    const saved = { ...toSavedState(buildPlanView()), freshness: unknown } as SaveDraftState;
    const { container } = renderForm(saved);

    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByText('Couldn’t check');
    expect(container.textContent).not.toContain('Up to date');
  });

  it.each([
    ['idle', { kind: 'idle' }],
    ['saved', toSavedState(buildPlanView())],
    ['conflict', { kind: 'conflict' }],
    ['failed', { kind: 'failed', code: 'STALE_SOURCE', message: 'm', requestId: null }],
  ] as const)('has no axe violations when %s', async (name, state) => {
    const { container } = renderForm(state);
    if (name !== 'idle') {
      fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
      await waitFor(() => {
        expect(container.textContent).toMatch(/Draft saved|changed|Your record|looked/);
      });
    }

    expect(await violations(container)).toEqual([]);
  });

  it('keeps the button focusable and named while saving, and ignores a second click', async () => {
    let finish: (state: SaveDraftState) => void = () => undefined;
    const saveAction = vi.fn(
      async () =>
        new Promise<SaveDraftState>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <SaveDraftForm
        saveAction={saveAction}
        studentId={STUDENT_ID}
        draft={DRAFT}
        label="Save as draft"
        idPrefix="s"
        plansHref="/my-plans"
      />,
    );
    const button = screen.getByRole('button', { name: 'Save as draft' });
    button.focus();

    fireEvent.click(button);
    await screen.findByText('Saving…');
    fireEvent.click(button);

    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button);
    expect(saveAction).toHaveBeenCalledTimes(1);
    finish({ kind: 'conflict' });
    await screen.findByText(/Your options changed/);
  });
});
