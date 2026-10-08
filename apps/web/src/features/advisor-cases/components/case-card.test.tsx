/**
 * @file Tests for one case as the student sees it: every status's label, explanation and next
 * step, the resolution labeled as advice, the frozen plan "as saved on" with its freshness, the
 * withdraw control only when the API allows it, and no IDs or approval wording.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CaseView } from '@caa/api-contract';
import { CaseAction, CaseResolution, CaseStatus, Role } from '@caa/domain';
import {
  buildCaseEventView,
  buildCaseView,
  buildClaimCaseEventView,
  buildPlanFreshnessView,
  buildPlanRevisionView,
  buildResolveCaseEventView,
  buildSourceDiscrepancyCaseView,
  buildStalePlanFreshnessView,
  buildUnknownPlanFreshnessView,
} from '@caa/test-kit';

import { ADVICE_NOT_PERMISSION, describeCaseStatus } from '../utils/case-wording';
import { CaseCard } from './case-card';

const withdrawAction = vi.fn();

/** A resolved case as the owning student sees it: the advisor acted, the student did not. */
const RESOLVED = buildCaseView({
  status: CaseStatus.Resolved,
  owner: { role: Role.Advisor, isYou: false },
  lastSequence: 3,
  events: [
    buildCaseEventView({}, 11),
    buildClaimCaseEventView({ isYou: false }, 12),
    buildResolveCaseEventView({ isYou: false, resolution: CaseResolution.StudentActionNeeded }, 13),
  ],
});
const IN_REVIEW = buildCaseView({
  status: CaseStatus.InReview,
  owner: { role: Role.Advisor, isYou: false },
  lastSequence: 2,
  events: [buildCaseEventView({}, 11), buildClaimCaseEventView({ isYou: false }, 12)],
});
const WITHDRAWN = buildCaseView({
  status: CaseStatus.Withdrawn,
  lastSequence: 2,
  events: [
    buildCaseEventView({}, 11),
    buildCaseEventView(
      {
        sequence: 2,
        action: CaseAction.Withdraw,
        fromStatus: CaseStatus.Open,
        toStatus: CaseStatus.Withdrawn,
      },
      12,
    ),
  ],
});

/**
 * Renders a case.
 *
 * @param view - The case view.
 * @returns The container.
 */
function renderCase(view: CaseView): HTMLElement {
  return render(<CaseCard view={view} withdrawAction={withdrawAction} />).container;
}

describe('CaseCard', () => {
  afterEach(cleanup);

  it.each([
    ['OPEN', buildCaseView()],
    ['IN_REVIEW', IN_REVIEW],
    ['RESOLVED', RESOLVED],
    ['WITHDRAWN', WITHDRAWN],
  ])('shows the %s label, what it means, and what to do next', (_name, view) => {
    const container = renderCase(view);

    const wording = describeCaseStatus(view.status);
    expect(container.textContent).toContain(wording.label);
    expect(container.textContent).toContain(wording.explanation);
    expect(container.textContent).toContain(wording.nextStep);
  });

  it('shows the creation time, reason, and the student’s own note', () => {
    const container = renderCase(buildCaseView());

    expect(container.querySelector('h3')?.textContent).toBe('Review my plan');
    expect(container.querySelector('dd time')?.getAttribute('datetime')).toBe(
      '2026-09-22T10:00:00.000-05:00',
    );
    expect(container.textContent).toContain('Please check this plan before I register.');
  });

  it('shows the resolution as advice with the date, the resolution, and the advisor note', () => {
    const container = renderCase(RESOLVED);

    const section = screen.getByRole('region', { name: 'Advisor review' });
    expect(section.textContent).toContain('Reviewed by your advisor on');
    expect(section.textContent).toContain(ADVICE_NOT_PERMISSION);
    expect(section.textContent).toContain('Your advisor says you have a next step');
    expect(section.textContent).toContain('Reviewed the plan with the student.');
    expect(section.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-09-22T12:00:00.000-05:00',
    );
    expect(container.textContent).not.toMatch(/approved|granted|waived|exception/i);
  });

  it('shows no advisor review before the case is resolved', () => {
    renderCase(IN_REVIEW);

    expect(screen.queryByRole('region', { name: 'Advisor review' })).toBeNull();
  });

  it('labels the frozen plan “as saved on” a date, with its freshness as text', () => {
    const container = renderCase(buildCaseView());

    const plan = screen.getByRole('region', { name: /Plan revision 1 attached/ });
    expect(plan.textContent).toMatch(/Revision 1, as saved on .* UTC/);
    expect(plan.textContent).toContain('not a newer one');
    expect(plan.textContent).toContain('Up to date');
    expect(plan.textContent).toContain('not a registration');
    expect(container.textContent).not.toMatch(/approved|enrolled/i);
  });

  it.each([
    ['Out of date', buildStalePlanFreshnessView()],
    ['Couldn’t check', buildUnknownPlanFreshnessView()],
  ])('shows a frozen plan that is %s with its explanation and next step', (label, freshness) => {
    const container = renderCase(buildCaseView({ context: buildPlanRevisionView({ freshness }) }));

    expect(container.textContent).toContain(label);
    expect(container.textContent).not.toContain('Up to date');
    expect(container.textContent).toContain('Treat it as history');
  });

  it('shows a source discrepancy with its subject and that records are unchanged, and no plan', () => {
    const container = renderCase(buildSourceDiscrepancyCaseView());

    expect(container.querySelector('h3')?.textContent).toBe(
      'A problem with my record: A requirement on my degree audit',
    );
    expect(container.textContent).toContain('doesn’t change your official records');
    expect(screen.queryByRole('region', { name: /attached to this case/ })).toBeNull();
  });

  it('offers withdraw only when the API lists it in allowedActions', () => {
    renderCase(buildCaseView({ allowedActions: [CaseAction.Withdraw] }));

    expect(screen.getByRole('button', { name: 'Withdraw this case' })).toBeTruthy();
  });

  it.each([
    ['no actions', []],
    ['an action other than WITHDRAW', [CaseAction.Release]],
  ])('offers no withdraw with %s', (_name, allowedActions) => {
    renderCase(buildCaseView({ allowedActions }));

    expect(screen.queryByRole('button', { name: 'Withdraw this case' })).toBeNull();
  });

  it('lists the history by role, with You for the student and no IDs or names', () => {
    const container = renderCase(RESOLVED);

    const items = [...container.querySelectorAll('ol li')].map((item) => item.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('You opened the case');
    expect(items[1]).toContain('Your advisor started reviewing');
    expect(items[2]).toContain('Your advisor finished reviewing');
    for (const id of [RESOLVED.id, RESOLVED.studentId, ...RESOLVED.events.map((e) => e.id)]) {
      expect(container.textContent).not.toContain(id);
    }
  });

  it('has no axe violations for any status, with the resolution and the withdraw control', async () => {
    for (const view of [
      buildCaseView({ allowedActions: [CaseAction.Withdraw] }),
      IN_REVIEW,
      RESOLVED,
      WITHDRAWN,
      buildSourceDiscrepancyCaseView(),
      buildCaseView({ context: buildPlanRevisionView({ freshness: buildPlanFreshnessView() }) }),
    ]) {
      const container = renderCase(view);

      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });

      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      cleanup();
    }
  });
});
