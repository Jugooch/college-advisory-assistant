/**
 * @file Accessibility tests for the review panel: a button stays focusable with aria-disabled while
 * sending, every id it renders is used, the article is labelled by its heading, and axe finds no
 * violations in any state.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaseAction, ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import type { ReviewCaseState } from '../utils/review-case-state';
import { CASE_CHANGED_HEADING, NO_ACCESS_HEADING } from '../utils/review-wording';
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

describe('CaseReviewPanel accessibility', () => {
  afterEach(() => {
    unsettled.splice(0).forEach((settle) => {
      settle();
    });
    cleanup();
    vi.clearAllMocks();
  });

  it('uses every id it renders and labels the article by its heading', () => {
    const { container } = renderPanel([CaseAction.Resolve, CaseAction.Release]);

    const article = screen.getByRole('article', { name: 'Plan review' });
    expect(article.getAttribute('aria-labelledby')).toBe(
      screen.getByRole('heading', { level: 1 }).id,
    );
    expect(unusedIds(container)).toEqual([]);
  });

  it.each<readonly [string, ReviewCaseState | null, string]>([
    ['every action offered', null, 'Claim this case'],
    [
      'a failure',
      { kind: 'failed', code: ErrorCode.InternalError, message: 'Broke.', requestId: 'r' },
      'Broke.',
    ],
    ['a race', { kind: 'changed', expectedSequence: 2 }, CASE_CHANGED_HEADING],
    ['a 404', { kind: 'gone' }, NO_ACCESS_HEADING],
  ])('has no axe violations with %s', async (_name, state, marker) => {
    const { container } = renderPanel([CaseAction.Claim, CaseAction.Resolve], state);
    if (state !== null) {
      fireEvent.click(screen.getByRole('button', { name: 'Claim this case' }));
    }
    await waitFor(() => {
      expect(container.textContent).toContain(marker);
    });

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

// NOTE: last on purpose. An action left sending blocks later actions in the same file.
describe('CaseReviewPanel while sending', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the button focusable with aria-disabled while sending, and ignores a second click', async () => {
    const { reviewAction } = renderPanel([CaseAction.Claim], null);
    const button = screen.getByRole('button', { name: 'Claim this case' });
    button.focus();

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('status').textContent).toContain('Saving…');
    fireEvent.click(button);
    expect(reviewAction).toHaveBeenCalledTimes(1);
  });
});
