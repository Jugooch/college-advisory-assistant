/**
 * @file Tests for the queue body: the table when there are rows, and for every filter an empty
 * state that renders its heading, explanation, and next step.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { CaseStatus } from '@caa/domain';
import { buildCaseQueueItem } from '@caa/test-kit';

import type { QueueFilter } from '../utils/queue-filter';
import { describeEmptyQueue } from '../utils/review-wording';
import { CaseQueue } from './case-queue';

const NOW = new Date('2026-09-25T12:00:00.000-05:00');

describe('CaseQueue', () => {
  afterEach(cleanup);

  it('shows the table when there are cases', () => {
    render(
      <CaseQueue queue={{ cases: [buildCaseQueueItem()] }} filter={{ kind: 'all' }} now={NOW} />,
    );

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.queryByText('No cases to review')).toBeNull();
  });

  it.each<readonly [string, QueueFilter]>([
    ['all cases', { kind: 'all' }],
    ['a status', { kind: 'status', status: CaseStatus.Open }],
    ['unrouted', { kind: 'unrouted' }],
  ])('renders the empty state for %s with its explanation and next step', async (_name, filter) => {
    const { container } = render(<CaseQueue queue={{ cases: [] }} filter={filter} now={NOW} />);

    const empty = describeEmptyQueue(filter);
    const region = screen.getByRole('region', { name: empty.heading });
    expect(region.textContent).toContain(empty.explanation);
    expect(region.textContent).toContain(empty.nextStep);
    expect(screen.queryByRole('table')).toBeNull();
    const results = await axe.run(container);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
