/**
 * @file Tests for the plan row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { PlanRow } from '../tables/plan.table';
import { toPlan } from './plan.mapper';

const ROW: PlanRow = {
  id: '9f4e5d6c-7b8a-4f9e-a0d1-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  termId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  createdAt: new Date('2026-10-01T15:00:00.000Z'),
};

describe('toPlan', () => {
  it('round-trips the row with the timestamp as an ISO string', () => {
    expect(toPlan(ROW)).toEqual({ ...ROW, createdAt: '2026-10-01T15:00:00.000Z' });
  });

  it('rejects a stored row that is not a valid plan', () => {
    expect(() => toPlan({ ...ROW, studentId: 'not-a-uuid' })).toThrow(ZodError);
  });
});
