/**
 * @file Tests for the review queue table: headers, row-specific link names, ownership and routing
 * as text, ages, no IDs, and no axe violations.
 */
// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { CaseReason, CaseStatus } from '@caa/domain';
import { buildCaseQueueItem, buildUnroutedCaseQueueItem } from '@caa/test-kit';

import { CaseQueueTable, UNROUTED_NOTE } from './case-queue-table';

const NOW = new Date('2026-09-25T12:00:00.000-05:00');
const ROWS = [
  buildCaseQueueItem({ createdAt: '2026-09-22T10:00:00.000-05:00' }, 1),
  buildCaseQueueItem(
    {
      reason: CaseReason.NeedsVerification,
      status: CaseStatus.InReview,
      ownerIsYou: true,
      createdAt: '2026-09-24T09:00:00.000-05:00',
    },
    2,
  ),
  buildUnroutedCaseQueueItem({ createdAt: '2026-09-24T11:00:00.000-05:00' }, 3),
];

describe('CaseQueueTable', () => {
  afterEach(cleanup);

  it('has column headers for reason, status, age, and whether the case is yours', () => {
    render(<CaseQueueTable cases={ROWS} now={NOW} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Reason', 'Status', 'Age', 'Yours', 'Open']);
    expect(screen.getByRole('table').querySelector('caption')?.textContent).toContain(
      'oldest first',
    );
  });

  it('shows each row’s reason, status, age, and ownership as text', () => {
    render(<CaseQueueTable cases={ROWS} now={NOW} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toContain('Plan review');
    expect(rows[0]?.textContent).toContain('Open');
    expect(rows[0]?.textContent).toContain('3 days');
    expect(rows[0]?.textContent).toContain('Not yours');
    expect(rows[1]?.textContent).toContain('Checks that could not be verified');
    expect(rows[1]?.textContent).toContain('In review');
    expect(within(rows[1] ?? document.body).getByText('Yours')).toBeTruthy();
  });

  it('marks an unrouted case in words and leaves a routed one unmarked', () => {
    render(<CaseQueueTable cases={ROWS} now={NOW} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[2]?.textContent).toContain(UNROUTED_NOTE);
    expect(rows[0]?.textContent).not.toContain(UNROUTED_NOTE);
  });

  it('gives every row a distinct link name with the reason and when it was opened', () => {
    render(<CaseQueueTable cases={ROWS} now={NOW} />);

    const links = screen.getAllByRole('link');
    const names = links.map((link) => link.textContent);
    expect(new Set(names).size).toBe(3);
    expect(names[0]).toMatch(/^Review “Plan review”, opened Sep 22, 2026, .* UTC$/);
    expect(names[1]).toContain('Checks that could not be verified');
    expect(links[0]?.getAttribute('href')).toBe(`/advisor/cases/${ROWS[0]?.caseId ?? ''}`);
  });

  it('shows no student or case ID as text', () => {
    const { container } = render(<CaseQueueTable cases={ROWS} now={NOW} />);

    for (const row of ROWS) {
      expect(container.textContent).not.toContain(row.studentId);
      expect(container.textContent).not.toContain(row.caseId);
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(<CaseQueueTable cases={ROWS} now={NOW} />);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
