/**
 * @file Tests for the synthetic plan revision view and plan view builders.
 */
import { describe, expect, it } from 'vitest';

import { PlanRevisionViewSchema, PlanViewSchema } from '@caa/api-contract';

import { buildStalePlanFreshnessView } from './plan-freshness-view.builder';
import {
  buildPlanRevisionView,
  buildPlanView,
  buildResultUnavailablePlanRevisionView,
} from './plan-revision-view.builder';

describe('buildPlanRevisionView', () => {
  it('defaults to a CURRENT OPTIONS_FOUND revision whose result matches it, with no createdBy', () => {
    const view = buildPlanRevisionView();

    expect(PlanRevisionViewSchema.safeParse(view).success).toBe(true);
    expect(view).not.toHaveProperty('createdBy');
    expect(view).toMatchObject({
      id: 'e1000000-0000-4000-8000-000000000001',
      revision: 1,
      outcome: 'OPTIONS_FOUND',
      courseIds: ['50000000-0000-4000-8000-000000000102'],
      resultUnavailable: false,
      freshness: { state: 'CURRENT', reasons: [] },
    });
    expect(view.result?.pinnedInputs.rulesetVersion).toBe(view.rulesetVersion);
    expect(view.selectedSectionIds).toHaveLength(1);
  });

  it('carries a stale freshness marker', () => {
    const view = buildPlanRevisionView({ freshness: buildStalePlanFreshnessView() });

    expect(view.freshness.state).toBe('STALE');
  });

  it('keeps the result pinned to the revision when a pinned input is overridden', () => {
    const view = buildPlanRevisionView({ rulesetVersion: 'demo-2026.2' });

    expect(view.result?.pinnedInputs.rulesetVersion).toBe('demo-2026.2');
  });

  it('derives the id from the seed', () => {
    expect(buildPlanRevisionView({}, 4).id).toBe('e1000000-0000-4000-8000-000000000004');
  });

  it('builds a result-unavailable view with a null result', () => {
    const view = buildResultUnavailablePlanRevisionView();

    expect(view.result).toBeNull();
    expect(view.resultUnavailable).toBe(true);
    expect(PlanRevisionViewSchema.safeParse(view).success).toBe(true);
  });

  it('fails loudly when resultUnavailable contradicts the result', () => {
    expect(() => buildPlanRevisionView({ resultUnavailable: true })).toThrow();
    expect(() => buildPlanRevisionView({ result: null })).not.toThrow();
  });

  it('fails loudly when the selection is not one of the result options', () => {
    expect(() =>
      buildPlanRevisionView({ selectedSectionIds: ['c0000000-0000-4000-8000-000000000099'] }),
    ).toThrow();
  });
});

describe('buildPlanView', () => {
  it('defaults to a one-revision plan whose latest matches the index', () => {
    const view = buildPlanView();

    expect(PlanViewSchema.safeParse(view).success).toBe(true);
    expect(view.id).toBe(view.latest.planId);
    expect(view.revisions).toEqual([
      { revision: 1, cause: 'SAVED', createdAt: view.latest.createdAt },
    ]);
  });

  it('fills the index for a later latest revision', () => {
    const view = buildPlanView({
      latest: buildPlanRevisionView({ revision: 2, cause: 'REVALIDATED' }),
    });

    expect(view.revisions.map((entry) => entry.revision)).toEqual([1, 2]);
    expect(view.revisions[1]?.cause).toBe('REVALIDATED');
  });

  it('derives the id from the seed', () => {
    expect(buildPlanView({}, 3).id).toBe('e0000000-0000-4000-8000-000000000003');
  });
});
