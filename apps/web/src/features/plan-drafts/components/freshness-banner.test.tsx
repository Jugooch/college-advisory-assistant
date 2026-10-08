/**
 * @file Tests for the plan detail freshness banner: every state and reason renders its heading,
 * explanation, and next step as text; no banned claim; axe.
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { PlanStaleReason } from '@caa/domain';
import {
  buildPlanFreshnessView,
  buildStalePlanFreshnessView,
  buildUnknownPlanFreshnessView,
} from '@caa/test-kit';

import { describeStaleReason } from '../utils/plan-wording';
import { FreshnessBanner } from './freshness-banner';

describe('FreshnessBanner', () => {
  afterEach(cleanup);

  it('shows up to date with no reasons', () => {
    const { container } = render(<FreshnessBanner freshness={buildPlanFreshnessView()} />);

    expect(screen.getByRole('heading', { name: 'This draft is up to date' })).toBeTruthy();
    expect(container.querySelector('li')).toBeNull();
    expect(container.textContent).toContain('You can revalidate at any time');
  });

  it('shows out of date with the explanation, one line per reason, and the next step', () => {
    const reasons = [PlanStaleReason.StudentRecordSuperseded, PlanStaleReason.SourceExpired];
    const { container } = render(
      <FreshnessBanner freshness={buildStalePlanFreshnessView({ reasons })} />,
    );

    expect(screen.getByRole('heading', { name: 'This draft is out of date' })).toBeTruthy();
    expect(container.textContent).toContain('history from when it was saved');
    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Your course record changed after this draft was saved.',
      'The data this draft used is older than allowed.',
    ]);
    expect(container.textContent).toContain('Revalidate to build a new revision');
    expect(container.textContent).not.toMatch(/up to date/);
  });

  it.each(Object.values(PlanStaleReason).filter((r) => r !== 'SOURCE_UNAVAILABLE'))(
    'shows the sentence for stale reason %s',
    (reason) => {
      const { container } = render(
        <FreshnessBanner freshness={buildStalePlanFreshnessView({ reasons: [reason] })} />,
      );

      expect(container.querySelector('li')?.textContent).toBe(describeStaleReason(reason));
    },
  );

  it('shows couldn’t check with a human route, never up to date', () => {
    const { container } = render(<FreshnessBanner freshness={buildUnknownPlanFreshnessView()} />);

    expect(
      screen.getByRole('heading', {
        name: 'We couldn’t check whether this draft is still current',
      }),
    ).toBeTruthy();
    expect(container.querySelector('li')?.textContent).toContain('couldn’t be reached');
    expect(container.textContent).toContain('ask an advisor');
    expect(container.textContent).not.toMatch(/up to date/);
  });

  it('shows the state as text in a badge, so color is never the only signal', () => {
    const { container } = render(<FreshnessBanner freshness={buildStalePlanFreshnessView()} />);

    expect(container.textContent).toContain('Out of date');
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-09-22T09:00:00.000-05:00',
    );
  });

  it.each([
    buildPlanFreshnessView(),
    buildStalePlanFreshnessView(),
    buildUnknownPlanFreshnessView(),
  ])('has no registration or validation claim and no axe violations for %o', async (freshness) => {
    const { container } = render(<FreshnessBanner freshness={freshness} />);

    expect(container.textContent).not.toMatch(/registered|enrolled|approved|validated/i);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
