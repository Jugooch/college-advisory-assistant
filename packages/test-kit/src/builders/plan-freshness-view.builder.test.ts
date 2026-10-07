/**
 * @file Tests for the synthetic plan freshness builders.
 */
import { describe, expect, it } from 'vitest';

import { PlanFreshnessViewSchema } from '@caa/api-contract';

import {
  buildPlanFreshnessView,
  buildStalePlanFreshnessView,
  buildUnknownPlanFreshnessView,
} from './plan-freshness-view.builder';

describe('plan freshness view builders', () => {
  it('builds CURRENT with no reasons', () => {
    const view = buildPlanFreshnessView();

    expect(view).toEqual({
      state: 'CURRENT',
      reasons: [],
      checkedAt: '2026-09-22T09:00:00.000-05:00',
    });
    expect(PlanFreshnessViewSchema.safeParse(view).success).toBe(true);
  });

  it('builds STALE with a reason, and accepts several', () => {
    expect(buildStalePlanFreshnessView()).toMatchObject({
      state: 'STALE',
      reasons: ['SECTIONS_SUPERSEDED'],
    });
    expect(
      buildStalePlanFreshnessView({ reasons: ['AUDIT_SUPERSEDED', 'RULESET_CHANGED'] }).reasons,
    ).toEqual(['AUDIT_SUPERSEDED', 'RULESET_CHANGED']);
  });

  it('builds UNKNOWN with SOURCE_UNAVAILABLE', () => {
    expect(buildUnknownPlanFreshnessView()).toMatchObject({
      state: 'UNKNOWN',
      reasons: ['SOURCE_UNAVAILABLE'],
    });
  });

  it('fails loudly for a state its reasons contradict', () => {
    expect(() => buildPlanFreshnessView({ reasons: ['AUDIT_SUPERSEDED'] })).toThrow();
    expect(() => buildStalePlanFreshnessView({ reasons: [] })).toThrow();
    expect(() => buildUnknownPlanFreshnessView({ reasons: ['AUDIT_SUPERSEDED'] })).toThrow();
  });
});
