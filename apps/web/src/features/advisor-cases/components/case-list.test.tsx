/**
 * @file Tests for the Help and cases list: the empty state with a next step, newest-first rows,
 * a row whose detail failed to load, and axe.
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CaseView } from '@caa/api-contract';
import { buildCaseView, buildSourceDiscrepancyCaseView } from '@caa/test-kit';

import type { CaseSummary } from '../utils/case-summary';
import { type CaseEntry, CaseList, DETAIL_UNAVAILABLE } from './case-list';

const PLANS_HREF = '/my-plans?studentId=abc';

/**
 * Builds the list row for a case view.
 *
 * @param view - The case view.
 * @returns The summary the list endpoint would return.
 */
function summaryOf(view: CaseView): CaseSummary {
  return {
    id: view.id,
    reason: view.reason,
    planRevisionId: view.planRevisionId,
    discrepancySubject: view.discrepancySubject,
    status: view.status,
    createdAt: view.createdAt,
  };
}

/**
 * Renders the list.
 *
 * @param entries - The cases.
 * @returns The container.
 */
function renderList(entries: readonly CaseEntry[]): HTMLElement {
  return render(<CaseList entries={entries} withdrawAction={vi.fn()} plansHref={PLANS_HREF} />)
    .container;
}

describe('CaseList', () => {
  afterEach(cleanup);

  it('shows an empty state that says what to do next', () => {
    const container = renderList([]);

    expect(container.textContent).toContain('You haven’t asked an advisor about anything yet.');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(PLANS_HREF);
  });

  it('shows one article per case, in the order given', () => {
    const newer = buildCaseView({ createdAt: '2026-09-23T10:00:00.000-05:00' }, 2);
    const older = buildSourceDiscrepancyCaseView({}, 1);

    const container = renderList([
      { summary: summaryOf(newer), view: newer },
      { summary: summaryOf(older), view: older },
    ]);

    const headings = [...container.querySelectorAll('article > h3')].map((h) => h.textContent);
    expect(headings).toEqual([
      'Review my plan',
      'A problem with my record: A requirement on my degree audit',
    ]);
  });

  it('still shows the status from the list when a case’s detail couldn’t load', () => {
    const view = buildCaseView();

    const container = renderList([{ summary: summaryOf(view), view: null }]);

    expect(container.textContent).toContain('Waiting for an advisor');
    expect(container.textContent).toContain(DETAIL_UNAVAILABLE);
    expect(container.textContent).toContain('Opened');
    expect(container.textContent).not.toContain(view.id);
  });

  it.each([
    ['empty', [] as CaseEntry[]],
    [
      'with a loaded and an unloaded case',
      [
        { summary: summaryOf(buildCaseView({}, 1)), view: buildCaseView({}, 1) },
        { summary: summaryOf(buildCaseView({}, 2)), view: null },
      ] as CaseEntry[],
    ],
  ])('has no axe violations when %s', async (_name, entries) => {
    const container = renderList(entries);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
