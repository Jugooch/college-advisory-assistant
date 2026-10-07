/**
 * @file Tests for the synthetic plan builder.
 */
import { describe, expect, it } from 'vitest';

import { PlanSchema } from '@caa/domain';

import { buildPlan } from './plan.builder';

describe('buildPlan', () => {
  it('defaults to a plan for student 1 in tenant A for the synthetic term', () => {
    expect(buildPlan()).toEqual({
      id: 'e0000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      studentId: '30000000-0000-4000-8000-000000000001',
      termId: 'b0000000-0000-4000-8000-000000000004',
      createdAt: '2026-09-21T09:00:00.000-05:00',
    });
  });

  it('derives the id from the seed and applies overrides', () => {
    const plan = buildPlan({ studentId: '30000000-0000-4000-8000-000000000009' }, 4);

    expect(plan.id).toBe('e0000000-0000-4000-8000-000000000004');
    expect(plan.studentId).toBe('30000000-0000-4000-8000-000000000009');
  });

  it('returns a plan that passes the domain schema', () => {
    expect(PlanSchema.safeParse(buildPlan()).success).toBe(true);
  });
});
