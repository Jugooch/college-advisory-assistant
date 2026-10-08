/**
 * @file Tests for the revalidate form in a browser-like DOM: the exact fields it sends,
 * aria-disabled while pending, the status region for every outcome, no focus move, and axe.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { syntheticId } from '@caa/test-kit';

import { parseRevalidateForm } from '../utils/revalidate-form';
import type { RevalidateState } from '../utils/revalidate-state';
import { RevalidateForm } from './revalidate-form';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const STUDENT_ID = syntheticId('student', 1);
const PLAN_ID = syntheticId('plan', 1);

/**
 * Renders the form with an action that returns a fixed state.
 *
 * @param state - The state the action returns, or a promise for it.
 * @returns The action mock and the container.
 */
function renderForm(state: RevalidateState | Promise<RevalidateState>) {
  const revalidateAction = vi.fn(async () => Promise.resolve(state));
  const view = render(
    <RevalidateForm
      revalidateAction={revalidateAction}
      studentId={STUDENT_ID}
      planId={PLAN_ID}
      revision={2}
      hasSelection
    />,
  );
  return { revalidateAction, container: view.container };
}

describe('RevalidateForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends the plan and the revision the student is looking at', async () => {
    const { revalidateAction } = renderForm({ kind: 'conflict' });

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));

    await waitFor(() => {
      expect(revalidateAction).toHaveBeenCalledTimes(1);
    });
    const submitted = revalidateAction.mock.calls[0] as unknown as [RevalidateState, FormData];
    expect(parseRevalidateForm(submitted[1])).toEqual({
      studentId: STUDENT_ID,
      planId: PLAN_ID,
      body: { expectedRevision: 2 },
      hadSelection: true,
    });
  });

  it('says what revalidating does and doesn’t do, tied to the form', () => {
    const { container } = renderForm({ kind: 'conflict' });

    const note = container.querySelector('#revalidate-note');
    expect(note?.textContent).toContain('never replaces an earlier one');
    expect(note?.textContent).toContain('doesn’t register you');
    expect(container.querySelector('form')?.getAttribute('aria-describedby')).toBe(
      'revalidate-note',
    );
  });

  it('reports the new revision and refreshes the page to load it', async () => {
    renderForm({ kind: 'revalidated', revision: 2, selection: 'chosen-again' });

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));

    const region = screen.getByRole('status');
    await within(region).findByText(/Revision 2 was added/);
    expect(region.textContent).toContain(
      'Your earlier choice is no longer available; choose an option',
    );
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('reloads the latest revision with a message on a conflict', async () => {
    renderForm({ kind: 'conflict' });

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));

    await within(screen.getByRole('status')).findByText(/we loaded the latest revision/);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ['STALE_SOURCE', 'your records are being refreshed'],
    ['SOURCE_UNAVAILABLE', 'a source system is unavailable'],
  ] as const)('shows the %s referral and does not refresh', async (code, text) => {
    renderForm({ kind: 'blocked', code });

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));

    await within(screen.getByRole('status')).findByText(new RegExp(text));
    expect(screen.getByRole('status').textContent).toContain('Nothing was changed');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('explains a rejected form and an API error with a support reference', async () => {
    const { container } = renderForm({
      kind: 'failed',
      code: 'NOT_FOUND',
      message: 'No such plan',
      requestId: 'req-5',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));

    await within(screen.getByRole('status')).findByText(/No such plan/);
    expect(container.querySelector('code')?.textContent).toBe('req-5');
  });

  it('shows the rejected message when nothing was sent', async () => {
    renderForm({ kind: 'rejected' });

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));

    await within(screen.getByRole('status')).findByText(/couldn’t be read/);
  });

  it('uses aria-disabled, not disabled, while pending, and ignores a second click', async () => {
    let finish: (state: RevalidateState) => void = () => undefined;
    const { revalidateAction } = renderForm(
      new Promise<RevalidateState>((resolve) => {
        finish = resolve;
      }),
    );
    const button = screen.getByRole('button', { name: 'Revalidate' });

    fireEvent.click(button);
    await within(screen.getByRole('status')).findByText('Revalidating…');

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    expect(revalidateAction).toHaveBeenCalledTimes(1);
    finish({ kind: 'conflict' });
    await within(screen.getByRole('status')).findByText(/loaded the latest revision/);
  });

  it('never moves focus, and keeps a single status region as the only announcement', async () => {
    const { container } = renderForm({ kind: 'conflict' });
    const button = screen.getByRole('button', { name: 'Revalidate' });
    button.focus();

    fireEvent.click(button);

    await within(screen.getByRole('status')).findByText(/loaded the latest revision/);
    expect(document.activeElement).toBe(button);
    expect(container.querySelectorAll('[role="status"], [aria-live], [role="alert"]')).toHaveLength(
      1,
    );
    expect(container.querySelector('[tabindex]')).toBeNull();
  });

  it('has no unused ids, no banned wording, and no axe violations', async () => {
    const { container } = renderForm({ kind: 'conflict' });
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));
    await within(screen.getByRole('status')).findByText(/loaded the latest revision/);

    for (const element of container.querySelectorAll('[id]')) {
      const id = element.getAttribute('id') ?? '';
      expect(
        container.querySelector(`[aria-describedby~="${id}"], [aria-labelledby~="${id}"]`),
      ).not.toBeNull();
    }
    expect(container.textContent).not.toMatch(/registered|enrolled|approved|validated/i);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
