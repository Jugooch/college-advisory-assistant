/**
 * @file Tests for the ask-an-advisor form outcomes in a browser-like DOM: every outcome's
 * explanation and next step, focus and live-region behavior, a pending state that keeps keyboard
 * focus, no unused ids, and axe.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@caa/domain';
import { buildPlanRevisionView, syntheticId } from '@caa/test-kit';

import { describeError } from '@/shared/utils/error-code-wording';

import { OPEN_CASE_EXISTS } from '../utils/case-wording';
import type { CreateCaseState } from '../utils/create-case-state';
import { AskAdvisorForm } from './ask-advisor-form';

const STUDENT_ID = syntheticId('student', 1);
const CASES_HREF = `/help-and-cases?studentId=${STUDENT_ID}`;
const REVISION = buildPlanRevisionView();
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
  const createAction = vi.fn(async () => Promise.resolve(state));
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
 * Lists ids on the page that nothing refers to.
 *
 * @param container - The rendered DOM.
 * @returns The unused ids.
 */
function unusedIds(container: HTMLElement): string[] {
  const refs = new Set(
    [...container.querySelectorAll('[aria-describedby],[aria-labelledby],label[for]')].flatMap(
      (element) =>
        (
          element.getAttribute('aria-describedby') ??
          element.getAttribute('aria-labelledby') ??
          element.getAttribute('for') ??
          ''
        ).split(' '),
    ),
  );
  return [...container.querySelectorAll('[id]')]
    .map((element) => element.id)
    .filter((id) => !refs.has(id));
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

describe('AskAdvisorForm outcomes', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('confirms the case with its status, meaning, next step, and a link, and moves focus there', async () => {
    renderForm(CREATED);
    typeNote('Please check.');

    fireEvent.click(screen.getByRole('button', { name: 'Send to my advisor' }));

    const confirmation = (await screen.findByText('Case opened.')).closest('[tabindex="-1"]');
    await waitFor(() => {
      expect(document.activeElement).toBe(confirmation);
    });
    expect(confirmation?.textContent).toContain('Waiting for an advisor');
    expect(confirmation?.textContent).toContain('No advisor has picked it up yet');
    expect(confirmation?.textContent).toContain('You won’t get an email or message');
    expect(
      within(confirmation as HTMLElement)
        .getByRole('link')
        .getAttribute('href'),
    ).toBe(CASES_HREF);
    // One announcement: the focused confirmation is outside the polite region.
    expect(screen.getByRole('status', { name: 'Submission result' }).contains(confirmation)).toBe(
      false,
    );
    expect(confirmation?.textContent).not.toMatch(/approved|granted|registered/i);
  });

  it('explains the open-case 409 with a link to the case, in the live region', async () => {
    renderForm({ kind: 'duplicate' });
    typeNote('Again.');

    fireEvent.click(screen.getByRole('button', { name: 'Send to my advisor' }));

    const region = screen.getByRole('status', { name: 'Submission result' });
    await waitFor(() => {
      expect(region.textContent).toContain(OPEN_CASE_EXISTS);
    });
    expect(
      within(region).getByRole('link', { name: 'See your open case' }).getAttribute('href'),
    ).toBe(CASES_HREF);
    expect(document.activeElement).not.toBe(region);
  });

  it.each([ErrorCode.NotFound, ErrorCode.SourceUnavailable])(
    'explains %s with its heading, message, and next step, without moving focus',
    async (code) => {
      renderForm({ kind: 'failed', code, message: 'API says so', requestId: 'req-3' });
      typeNote('Please check.');
      const button = screen.getByRole('button', { name: 'Send to my advisor' });
      button.focus();

      fireEvent.click(button);

      const region = screen.getByRole('status', { name: 'Submission result' });
      await waitFor(() => {
        expect(region.textContent).toContain(describeError(code).heading);
      });
      expect(region.textContent).toContain('API says so');
      expect(region.textContent).toContain(describeError(code).nextStep);
      expect(region.textContent).toContain('req-3');
      expect(document.activeElement).toBe(button);
    },
  );

  it('explains a rejected form', async () => {
    renderForm({ kind: 'rejected' });
    typeNote('Please check.');

    fireEvent.click(screen.getByRole('button', { name: 'Send to my advisor' }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Submission result' }).textContent).toContain(
        'nothing was sent',
      );
    });
  });

  it('keeps the button focusable while sending, with aria-disabled and not disabled', async () => {
    const createAction = vi.fn(async () => new Promise<CreateCaseState>(() => undefined));
    render(
      <AskAdvisorForm
        createAction={createAction}
        studentId={STUDENT_ID}
        revision={REVISION}
        casesHref={CASES_HREF}
      />,
    );
    typeNote('Please check.');
    const button = screen.getByRole('button', { name: 'Send to my advisor' });
    button.focus();

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('status', { name: 'Submission result' }).textContent).toContain(
      'Sending…',
    );
    fireEvent.click(button);
    expect(createAction).toHaveBeenCalledTimes(1);
  });

  it('has no unused ids', () => {
    const { container } = renderForm({ kind: 'idle' });

    expect(unusedIds(container)).toEqual([]);
  });

  it('shows no IDs and no registration or approval wording', () => {
    const { container } = renderForm({ kind: 'idle' });

    expect(container.textContent).not.toContain(REVISION.id);
    expect(container.textContent).not.toContain(STUDENT_ID);
    expect(container.textContent).not.toMatch(/registered|enrolled|approved|waiver/i);
  });

  it.each<[string, CreateCaseState]>([
    ['idle', { kind: 'idle' }],
    ['created', CREATED],
    ['duplicate', { kind: 'duplicate' }],
    ['rejected', { kind: 'rejected' }],
  ])('has no axe violations in the %s state', async (_name, state) => {
    const { container } = renderForm(state);
    typeNote('Please check.');
    fireEvent.click(screen.getByRole('button', { name: 'Send to my advisor' }));
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Submission result' })).toBeTruthy();
    });

    expect(await violations(container)).toEqual([]);
  });
});
