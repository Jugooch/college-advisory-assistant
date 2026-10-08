/**
 * @file Tests for the My plans list: the empty state, one row per term, freshness and case text,
 * keyboard-friendly table structure, banned wording, and axe.
 */
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { PlannableTerm, PlanSummary } from '@caa/api-contract';
import { PlanIdSchema, TermIdSchema } from '@caa/domain';
import {
  buildPlanFreshnessView,
  buildStalePlanFreshnessView,
  buildUnknownPlanFreshnessView,
  syntheticId,
} from '@caa/test-kit';

import { PlanList } from './plan-list';

const STUDENT_ID = syntheticId('student', 1);
const FALL = TermIdSchema.parse(syntheticId('term', 1));
const SPRING = TermIdSchema.parse(syntheticId('term', 2));
const FALL_CODE = 'FA-SYN';
const TERMS: readonly PlannableTerm[] = [
  { id: FALL, termCode: FALL_CODE, startsOn: '2027-01-11', endsOn: '2027-05-07' },
];

/**
 * Builds a plan summary.
 *
 * @param seed - Distinguishes plans.
 * @param fields - Fields to replace.
 * @returns The summary.
 */
function summary(seed: number, fields: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: PlanIdSchema.parse(syntheticId('plan', seed)),
    termId: FALL,
    latestRevision: 2,
    createdAt: '2026-10-07T09:00:00.000-05:00',
    outcome: 'OPTIONS_FOUND',
    freshness: buildPlanFreshnessView(),
    openCaseStatus: null,
    ...fields,
  };
}

/**
 * Renders the list.
 *
 * @param plans - The plans.
 * @param terms - The term names, or null.
 * @returns The container.
 */
function renderList(plans: readonly PlanSummary[], terms: readonly PlannableTerm[] | null = TERMS) {
  return render(
    <PlanList
      studentId={STUDENT_ID}
      plans={plans}
      terms={terms}
      plannerHref={`/next-term-planner?studentId=${STUDENT_ID}`}
    />,
  ).container;
}

describe('PlanList', () => {
  afterEach(cleanup);

  it('shows a clear empty state with a way to start', () => {
    const container = renderList([]);

    expect(container.textContent).toContain('You haven’t saved a draft yet.');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      `/next-term-planner?studentId=${STUDENT_ID}`,
    );
    expect(container.querySelector('table')).toBeNull();
  });

  it('links each term to its plan detail for the student', () => {
    const container = renderList([summary(1)]);

    expect(container.querySelector('tbody th a')?.getAttribute('href')).toBe(
      `/my-plans/${syntheticId('plan', 1)}?studentId=${STUDENT_ID}`,
    );
  });

  it('shows one row per term with revision, time, freshness text, and case status', () => {
    const container = renderList([
      summary(1, { openCaseStatus: 'IN_REVIEW' }),
      summary(2, {
        termId: SPRING,
        latestRevision: 1,
        freshness: buildStalePlanFreshnessView(),
      }),
    ]);

    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('FA-SYN');
    expect(rows[0]?.textContent).toContain('Revision 2');
    expect(rows[0]?.textContent).toContain('Up to date');
    expect(rows[0]?.textContent).toContain('Open case, an advisor is reviewing it');
    expect(rows[1]?.textContent).toContain('Term (code not available)');
    expect(rows[1]?.textContent).toContain('Out of date');
    expect(rows[1]?.textContent).toContain('No open case');
  });

  it('shows couldn’t check with its reason, never up to date', () => {
    const container = renderList([summary(1, { freshness: buildUnknownPlanFreshnessView() })]);

    expect(container.textContent).toContain('Couldn’t check');
    expect(container.textContent).not.toContain('Up to date');
    expect(container.querySelector('li')?.textContent).toContain('couldn’t be reached');
  });

  it('explains out of date and couldn’t check, each with a next step', () => {
    const container = renderList([
      summary(1, { freshness: buildUnknownPlanFreshnessView() }),
      summary(2, { termId: SPRING, freshness: buildStalePlanFreshnessView() }),
    ]);

    expect(container.textContent).toContain('We couldn’t compare this draft');
    expect(container.textContent).toContain('ask your advisor to review this draft');
    expect(container.textContent).toContain('Something this draft was built on has changed');
    expect(container.textContent).toContain('Plan next term again');
  });

  it('offers Ask an advisor for a plan with no open case, linking to that plan', () => {
    const container = renderList([summary(1)]);

    const link = container.querySelector('tbody td a');
    expect(link?.textContent).toBe(`Ask an advisor about the ${FALL_CODE} draft`);
    const url = new URL(link?.getAttribute('href') ?? '', 'http://x');
    expect(url.pathname).toBe('/ask-an-advisor');
    expect(url.searchParams.get('studentId')).toBe(STUDENT_ID);
    expect(url.searchParams.get('planId')).toBe(syntheticId('plan', 1));
  });

  it('links to the open case instead of offering a second one', () => {
    const container = renderList([summary(1, { openCaseStatus: 'OPEN' })]);

    const link = container.querySelector('tbody td a');
    expect(link?.textContent).toBe(`See your case about the ${FALL_CODE} draft`);
    expect(link?.getAttribute('href')).toBe(`/help-and-cases?studentId=${STUDENT_ID}`);
  });

  it('gives each row’s case link a different accessible name', () => {
    const container = renderList([
      summary(1, { openCaseStatus: 'OPEN' }),
      summary(2, { termId: SPRING, openCaseStatus: 'OPEN' }),
      summary(3),
      summary(4, { termId: SPRING }),
    ]);

    const names = [...container.querySelectorAll('tbody td a')].map((a) => a.textContent);
    expect(new Set(names).size).toBe(4);
  });

  it('labels the table and its headers for screen readers', () => {
    const container = renderList([summary(1)]);

    expect(container.querySelector('caption')?.textContent).toContain('saved drafts');
    expect(
      [...container.querySelectorAll('thead th')].map((th) => th.getAttribute('scope')),
    ).toEqual(['col', 'col', 'col', 'col']);
    expect(container.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
  });

  it('shows no user ID, plan ID, or registration wording', () => {
    const container = renderList([summary(1)]);

    expect(container.textContent).not.toContain(syntheticId('plan', 1));
    expect(container.textContent).not.toMatch(/registered|enrolled|approved/i);
  });

  it.each([
    ['empty', [] as PlanSummary[]],
    ['with rows', [summary(1), summary(2, { termId: SPRING })]],
  ])('has no axe violations when %s', async (_name, plans) => {
    const container = renderList(plans);

    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
