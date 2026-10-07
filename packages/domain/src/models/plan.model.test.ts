/**
 * @file Tests for the plan data object.
 */
import { describe, expect, it } from 'vitest';

import { createPlan, PlanSchema } from './plan.model';

const PLAN = {
  id: '7b000000-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  termId: '3a000000-0000-4000-8000-000000000001',
  createdAt: '2026-10-07T09:00:00.000-05:00',
};

describe('PlanSchema', () => {
  it('accepts a plan', () => {
    expect(createPlan(PLAN)).toEqual(PLAN);
  });

  it('rejects unknown keys', () => {
    expect(PlanSchema.safeParse({ ...PLAN, extra: 1 }).success).toBe(false);
  });

  it('rejects a time without an offset', () => {
    expect(PlanSchema.safeParse({ ...PLAN, createdAt: '2026-10-07T09:00:00' }).success).toBe(false);
  });

  it('rejects a missing tenant', () => {
    expect(PlanSchema.safeParse({ ...PLAN, tenantId: undefined }).success).toBe(false);
  });
});
