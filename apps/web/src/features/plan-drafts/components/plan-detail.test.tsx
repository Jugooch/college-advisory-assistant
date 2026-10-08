/**
 * @file Tests for the plan detail screen: header, every freshness state, the unreadable result,
 * the earlier-revision view, the plan-vs-registration boundary, banned wording, and axe.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlanRevisionView } from '@caa/api-contract';
import {
  buildPlanFreshnessView,
  buildPlanRevisionView,
  buildPlanView,
  buildResultUnavailablePlanRevisionView,
  buildStalePlanFreshnessView,
  buildUnknownPlanFreshnessView,
  syntheticId,
} from '@caa/test-kit';

import { PlanDetail } from './plan-detail';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const STUDENT_ID = syntheticId('student', 1);

/**
 * Renders the detail for a plan whose latest revision is `latest`.
 *
 * @param latest - The latest revision.
 * @param shown - The revision on screen; defaults to the latest.
 * @returns The container.
 */
function renderDetail(latest: PlanRevisionView, shown: PlanRevisionView = latest) {
  const plan = buildPlanView({ latest });
  const view = render(
    <PlanDetail
      revalidateAction={vi.fn()}
      studentId={STUDENT_ID}
      plan={plan}
      shown={shown}
      termCode="FA-SYN"
      plannerHref={`/next-term-planner?studentId=${STUDENT_ID}`}
      plansHref={`/my-plans?studentId=${STUDENT_ID}`}
      renderResult={(result, heading) => (
        <section aria-labelledby="stub-result-heading">
          <h2 id="stub-result-heading">{heading}</h2>
          <p>Outcome {result.outcome}</p>
        </section>
      )}
    />,
  );
  return { container: view.container, plan };
}

describe('PlanDetail', () => {
  afterEach(cleanup);

  it('shows the term, the revision and its saved time, and the boundary', () => {
    const { container } = renderDetail(
      buildPlanRevisionView({ revision: 2, cause: 'REVALIDATED' }),
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Plan for FA-SYN');
    expect(container.textContent).toMatch(/Revision 2, saved/);
    expect(container.textContent).toContain('A draft is a saved plan. It isn’t a registration');
  });

  it('shows an up to date draft with Revalidate and the result as of its time', () => {
    const { container } = renderDetail(buildPlanRevisionView());

    expect(screen.getByRole('heading', { name: 'This draft is up to date' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revalidate' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^Saved result, as of / })).toBeTruthy();
    expect(container.textContent).not.toContain('They are history');
  });

  it('shows out of date with reasons, history wording, and Revalidate, never as current', () => {
    const { container } = renderDetail(
      buildPlanRevisionView({
        freshness: buildStalePlanFreshnessView({
          reasons: ['STUDENT_RECORD_SUPERSEDED', 'SOURCE_EXPIRED'],
        }),
      }),
    );

    expect(screen.getByRole('heading', { name: 'This draft is out of date' })).toBeTruthy();
    expect(container.textContent).toContain(
      'Your course record changed after this draft was saved.',
    );
    expect(container.textContent).toContain('The data this draft used is older than allowed.');
    expect(container.textContent).toContain('They are history, not a current check.');
    expect(screen.getByRole('heading', { name: /^Saved result, as of / })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revalidate' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/up to date/);
  });

  it('shows couldn’t check with the revision still shown and an advisor route', () => {
    const { container } = renderDetail(
      buildPlanRevisionView({ freshness: buildUnknownPlanFreshnessView() }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'We couldn’t check whether this draft is still current',
      }),
    ).toBeTruthy();
    expect(container.textContent).toContain('Outcome ');
    expect(container.textContent).toContain('ask an advisor');
    expect(container.textContent).not.toMatch(/up to date/);
  });

  it('says an unreadable result can’t be displayed and shows nothing from it', () => {
    const { container } = renderDetail(buildResultUnavailablePlanRevisionView());

    expect(container.textContent).toContain('This saved result can’t be displayed');
    expect(container.textContent).toContain('revalidate');
    expect(container.textContent).toContain('advisor');
    expect(container.textContent).not.toContain('Outcome ');
    expect(screen.queryByRole('heading', { name: /^Saved result, as of / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Revalidate' })).toBeTruthy();
  });

  it('opens an earlier revision read-only, labeled, as history with no Revalidate', () => {
    const latest = buildPlanRevisionView({ revision: 2, cause: 'REVALIDATED' });
    const earlier = buildPlanRevisionView({ revision: 1 });
    const { container } = renderDetail(latest, earlier);

    expect(container.textContent).toContain('Earlier revision.');
    expect(container.textContent).toContain('read-only');
    expect(container.textContent).toMatch(/Revision 1, saved/);
    expect(container.textContent).toContain('They are history, not a current check.');
    expect(screen.queryByRole('button', { name: 'Revalidate' })).toBeNull();
    expect(
      screen.getAllByRole('link', { name: 'Go to the latest revision' })[0]?.getAttribute('href'),
    ).toBe(`/my-plans/${buildPlanView({ latest }).id}?studentId=${STUDENT_ID}`);
  });

  it('links history entries to earlier revisions and keeps revision 1 reachable', () => {
    const { plan } = renderDetail(buildPlanRevisionView({ revision: 3, cause: 'REVALIDATED' }));

    expect(screen.getByRole('link', { name: 'Revision 1' }).getAttribute('href')).toBe(
      `/my-plans/${plan.id}?studentId=${STUDENT_ID}&revision=1`,
    );
    expect(screen.getByRole('link', { name: 'Revision 3' }).getAttribute('href')).toBe(
      `/my-plans/${plan.id}?studentId=${STUDENT_ID}`,
    );
  });

  it('falls back to a plain term label when the term code isn’t available', () => {
    const latest = buildPlanRevisionView();
    render(
      <PlanDetail
        revalidateAction={vi.fn()}
        studentId={STUDENT_ID}
        plan={buildPlanView({ latest })}
        shown={latest}
        termCode={null}
        plannerHref="/next-term-planner"
        plansHref="/my-plans"
        renderResult={() => null}
      />,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('code not available');
  });

  it.each([
    ['current', buildPlanFreshnessView()],
    ['stale', buildStalePlanFreshnessView()],
    ['unknown', buildUnknownPlanFreshnessView()],
  ])('shows no user ID, banned wording, or axe violation when %s', async (_name, freshness) => {
    const { container } = renderDetail(buildPlanRevisionView({ freshness }));

    expect(container.textContent).not.toMatch(/registered|enrolled|approved|validated/i);
    expect(container.textContent).not.toContain(syntheticId('user', 1));
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  it('has one h1 and no duplicate ids', () => {
    const { container } = renderDetail(buildPlanRevisionView());

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
