/**
 * @file Tests for the resolve form: it says the note is visible to the student and is not a
 * waiver or approval, limits the note to 1,000 characters with an accessible counter, asks for a
 * resolution before sending, and sends the chosen code and note.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import {
  REVIEW_ACTION_FIELD,
  REVIEW_CASE_FIELD,
  REVIEW_NOTE_FIELD,
  REVIEW_RESOLUTION_FIELD,
  REVIEW_SEQUENCE_FIELD,
} from '../utils/review-case-state';
import { RESOLVE_DISCLAIMER } from '../utils/review-wording';
import { RESOLUTION_REQUIRED_MESSAGE } from './resolution-options';
import { ResolveForm } from './resolve-form';

const CASE_ID = syntheticId('advisingCase', 1);

/**
 * Renders the form.
 *
 * @param isPending - Whether an action is sending.
 * @returns The action mock and the container.
 */
function renderForm(isPending = false) {
  const formAction = vi.fn<(formData: FormData) => void>();
  const view = render(
    <ResolveForm formAction={formAction} isPending={isPending} caseId={CASE_ID} lastSequence={2} />,
  );
  return { formAction, container: view.container };
}

describe('ResolveForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('says the note is visible to the student and is not a waiver or approval', () => {
    const { container } = renderForm();

    expect(container.textContent).toContain(RESOLVE_DISCLAIMER);
    expect(RESOLVE_DISCLAIMER).toContain('student can read your note');
    expect(RESOLVE_DISCLAIMER).toContain('not an official waiver, exception, or approval');
    expect(RESOLVE_DISCLAIMER).toContain('permission to enroll');
    const group = screen.getByRole('group', { name: 'How did you resolve it?' });
    const describedBy = group.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe(RESOLVE_DISCLAIMER);
    expect(container.textContent).not.toMatch(/\b(approve[ds]?|granted|waived)\b/i);
  });

  it('limits the note to 1,000 characters with a counter the field is described by', () => {
    renderForm();

    const note = screen.getByRole('textbox', { name: 'Note for the student' });
    expect(note.getAttribute('maxlength')).toBe('1000');
    expect(screen.getByText('0 of 1000 characters used')).toBeTruthy();
    fireEvent.change(note, { target: { value: 'a'.repeat(980) } });
    const count = screen.getByText('980 of 1000 characters used');
    expect(note.getAttribute('aria-describedby')).toContain(count.id);
    expect(screen.getByText('20 characters left.')).toBeTruthy();
  });

  it('asks for a resolution, focuses the first option, and sends nothing without one', () => {
    const { formAction } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve this case' }));

    expect(screen.getByText(RESOLUTION_REQUIRED_MESSAGE)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('I reviewed this'));
    expect(formAction).not.toHaveBeenCalled();
    const group = screen.getByRole('group', { name: 'How did you resolve it?' });
    expect(group.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
  });

  it('clears the error once an option is chosen', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve this case' }));

    fireEvent.click(screen.getByLabelText('I reviewed this'));

    expect(screen.queryByText(RESOLUTION_REQUIRED_MESSAGE)).toBeNull();
  });

  it('sends the case, the sequence, the chosen resolution, and the note', async () => {
    const { formAction } = renderForm();

    fireEvent.click(screen.getByLabelText('The student has a next step'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note for the student' }), {
      target: { value: 'Please book a visit.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve this case' }));

    await waitFor(() => {
      expect(formAction).toHaveBeenCalledTimes(1);
    });
    const data = formAction.mock.calls[0]?.[0];
    expect(data?.get(REVIEW_CASE_FIELD)).toBe(CASE_ID);
    expect(data?.get(REVIEW_SEQUENCE_FIELD)).toBe('2');
    expect(data?.get(REVIEW_ACTION_FIELD)).toBe('RESOLVE');
    expect(data?.get(REVIEW_RESOLUTION_FIELD)).toBe('STUDENT_ACTION_NEEDED');
    expect(data?.get(REVIEW_NOTE_FIELD)).toBe('Please book a visit.');
  });

  it('uses aria-disabled while sending and does not send twice', () => {
    const { formAction } = renderForm(true);
    fireEvent.click(screen.getByLabelText('I reviewed this'));

    const button = screen.getByRole('button', { name: 'Resolve this case' });
    fireEvent.click(button);

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(formAction).not.toHaveBeenCalled();
  });

  it('has no axe violations, with and without the error', async () => {
    const { container } = renderForm();
    expect((await axe.run(container)).violations.map((violation) => violation.id)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve this case' }));

    expect((await axe.run(container)).violations.map((violation) => violation.id)).toEqual([]);
  });
});
