/**
 * @file Tests for the ask-an-advisor form in a browser-like DOM: the reasons, the preview matching
 * the request it sends, the note limit, and the empty-note guard.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AggregateState, CheckKind, CheckState, ReasonCode } from '@caa/domain';
import {
  buildCheckResult,
  buildPlanRevisionView,
  buildResultUnavailablePlanRevisionView,
  buildScheduleOption,
  buildScheduleOptionsResponse,
  syntheticId,
} from '@caa/test-kit';

import { CHAT_NOT_SHARED, WHO_SEES_THIS } from '../utils/case-wording';
import { CASE_REQUEST_FIELD, parseCreateCaseForm } from '../utils/create-case-form';
import type { CreateCaseState } from '../utils/create-case-state';
import { AskAdvisorForm } from './ask-advisor-form';
import { NOTE_REQUIRED_MESSAGE } from './note-field';
import { NO_NOTE_YET } from './note-preview';

const STUDENT_ID = syntheticId('student', 1);
const CASES_HREF = `/help-and-cases?studentId=${STUDENT_ID}`;
const REVISION = buildPlanRevisionView();
const BASE_OPTION = buildScheduleOption();
const UNKNOWN_OPTION = buildScheduleOption({
  courseResults: BASE_OPTION.courseResults.map((result) => ({
    ...result,
    prerequisite: buildCheckResult({
      kind: CheckKind.Prerequisite,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.PrerequisiteRuleMissing,
    }),
  })),
  aggregate: AggregateState.NeedsVerification,
});
const CREATED: CreateCaseState = {
  kind: 'created',
  status: 'OPEN',
  createdAt: '2026-09-22T15:00:00.000Z',
};

/**
 * Renders the form with an action that returns a fixed state.
 *
 * @param state - The state the action returns.
 * @param revision - The revision to show.
 * @returns The action mock and the container.
 */
function renderForm(state: CreateCaseState, revision = REVISION) {
  const createAction = vi.fn<
    (previous: CreateCaseState, formData: FormData) => Promise<CreateCaseState>
  >(async () => Promise.resolve(state));
  const view = render(
    <AskAdvisorForm
      createAction={createAction}
      studentId={STUDENT_ID}
      revision={revision}
      casesHref={CASES_HREF}
    />,
  );
  return { createAction, container: view.container };
}

/**
 * Types a note.
 *
 * @param text - The note.
 */
function typeNote(text: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your note for your advisor' }), {
    target: { value: text },
  });
}

/**
 * Reads the request the form would send.
 *
 * @param container - The rendered form.
 * @returns The parsed hidden request.
 */
function hiddenRequest(container: HTMLElement) {
  const data = new FormData();
  data.set('studentId', STUDENT_ID);
  data.set(
    CASE_REQUEST_FIELD,
    container.querySelector<HTMLInputElement>(`input[name="${CASE_REQUEST_FIELD}"]`)?.value ?? '',
  );
  return parseCreateCaseForm(data)?.body;
}

describe('AskAdvisorForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('offers the two reasons in plain language, plan review first', () => {
    renderForm({ kind: 'idle' });

    const group = screen.getByRole('group', { name: 'What do you want help with?' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false]);
    expect(within(group).getByLabelText('Review my plan')).toBeTruthy();
    expect(within(group).getByLabelText('Help with checks that couldn’t be verified')).toBeTruthy();
  });

  it('previews the revision number and time, the note, and who sees it', () => {
    renderForm({ kind: 'idle' });
    typeNote('  Is this load too heavy?  ');

    const preview = screen.getByRole('region', { name: 'What will be shared' });
    expect(preview.textContent).toContain(`Plan revision ${String(REVISION.revision)}, saved`);
    expect(preview.querySelector('time')?.getAttribute('datetime')).toBe(REVISION.createdAt);
    expect(preview.textContent).toContain('Is this load too heavy?');
    expect(preview.textContent).toContain(CHAT_NOT_SHARED);
    expect(preview.textContent).toContain(WHO_SEES_THIS);
  });

  it('says there is no note yet before anything is typed', () => {
    renderForm({ kind: 'idle' });

    expect(screen.getByRole('region', { name: 'What will be shared' }).textContent).toContain(
      NO_NOTE_YET,
    );
  });

  it('lists failing and unknown checks in the preview, never as passed', () => {
    const revision = buildPlanRevisionView({
      result: buildScheduleOptionsResponse({ options: [UNKNOWN_OPTION] }),
    });
    renderForm({ kind: 'idle' }, revision);

    const preview = screen.getByRole('region', { name: 'What will be shared' });
    expect(preview.textContent).toContain('Prerequisite');
    expect(preview.textContent).toContain('Needs verification');
    expect(preview.textContent).not.toContain('Passed as of');
  });

  it('says no check failed when every check passed, without calling it an approval', () => {
    renderForm({ kind: 'idle' });

    const text = screen.getByRole('region', { name: 'What will be shared' }).textContent;
    expect(text).toContain('No failing or unknown checks');
    expect(text).toContain('not a registration or an approval');
  });

  it('says so when the saved result can’t be read, instead of listing nothing', () => {
    renderForm({ kind: 'idle' }, buildResultUnavailablePlanRevisionView());

    expect(screen.getByRole('region', { name: 'What will be shared' }).textContent).toContain(
      'checks can’t be listed here',
    );
  });

  it('sends exactly what the preview shows', () => {
    const { container } = renderForm({ kind: 'idle' });
    fireEvent.click(screen.getByLabelText('Help with checks that couldn’t be verified'));
    typeNote('  Please look at my prerequisites.  ');

    const preview = screen.getByRole('region', { name: 'What will be shared' });
    expect(preview.textContent).toContain('Please look at my prerequisites.');
    expect(hiddenRequest(container)).toEqual({
      reason: 'NEEDS_VERIFICATION',
      planRevisionId: REVISION.id,
      discrepancySubject: null,
      studentNote: 'Please look at my prerequisites.',
    });
  });

  it('submits the action with the student and the request', async () => {
    const { createAction } = renderForm(CREATED);
    typeNote('Please check.');

    fireEvent.click(screen.getByRole('button', { name: 'Send to my advisor' }));

    await waitFor(() => {
      expect(createAction).toHaveBeenCalledTimes(1);
    });
    const submitted = createAction.mock.calls[0]?.[1];
    expect(parseCreateCaseForm(submitted ?? new FormData())).toMatchObject({
      studentId: STUDENT_ID,
      body: { reason: 'PLAN_REVIEW', studentNote: 'Please check.' },
    });
  });

  it.each(['', '   \n '])('sends nothing and focuses the note when it is %j', (text) => {
    const { createAction } = renderForm(CREATED);
    typeNote(text);

    fireEvent.click(screen.getByRole('button', { name: 'Send to my advisor' }));

    expect(createAction).not.toHaveBeenCalled();
    const note = screen.getByRole('textbox', { name: 'Your note for your advisor' });
    expect(document.activeElement).toBe(note);
    expect(screen.getByText(NOTE_REQUIRED_MESSAGE)).toBeTruthy();
    expect(note.getAttribute('aria-invalid')).toBe('true');
  });

  it('limits the note to 500 characters and shows the count', () => {
    renderForm({ kind: 'idle' });
    typeNote('x'.repeat(500));

    const note = screen.getByRole('textbox', { name: 'Your note for your advisor' });
    expect(note.getAttribute('maxlength')).toBe('500');
    expect(screen.getByText('500 of 500 characters used')).toBeTruthy();
  });
});
