/**
 * @file Tests for the synthetic plan revision builders.
 */
import { describe, expect, it } from 'vitest';

import { PlanRevisionSchema } from '@caa/domain';

import { buildNoOptionsPlanRevision, buildPlanRevision } from './plan-revision.builder';

describe('buildPlanRevision', () => {
  it('defaults to a first OPTIONS_FOUND revision with a sorted two-section selection', () => {
    const revision = buildPlanRevision();

    expect(revision.id).toBe('e1000000-0000-4000-8000-000000000001');
    expect(revision.planId).toBe('e0000000-0000-4000-8000-000000000001');
    expect(revision.revision).toBe(1);
    expect(revision.outcome).toBe('OPTIONS_FOUND');
    expect(revision.selectedSectionIds).toEqual([
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000002',
    ]);
    expect(revision.constraintHash).toBe(`sha256:${'0a'.repeat(32)}`);
  });

  it('derives the id from the seed and applies overrides', () => {
    const revision = buildPlanRevision({ revision: 2, cause: 'REVALIDATED' }, 3);

    expect(revision.id).toBe('e1000000-0000-4000-8000-000000000003');
    expect(revision.revision).toBe(2);
    expect(revision.cause).toBe('REVALIDATED');
  });

  it('passes the domain schema', () => {
    expect(PlanRevisionSchema.safeParse(buildPlanRevision()).success).toBe(true);
  });

  it('rejects an OPTIONS_FOUND revision with a null selection', () => {
    expect(() => buildPlanRevision({ selectedSectionIds: null })).toThrow();
  });
});

describe('buildNoOptionsPlanRevision', () => {
  it('builds a NO_FEASIBLE_PLAN revision with a null selection that passes the schema', () => {
    const revision = buildNoOptionsPlanRevision();

    expect(revision.outcome).toBe('NO_FEASIBLE_PLAN');
    expect(revision.selectedSectionIds).toBeNull();
    expect(PlanRevisionSchema.safeParse(revision).success).toBe(true);
  });

  it('allows another no-options outcome via overrides', () => {
    expect(buildNoOptionsPlanRevision({ outcome: 'SEARCH_TIMEOUT' }).outcome).toBe(
      'SEARCH_TIMEOUT',
    );
  });
});
