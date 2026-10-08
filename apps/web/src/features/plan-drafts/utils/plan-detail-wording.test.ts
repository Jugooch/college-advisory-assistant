/**
 * @file Tests for the plan detail wording: a banner for every freshness state, the boundary, and
 * the banned registration and current-validation claims.
 */
import { describe, expect, it } from 'vitest';

import { PlanFreshness, PlanRevisionCause } from '@caa/domain';

import {
  describeFreshnessBanner,
  describeRevisionCause,
  EARLIER_REVISION_LABEL,
  EARLIER_REVISION_NOTE,
  PLAN_BOUNDARY_NOTE,
  RESULT_UNAVAILABLE_DETAIL,
} from './plan-detail-wording';

const BANNED = /registered|enrolled|approved|validated/i;

describe('describeFreshnessBanner', () => {
  it('uses the issue’s headings for out of date and couldn’t check', () => {
    expect(describeFreshnessBanner(PlanFreshness.Stale).heading).toBe('This draft is out of date');
    expect(describeFreshnessBanner(PlanFreshness.Unknown).heading).toBe(
      'We couldn’t check whether this draft is still current',
    );
  });

  it('never shows UNKNOWN or STALE as up to date', () => {
    const headings = Object.values(PlanFreshness).map((s) => describeFreshnessBanner(s).heading);

    expect(new Set(headings).size).toBe(headings.length);
    expect(headings[1]).not.toMatch(/up to date/);
    expect(headings[2]).not.toMatch(/up to date/);
  });

  it.each([PlanFreshness.Stale, PlanFreshness.Unknown])(
    'says the %s checks are history and points to revalidating or an advisor',
    (state) => {
      const banner = describeFreshnessBanner(state);

      expect(banner.explanation).toMatch(/history/);
      expect(banner.nextStep).toMatch(/revalidat/i);
      expect(banner.nextStep).toMatch(/advisor/);
    },
  );

  it.each(Object.values(PlanFreshness))('keeps %s free of banned claims', (state) => {
    const { heading, explanation, nextStep } = describeFreshnessBanner(state);

    expect(`${heading} ${explanation} ${nextStep}`).not.toMatch(BANNED);
  });
});

describe('fixed messages', () => {
  it('states the plan-vs-registration boundary without claiming a registration', () => {
    expect(PLAN_BOUNDARY_NOTE).toContain('isn’t a registration');
    expect(PLAN_BOUNDARY_NOTE).not.toMatch(BANNED);
  });

  it('says the unreadable result can’t be displayed and offers both routes', () => {
    expect(RESULT_UNAVAILABLE_DETAIL).toContain('This saved result can’t be displayed');
    expect(RESULT_UNAVAILABLE_DETAIL).toContain('revalidate');
    expect(RESULT_UNAVAILABLE_DETAIL).toContain('advisor');
  });

  it('labels an earlier revision read-only', () => {
    expect(EARLIER_REVISION_LABEL).toBe('Earlier revision');
    expect(EARLIER_REVISION_NOTE).toContain('read-only');
  });
});

describe('describeRevisionCause', () => {
  it('names each cause without a validated claim', () => {
    expect(describeRevisionCause(PlanRevisionCause.Saved)).toBe('Saved');
    expect(describeRevisionCause(PlanRevisionCause.Revalidated)).toBe('Revalidation');
    expect(describeRevisionCause(PlanRevisionCause.Revalidated)).not.toMatch(BANNED);
  });
});
