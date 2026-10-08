/**
 * @file Tests for the withdraw control: it sends the case and sequence, keeps keyboard focus
 * while sending, and explains each outcome with a next step in one polite live region.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@caa/domain';
import { syntheticId } from '@caa/test-kit';

import { CASE_CHANGED, FORM_REJECTED } from '@/shared/utils/case-wording';
import { describeError } from '@/shared/utils/error-code-wording';

import {
  WITHDRAW_CASE_FIELD,
  WITHDRAW_SEQUENCE_FIELD,
  type WithdrawCaseState,
} from '../utils/withdraw-case-state';
import { WithdrawCaseForm, WITHDRAWN_MESSAGE } from './withdraw-case-form';

const CASE_ID = syntheticId('advisingCase', 1);

/**
 * Renders the form with an action that returns a fixed state.
 *
 * @param state - The state the action returns.
 * @returns The action mock and the container.
 */
function renderForm(state: WithdrawCaseState) {
  const withdrawAction = vi.fn(async () => Promise.resolve(state));
  const view = render(
    <WithdrawCaseForm withdrawAction={withdrawAction} caseId={CASE_ID} lastSequence={2} />,
  );
  return { withdrawAction, container: view.container };
}

describe('WithdrawCaseForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends the case and the sequence the page showed', async () => {
    const { withdrawAction } = renderForm({ kind: 'withdrawn' });

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this case' }));

    await waitFor(() => {
      expect(withdrawAction).toHaveBeenCalledTimes(1);
    });
    const data = (withdrawAction.mock.calls[0] as unknown as [WithdrawCaseState, FormData])[1];
    expect(data.get(WITHDRAW_CASE_FIELD)).toBe(CASE_ID);
    expect(data.get(WITHDRAW_SEQUENCE_FIELD)).toBe('2');
  });

  it('confirms the withdrawal, removes the button, and moves focus to the message', async () => {
    renderForm({ kind: 'withdrawn' });

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this case' }));

    const message = await screen.findByText(WITHDRAWN_MESSAGE);
    await waitFor(() => {
      expect(document.activeElement).toBe(message);
    });
    expect(message.closest('[aria-live]')).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.queryByRole('button', { name: 'Withdraw this case' })).toBeNull();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('explains a changed case and says to reload', async () => {
    renderForm({ kind: 'changed' });

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this case' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(CASE_CHANGED);
    });
    expect(screen.getByRole('button', { name: 'Withdraw this case' })).toBeTruthy();
  });

  it('explains a rejected form', async () => {
    renderForm({ kind: 'rejected' });

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this case' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(FORM_REJECTED);
    });
  });

  it.each([ErrorCode.NotFound, ErrorCode.SourceUnavailable])(
    'explains %s with its heading, message, next step, and reference, keeping focus',
    async (code) => {
      renderForm({ kind: 'failed', code, message: 'API says so', requestId: 'req-5' });
      const button = screen.getByRole('button', { name: 'Withdraw this case' });
      button.focus();

      fireEvent.click(button);

      const region = screen.getByRole('status');
      await waitFor(() => {
        expect(region.textContent).toContain(describeError(code).heading);
      });
      expect(region.textContent).toContain('API says so');
      expect(region.textContent).toContain(describeError(code).nextStep);
      expect(region.textContent).toContain('req-5');
      expect(document.activeElement).toBe(button);
    },
  );

  it('keeps the button focusable and inert while sending', async () => {
    const withdrawAction = vi.fn(async () => new Promise<WithdrawCaseState>(() => undefined));
    render(<WithdrawCaseForm withdrawAction={withdrawAction} caseId={CASE_ID} lastSequence={1} />);
    const button = screen.getByRole('button', { name: 'Withdraw this case' });
    button.focus();

    fireEvent.click(button);

    await waitFor(() => {
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('status').textContent).toContain('Withdrawing…');
    fireEvent.click(button);
    expect(withdrawAction).toHaveBeenCalledTimes(1);
  });

  it.each<[string, WithdrawCaseState]>([
    ['idle', { kind: 'idle' }],
    ['withdrawn', { kind: 'withdrawn' }],
    ['changed', { kind: 'changed' }],
  ])('has no axe violations in the %s state', async (_name, state) => {
    const { container } = renderForm(state);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this case' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
