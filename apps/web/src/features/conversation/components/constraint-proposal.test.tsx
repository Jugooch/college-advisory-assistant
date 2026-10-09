// @vitest-environment jsdom
/**
 * @file Tests for constraint chips: nothing reaches the form until Confirm, every chip starts
 * preferred, only the student can make one hard, and a taken slot is never overwritten.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConstraintStrength, Weekday } from '@caa/domain';
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
    expect(screen.getAllByRole('button', { name: /^Confirm/u })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Edit/u })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Dismiss/u })).toHaveLength(2);
    expect(screen.getAllByRole('group').length).toBeGreaterThanOrEqual(2);
  });

  it('changes nothing until Confirm: toggling, editing and dismissing never touch the form', () => {
    render(<ConstraintProposal constraints={[buildProposedConstraint()]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Required (hard)' }));
    fireEvent.click(screen.getByRole('button', { name: /^Edit/u }));
    fireEvent.click(screen.getByRole('button', { name: /^Edit/u }));
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss/u }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/dismissed, nothing changed/)).toBeTruthy();
  });

  it('confirms a preferred chip into the form and returns to the form step', () => {
    render(<ConstraintProposal constraints={[buildProposedConstraint()]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/u }));
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
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/u }));
    expect(sentQuery().get('modality-strength')).toBe(ConstraintStrength.Hard);
  });

  it('applies a valid edit and refuses an invalid one', () => {
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildCreditRange() })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Edit/u }));
    fireEvent.change(screen.getByLabelText(/Most credits/), { target: { value: 'lots' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert').textContent).toContain('valid limit');
    const max = screen.getByLabelText(/Most credits/);
    expect(max.getAttribute('aria-invalid')).toBe('true');
    expect(max.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
    expect(max.getAttribute('aria-describedby')).toContain(`${max.id}-hint`);
    expect(document.activeElement).toBe(screen.getByLabelText(/Fewest credits/));
    fireEvent.change(screen.getByLabelText(/Most credits/), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText(/and 12.5 credits/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/u }));
    expect(sentQuery().get('credit-range-max')).toBe('12.5');
  });

  it('does not overwrite a slot the student already filled', () => {
    search.set('credit-range-max', '15');
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildCreditRange() })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/u }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getAllByText(/already has an entry/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Confirm/u })).toBeTruthy();
  });

  it('puts a Friday block in the next free slot when the form already has another day', () => {
    search.set('block1-day', 'MONDAY');
    render(<ConstraintProposal constraints={[buildProposedConstraint()]} />);
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/u }));
    const query = sentQuery();
    expect(query.getAll('block1-day')).toEqual(['MONDAY']);
    expect(query.getAll('block2-day')).toEqual(['FRIDAY']);
  });

  it('keeps values typed on the form but not yet sent', () => {
    render(
      <>
        <form id="planner-form">
          <input type="checkbox" name="block1-day" value="MONDAY" defaultChecked />
          <input name="block1-start" defaultValue="09:00" />
        </form>
        <ConstraintProposal constraints={[buildProposedConstraint()]} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Confirm/u }));
    const query = sentQuery();
    expect(query.getAll('block1-day')).toEqual(['MONDAY']);
    expect(query.get('block1-start')).toBe('09:00');
    expect(query.getAll('block2-day')).toEqual(['FRIDAY']);
  });

  it('applies two quick Confirms before the page URL has caught up', () => {
    render(
      <ConstraintProposal
        constraints={[
          buildProposedConstraint(),
          buildProposedConstraint({ constraint: buildCreditRange() }),
          buildProposedConstraint({
            constraint: buildUnavailableTime({ weekdays: [Weekday.Monday] }),
          }),
        ]}
      />,
    );
    screen.getAllByRole('button', { name: /^Confirm/u }).forEach((button) => {
      fireEvent.click(button);
    });
    expect(replace).toHaveBeenCalledTimes(3);
    const last = new URL(String(replace.mock.calls[2]?.[0]), 'http://localhost').searchParams;
    expect(last.getAll('block1-day')).toEqual(['FRIDAY']);
    expect(last.getAll('block2-day')).toEqual(['MONDAY']);
    expect(last.has('credit-range-max')).toBe(true);
  });

  it('shows a chip as added when the form already holds it, and adds nothing twice', () => {
    search.append('block1-day', 'FRIDAY');
    render(<ConstraintProposal constraints={[buildProposedConstraint()]} />);
    expect(screen.getByText(/added to the form/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Confirm/u })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('moves focus to the outcome after Confirm and after Dismiss', () => {
    render(
      <ConstraintProposal
        constraints={[
          buildProposedConstraint(),
          buildProposedConstraint({ constraint: buildCreditRange() }),
        ]}
      />,
    );
    screen
      .getAllByRole('button', { name: /^Confirm/u })
      .slice(0, 1)
      .forEach((button) => {
        fireEvent.click(button);
      });
    expect(document.activeElement?.textContent).toContain('added to the form');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(screen.getByRole('button', { name: /^Dismiss/u }));
    expect(document.activeElement?.textContent).toContain('dismissed');
  });

  it('returns focus to Edit after a valid edit is saved', () => {
    render(
      <ConstraintProposal
        constraints={[buildProposedConstraint({ constraint: buildCreditRange() })]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Edit/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Edit/u }));
  });
});
