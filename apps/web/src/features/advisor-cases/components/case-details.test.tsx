/**
 * @file Tests for the reviewer's case details: the student's note, the frozen plan "as saved on"
 * with its read-time freshness as history, a discrepancy without a plan, the history by role, no
 * IDs, and no axe violations.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { CaseView } from '@caa/api-contract';
import { CaseResolution, CaseStatus, Role } from '@caa/domain';
import {
  buildCaseEventView,
  buildCaseView,
  buildClaimCaseEventView,
  buildInReviewCaseView,
  buildPlanRevisionView,
  buildResolveCaseEventView,
  buildResolvedCaseView,
  buildSourceDiscrepancyCaseView,
  buildStalePlanFreshnessView,
  buildUnknownPlanFreshnessView,
} from '@caa/test-kit';

import { CaseDetails } from './case-details';

/**
 * Renders the details.
 *
 * @param view - The case view.
 * @returns The container.
 */
function renderDetails(view: CaseView): HTMLElement {
  return render(<CaseDetails view={view} />).container;
}

describe('CaseDetails', () => {
  afterEach(cleanup);

  it('shows the status, who holds the case, when it opened, and the student’s note', () => {
    const container = renderDetails(buildInReviewCaseView());

    expect(container.textContent).toContain('In review');
    expect(container.textContent).toContain('You are reviewing this case.');
    expect(container.querySelector('dd time')?.getAttribute('datetime')).toBe(
      '2026-09-22T10:00:00.000-05:00',
    );
    expect(container.textContent).toContain('Please check this plan before I register.');
  });

  it('labels the frozen plan “as saved on” a date, as history, with its freshness', () => {
    const container = renderDetails(buildCaseView());

    const plan = screen.getByRole('region', { name: 'Plan attached to this case' });
    expect(plan.textContent).toMatch(/Revision 1, as saved on .* UTC/);
    expect(plan.textContent).toContain('This is history');
    expect(plan.textContent).toContain('not necessarily their current plan');
    expect(plan.textContent).toContain('not a registration');
    expect(plan.textContent).toContain('Up to date');
    expect(container.textContent).not.toMatch(/\b(approved|enrolled)\b/i);
  });

  it.each([
    ['Out of date', buildStalePlanFreshnessView()],
    ['Couldn’t check', buildUnknownPlanFreshnessView()],
  ])('shows a frozen plan that is %s, never as current', (label, freshness) => {
    const container = renderDetails(
      buildCaseView({ context: buildPlanRevisionView({ freshness }) }),
    );

    expect(container.textContent).toContain(label);
    expect(container.textContent).not.toContain('Up to date');
  });

  it('shows a source discrepancy with its subject, that records are unchanged, and no plan', () => {
    const container = renderDetails(buildSourceDiscrepancyCaseView());

    expect(container.textContent).toContain('A requirement on my degree audit');
    expect(container.textContent).toContain('changes no official record');
    expect(container.textContent).toContain('No plan is attached to this report.');
    expect(screen.queryByRole('region', { name: 'Plan attached to this case' })).toBeNull();
  });

  it('lists the history by role, with the resolution and the note the student can read', () => {
    const view = buildResolvedCaseView({
      events: [
        buildCaseEventView({ isYou: false }, 11),
        buildClaimCaseEventView({ actorRole: Role.Admin, isYou: false }, 12),
        buildResolveCaseEventView(
          { isYou: false, resolution: CaseResolution.ReferredOutsideApp, note: 'Call the office.' },
          13,
        ),
      ],
      owner: { role: Role.Advisor, isYou: false },
    });
    const container = renderDetails(view);

    const items = [...container.querySelectorAll('ol li')].map((item) => item.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('The student opened the case');
    expect(items[1]).toContain('An administrator started reviewing');
    expect(items[2]).toContain('Another advisor finished reviewing');
    expect(items[2]).toContain('Outcome: I am following up outside this app');
    expect(items[2]).toContain('Note the student can read: Call the office.');
    expect(view.status).toBe(CaseStatus.Resolved);
  });

  it('shows no user, student, case, or event ID', () => {
    const view = buildResolvedCaseView();
    const container = renderDetails(view);

    for (const id of [view.id, view.studentId, ...view.events.map((event) => event.id)]) {
      expect(container.textContent).not.toContain(id);
    }
  });

  it('labels each section by its heading and has no axe violations', async () => {
    for (const view of [
      buildCaseView(),
      buildInReviewCaseView(),
      buildResolvedCaseView(),
      buildSourceDiscrepancyCaseView(),
    ]) {
      const container = renderDetails(view);

      for (const section of container.querySelectorAll('section')) {
        const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '');
        expect(heading?.tagName).toBe('H2');
      }
      const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false }, 'heading-order': { enabled: false } },
      });
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
      cleanup();
    }
  });
});
