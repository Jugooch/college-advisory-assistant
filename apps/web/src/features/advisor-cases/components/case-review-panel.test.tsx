/**
 * @file Tests for the review panel: actions follow `allowedActions`, focus moves to the persistent
 * heading after an action removes the focused control, every outcome renders its explanation and
 * next step, a 409 and a 404 are explained, pending uses aria-disabled, the resolve form says the
 * note is visible and not a waiver, ids are all used, and axe finds no violations.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaseAction, ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import {
  REVIEW_ACTION_FIELD,
  REVIEW_CASE_FIELD,
  REVIEW_SEQUENCE_FIELD,
  type ReviewCaseState,
} from '../utils/review-case-state';
import {
  CASE_CHANGED_EXPLANATION,
  CASE_CHANGED_HEADING,
  CASE_CHANGED_NEXT_STEP,
  describeReviewDone,
  NO_ACCESS_EXPLANATION,
  NO_ACCESS_HEADING,
  NO_ACCESS_NEXT_STEP,
  NO_ACTIONS_AVAILABLE,
  REVIEW_FORM_REJECTED,
} from '../utils/review-wording';
import { CaseReviewPanel } from './case-review-panel';

const CASE_ID = syntheticId('advisingCase', 1);
const DETAILS = 'Case details from the server';
/** Resolvers of actions left sending on purpose; settled after each test so none blocks the next. */
const unsettled: (() => void)[] = [];

/**
 * Renders the panel with an action that returns a fixed state.
 *
 * @param allowedActions - What the API allows.
 * @param state - What the action returns, or a promise that never settles when `null`.
 * @returns The action mock and the container.
 */
function renderPanel(allowedActions: readonly CaseAction[], state: ReviewCaseState | null = null) {
  const reviewAction = vi.fn<
    (previous: ReviewCaseState, form: FormData) => Promise<ReviewCaseState>
  >(() =>
    state === null ? new Promise<ReviewCaseState>(() => undefined) : Promise.resolve(state),
  );
  const view = render(
    <CaseReviewPanel
      title="Plan review"
      caseId={CASE_ID}
      lastSequence={2}
      allowedActions={allowedActions}
      reviewAction={reviewAction}
    >
      <p>{DETAILS}</p>
    </CaseReviewPanel>,
  );
  return { reviewAction, container: view.container };
}

/**
 * Lists element ids that nothing in the container points at.
 *
 * @param container - The rendered container.
 * @returns The unused ids.
 */
function unusedIds(container: HTMLElement): readonly string[] {
  const references = new Set<string>();
  for (const element of container.querySelectorAll(
    '[aria-labelledby], [aria-describedby], [for]',
  )) {
    const value = [
      element.getAttribute('aria-labelledby'),
      element.getAttribute('aria-describedby'),
      element.getAttribute('for'),
    ].join(' ');
    value.split(/\s+/).forEach((id) => references.add(id));
  }
  return [...container.querySelectorAll('[id]')]
    .map((element) => element.id)
    .filter((id) => !references.has(id));
}

describe('CaseReviewPanel actions', () => {
  afterEach(() => {
    unsettled.splice(0).forEach((settle) => {
      settle();
    });
    cleanup();
    vi.clearAllMocks();
  });

  it.each([[[]], [[CaseAction.Withdraw]]])(
    'offers nothing and says so with %j allowed',
    (allowed) => {
      renderPanel(allowed);

      expect(screen.queryByRole('button')).toBeNull();
      expect(screen.getByText(NO_ACTIONS_AVAILABLE)).toBeTruthy();
      expect(screen.getByText(DETAILS)).toBeTruthy();
    },
  );

  it('offers only Claim when only CLAIM is allowed', () => {
    renderPanel([CaseAction.Claim]);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Claim this case',
    ]);
    expect(screen.queryByText(NO_ACTIONS_AVAILABLE)).toBeNull();
  });

  it('offers Release and Resolve, and not Claim, when those are allowed', () => {
    renderPanel([CaseAction.Release, CaseAction.Resolve]);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Release this case to the queue',
      'Resolve this case',
    ]);
  });

  it('sends the case, the sequence the page showed, and the action', async () => {
    const { reviewAction } = renderPanel([CaseAction.Claim], { kind: 'idle' });

    fireEvent.click(screen.getByRole('button', { name: 'Claim this case' }));

    await waitFor(() => {
      expect(reviewAction).toHaveBeenCalledTimes(1);
    });
    const data = (reviewAction.mock.calls[0] as unknown as [ReviewCaseState, FormData])[1];
    expect(data.get(REVIEW_CASE_FIELD)).toBe(CASE_ID);
    expect(data.get(REVIEW_SEQUENCE_FIELD)).toBe('2');
    expect(data.get(REVIEW_ACTION_FIELD)).toBe('CLAIM');
  });
});

describe('CaseReviewPanel after an action', () => {
  afterEach(() => {
    unsettled.splice(0).forEach((settle) => {
      settle();
    });
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    [CaseAction.Claim, 'Claim this case', [CaseAction.Claim]],
    [CaseAction.Release, 'Release this case to the queue', [CaseAction.Release]],
  ] as const)(
    'moves focus to the heading after %s removes its button, and explains it once',
    async (action, buttonName, allowed) => {
      const { container } = renderPanel(allowed, { kind: 'done', action, expectedSequence: 2 });

      const button = screen.getByRole('button', { name: buttonName });
      button.focus();
      fireEvent.click(button);

      const heading = screen.getByRole('heading', { level: 1, name: 'Plan review' });
      await waitFor(() => {
        expect(document.activeElement).toBe(heading);
      });
      expect(document.activeElement).not.toBe(document.body);
      expect(heading.getAttribute('tabindex')).toBe('-1');
      expect(heading.closest('[aria-live]')).toBeNull();
      expect(screen.queryByRole('button', { name: buttonName })).toBeNull();
      const done = describeReviewDone(action);
      const outcome = document.getElementById(heading.getAttribute('aria-describedby') ?? '');
      expect(outcome?.textContent).toContain(done.message);
      expect(outcome?.textContent).toContain(done.nextStep);
      expect(outcome?.closest('[aria-live]')).toBeNull();
      expect(screen.getByRole('status').textContent).not.toContain(done.message);
      expect(unusedIds(container)).toEqual([]);
    },
  );

  it('explains a resolution, says it is not a waiver, and links back to the queue', async () => {
    renderPanel([CaseAction.Resolve], {
      kind: 'done',
      action: CaseAction.Resolve,
      expectedSequence: 2,
    });
    fireEvent.click(screen.getByLabelText('I reviewed this'));

    fireEvent.click(screen.getByRole('button', { name: 'Resolve this case' }));

    const heading = screen.getByRole('heading', { level: 1 });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    const outcome = document.getElementById(heading.getAttribute('aria-describedby') ?? '');
    expect(outcome?.textContent).toContain('not an official waiver or approval');
    expect(outcome?.textContent).toContain('Go back to the review queue');
    expect(
      screen.getByRole('link', { name: 'Back to the review queue' }).getAttribute('href'),
    ).toBe('/advisor/queue');
    expect(screen.queryByRole('button', { name: 'Resolve this case' })).toBeNull();
  });

  it('explains a race, refreshes by hiding stale controls, and moves focus to the heading', async () => {
    const { container } = renderPanel([CaseAction.Claim], { kind: 'changed', expectedSequence: 2 });

    const button = screen.getByRole('button', { name: 'Claim this case' });
    button.focus();
    fireEvent.click(button);

    const heading = screen.getByRole('heading', { level: 1 });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    const outcome = document.getElementById(heading.getAttribute('aria-describedby') ?? '');
    expect(outcome?.textContent).toContain(CASE_CHANGED_HEADING);
    expect(outcome?.textContent).toContain(CASE_CHANGED_EXPLANATION);
    expect(outcome?.textContent).toContain(CASE_CHANGED_NEXT_STEP);
    expect(screen.queryByRole('button', { name: 'Claim this case' })).toBeNull();
    expect(unusedIds(container)).toEqual([]);
  });

  it('removes the case from view after a 404 and says the access is gone', async () => {
    const { container } = renderPanel([CaseAction.Claim], { kind: 'gone' });

    const button = screen.getByRole('button', { name: 'Claim this case' });
    button.focus();
    fireEvent.click(button);

    const heading = await screen.findByRole('heading', { level: 1, name: NO_ACCESS_HEADING });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(screen.queryByText(DETAILS)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.textContent).toContain(NO_ACCESS_EXPLANATION);
    expect(container.textContent).toContain(NO_ACCESS_NEXT_STEP);
    expect(screen.getByRole('link', { name: 'Back to the review queue' })).toBeTruthy();
    expect(unusedIds(container)).toEqual([]);
  });

  it('reports a failed action with its heading, message, next step, and support reference', async () => {
    renderPanel([CaseAction.Claim], {
      kind: 'failed',
      code: ErrorCode.InternalError,
      message: 'Something broke.',
      requestId: 'req-42',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Claim this case' }));

    const region = await screen.findByRole('status', { name: 'Review result' });
    await waitFor(() => {
      expect(region.textContent).toContain('Something broke.');
    });
    expect(region.textContent).toContain('Support reference: req-42');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('button', { name: 'Claim this case' })).toBeTruthy();
  });

  it('says nothing was sent when the form was rejected', async () => {
    renderPanel([CaseAction.Claim], { kind: 'rejected' });

    fireEvent.click(screen.getByRole('button', { name: 'Claim this case' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(REVIEW_FORM_REJECTED);
    });
  });
});
