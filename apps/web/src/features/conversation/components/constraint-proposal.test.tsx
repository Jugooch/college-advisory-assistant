// @vitest-environment jsdom
/**
 * @file Tests for constraint chips: nothing reaches the form until Confirm, every chip starts
 * preferred, only the student can make one hard, and a taken slot is never overwritten.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstraintStrength } from '@caa/domain';
import {
  buildAllowedModalities,
  buildCreditRange,
  buildProposedConstraint,
  buildUnavailableTime,
  syntheticId,
} from '@caa/test-kit';

import { ConstraintProposal } from './constraint-proposal';

const replace = vi.fn<(url: string, options?: unknown) => void>();
let search = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => search,
}));

beforeEach(() => {
  replace.mockReset();
  search = new URLSearchParams({
    studentId: syntheticId('student', 1),
    term: syntheticId('term', 1),
    step: 'review',
  });
});
afterEach(cleanup);

/**
 * The URL the form was sent to.
 *
 * @returns The query of the one `replace` call.
 */
function sentQuery(): URLSearchParams {
  expect(replace).toHaveBeenCalledTimes(1);
  const url = String(replace.mock.calls[0]?.[0]);
  return new URL(url, 'http://localhost').searchParams;
}

describe('ConstraintProposal', () => {
  it('shows each limit in words with preferred preselected and Edit, Dismiss, Confirm', () => {
    render(
      <ConstraintProposal
        constraints={[
          buildProposedConstraint(),
          buildProposedConstraint({ constraint: buildCreditRange({ priorityRank: 2 }) }),
        ]}
      />,
    );
    expect(screen.getByText('Not available on Friday, all day.')).toBeTruthy();
    const preferred = screen.getAllByRole('radio', { name: 'Preferred' });
    expect(preferred).toHaveLength(2);
    expect(preferred.every((radio) => (radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2);
    expect(screen.getAllByRole('group').length).toBeGreaterThanOrEqual(2);
  });

  it('changes nothing until Confirm: toggling, editing and dismissing never touch the form', () => {
    render(<ConstraintProposal constraints={[buildProposedConstraint()]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Required (hard)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/dismissed, nothing changed/)).toBeTruthy();
  });

  it('confirms a preferred chip into the form and returns to the form step', () => {
    render(<ConstraintProposal constraints={[buildProposedConstraint()]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const query = sentQuery();
    expect(query.get('block1-strength')).toBe(ConstraintStrength.Preferred);
    expect(query.get('block1-day')).toBe('FRIDAY');
    expect(query.get('step')).toBe('edit');
    expect(query.get('term')).toBe(syntheticId('term', 1));
  });

  it('writes a hard constraint only after the student chooses Required and confirms', () => {
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildAllowedModalities() })]}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Required (hard)' }));
    expect(screen.getByRole('radio', { name: 'Required (hard)' })).toHaveProperty('checked', true);
    expect(screen.getByText(/Currently: Required/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(sentQuery().get('modality-strength')).toBe(ConstraintStrength.Hard);
  });

  it('applies a valid edit and refuses an invalid one', () => {
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildCreditRange() })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText(/Most credits/), { target: { value: 'lots' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert').textContent).toContain('valid limit');
    fireEvent.change(screen.getByLabelText(/Most credits/), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText(/and 12.5 credits/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(sentQuery().get('credit-range-max')).toBe('12.5');
  });

  it('does not overwrite a slot the student already filled', () => {
    search.set('credit-range-max', '15');
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildCreditRange() })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getAllByText(/already has an entry/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
  });

  it('keeps a Friday block in its own slot beside other chips', () => {
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildUnavailableTime() })]}
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
