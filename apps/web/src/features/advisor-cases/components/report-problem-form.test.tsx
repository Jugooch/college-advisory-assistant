/**
 * @file Tests for the report-a-problem form in a browser-like DOM: the subjects, the preview
 * matching the request, the statement that official records don't change, each outcome, and axe.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import { describeError } from '@/shared/utils/error-code-wording';

import { REPORT_CHANGES_NOTHING, WHO_SEES_THIS } from '../utils/case-wording';
import { CASE_REQUEST_FIELD, parseCreateCaseForm } from '../utils/create-case-form';
import type { CreateCaseState } from '../utils/create-case-state';
import { NOTE_REQUIRED_MESSAGE } from './note-field';
import { ReportProblemForm } from './report-problem-form';

const STUDENT_ID = syntheticId('student', 1);
const CASES_HREF = `/help-and-cases?studentId=${STUDENT_ID}`;
const NOTE_LABEL = 'What is wrong, and what do you expect to see?';
const CREATED: CreateCaseState = {
  kind: 'created',
  status: 'OPEN',
  createdAt: '2026-09-22T15:00:00.000Z',
};

/**
 * Renders the form with an action that returns a fixed state.
 *
 * @param state - The state the action returns.
 * @returns The action mock and the container.
 */
function renderForm(state: CreateCaseState) {
  const createAction = vi.fn(async () => Promise.resolve(state));
  const view = render(
    <ReportProblemForm createAction={createAction} studentId={STUDENT_ID} casesHref={CASES_HREF} />,
  );
  return { createAction, container: view.container };
}

/**
 * Types a note.
 *
 * @param text - The note.
 */
function typeNote(text: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: NOTE_LABEL }), { target: { value: text } });
}

describe('ReportProblemForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('offers the four subjects in plain language', () => {
    renderForm({ kind: 'idle' });

    const group = screen.getByRole('group', { name: 'What looks wrong?' });
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
    for (const label of [
      'My program or catalog',
      'A course attempt on my record',
      'A requirement on my degree audit',
      'A course section',
    ]) {
      expect(within(group).getByLabelText(label)).toBeTruthy();
    }
  });

  it('says a report changes no official record, is not a waiver request, and who sees it', () => {
    renderForm({ kind: 'idle' });

    const preview = screen.getByRole('region', { name: 'What will be shared' });
    expect(preview.textContent).toContain(REPORT_CHANGES_NOTHING);
    expect(preview.textContent).toContain(WHO_SEES_THIS);
  });

  it('previews the subject and note, and sends exactly that with no plan', () => {
    const { container } = renderForm({ kind: 'idle' });
    fireEvent.click(screen.getByLabelText('A course attempt on my record'));
    typeNote(' My grade is missing. ');

    const preview = screen.getByRole('region', { name: 'What will be shared' });
    expect(preview.textContent).toContain('A course attempt on my record');
    expect(preview.textContent).toContain('My grade is missing.');
    const data = new FormData();
    data.set('studentId', STUDENT_ID);
    data.set(
      CASE_REQUEST_FIELD,
      container.querySelector<HTMLInputElement>(`input[name="${CASE_REQUEST_FIELD}"]`)?.value ?? '',
    );
    expect(parseCreateCaseForm(data)?.body).toEqual({
      reason: 'SOURCE_DISCREPANCY',
      planRevisionId: null,
      discrepancySubject: 'COURSE_ATTEMPT',
      studentNote: 'My grade is missing.',
    });
  });

  it('sends nothing and shows the error when the note is empty', () => {
    const { createAction } = renderForm(CREATED);

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(createAction).not.toHaveBeenCalled();
    expect(screen.getByText(NOTE_REQUIRED_MESSAGE)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: NOTE_LABEL }));
  });

  it('shows the 500-character limit and count', () => {
    renderForm({ kind: 'idle' });
    typeNote('y'.repeat(120));

    expect(screen.getByRole('textbox', { name: NOTE_LABEL }).getAttribute('maxlength')).toBe('500');
    expect(screen.getByText('120 of 500 characters used')).toBeTruthy();
  });

  it('confirms with the status and focus on the confirmation', async () => {
    renderForm(CREATED);
    typeNote('My grade is missing.');

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    const confirmation = (await screen.findByText('Case opened.')).closest('[tabindex="-1"]');
    await waitFor(() => {
      expect(document.activeElement).toBe(confirmation);
    });
    expect(confirmation?.textContent).toContain('Waiting for an advisor');
    expect(screen.getByRole('status', { name: 'Submission result' }).contains(confirmation)).toBe(
      false,
    );
  });

  it.each([ErrorCode.NotFound, ErrorCode.SourceUnavailable])(
    'explains %s with a next step',
    async (code) => {
      renderForm({ kind: 'failed', code, message: 'API says so', requestId: null });
      typeNote('My grade is missing.');

      fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

      const region = screen.getByRole('status', { name: 'Submission result' });
      await waitFor(() => {
        expect(region.textContent).toContain(describeError(code).nextStep);
      });
      expect(region.textContent).toContain(describeError(code).heading);
    },
  );

  it('keeps the button focusable while sending', async () => {
    const createAction = vi.fn(async () => new Promise<CreateCaseState>(() => undefined));
    render(
      <ReportProblemForm
        createAction={createAction}
        studentId={STUDENT_ID}
        casesHref={CASES_HREF}
      />,
    );
    typeNote('My grade is missing.');
    const button = screen.getByRole('button', { name: 'Send report' });
    button.focus();

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('claims no waiver, approval, or change to records', () => {
    const { container } = renderForm({ kind: 'idle' });

    expect(container.textContent).not.toMatch(/approved|granted|will be corrected|registered/i);
  });

  it.each<[string, CreateCaseState]>([
    ['idle', { kind: 'idle' }],
    ['created', CREATED],
    ['rejected', { kind: 'rejected' }],
  ])('has no axe violations in the %s state', async (_name, state) => {
    const { container } = renderForm(state);
    typeNote('My grade is missing.');
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Submission result' })).toBeTruthy();
    });

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
