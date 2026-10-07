/**
 * @file Tests for the plan row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { buildPlan } from '@caa/test-kit';

import type { PlanRow } from '../tables/plan.table';
import { toPlan } from './plan.mapper';

const PLAN = buildPlan();
const ROW: PlanRow = { ...PLAN, createdAt: new Date(PLAN.createdAt) };

describe('toPlan', () => {
  it('round-trips the row with the timestamp as an ISO string', () => {
    expect(toPlan(ROW)).toEqual({ ...PLAN, createdAt: new Date(PLAN.createdAt).toISOString() });
  });

  it('rejects a stored row that is not a valid plan', () => {
    expect(() => toPlan({ ...ROW, studentId: 'not-a-uuid' })).toThrow(ZodError);
  });
});
