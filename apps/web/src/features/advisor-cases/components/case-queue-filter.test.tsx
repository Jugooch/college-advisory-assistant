/**
 * @file Tests for the queue filter: labelled select, the selected filter, the admin-only
 * Unrouted option, and no axe violations.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';

import { CaseQueueFilter } from './case-queue-filter';

/**
 * Lists the option labels of the filter select.
 *
 * @returns The option texts, in order.
 */
function optionLabels(): readonly (string | null)[] {
  return screen.getAllByRole('option').map((option) => option.textContent);
}

describe('CaseQueueFilter', () => {
  afterEach(cleanup);

  it('offers every status and no Unrouted option to an advisor', () => {
    render(<CaseQueueFilter filter={{ kind: 'all' }} isAdmin={false} />);

    expect(optionLabels()).toEqual([
      'All cases',
      'Open',
      'In review',
      'Resolved',
      'Withdrawn by the student',
    ]);
  });

  it('offers Unrouted to an admin', () => {
    render(<CaseQueueFilter filter={{ kind: 'all' }} isAdmin />);

    expect(optionLabels()).toContain('Unrouted (no advisor assigned)');
  });

  it('is a labelled GET form whose select shows the filter in use', () => {
    render(<CaseQueueFilter filter={{ kind: 'status', status: CaseStatus.InReview }} isAdmin />);

    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Show' });
    expect(select.value).toBe('IN_REVIEW');
    expect(select.name).toBe('filter');
    expect(select.form?.method).toBe('get');
    expect(screen.getByRole('button', { name: 'Apply filter' })).toBeTruthy();
    expect(screen.getByRole('search', { name: 'Filter the review queue' })).toBeTruthy();
  });

  it('shows Unrouted selected for an admin who chose it', () => {
    render(<CaseQueueFilter filter={{ kind: 'unrouted' }} isAdmin />);

    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('unrouted');
  });

  it('has no axe violations', async () => {
    const { container } = render(<CaseQueueFilter filter={{ kind: 'all' }} isAdmin />);

    const results = await axe.run(container);

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
