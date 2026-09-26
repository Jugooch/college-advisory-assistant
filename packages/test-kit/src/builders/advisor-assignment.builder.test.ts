/**
 * @file Tests for the synthetic advisor assignment builder.
 */
import { describe, expect, it } from 'vitest';

import { AdvisorAssignmentSchema } from '@caa/domain';

import { buildAdvisorAssignment } from './advisor-assignment.builder';

describe('buildAdvisorAssignment', () => {
  it('defaults to an open-ended assignment of advisor 2 to student 1 in tenant A', () => {
    expect(buildAdvisorAssignment()).toEqual({
      id: '40000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      advisorUserId: '20000000-0000-4000-8000-000000000002',
      studentId: '30000000-0000-4000-8000-000000000001',
      effectiveFrom: '2026-08-17T00:00:00.000-05:00',
      effectiveTo: null,
      approvedBy: '20000000-0000-4000-8000-000000000003',
    });
  });

  it('returns deep-equal assignments for the same arguments', () => {
    expect(buildAdvisorAssignment({}, 5)).toEqual(buildAdvisorAssignment({}, 5));
  });

  it('derives the id from the seed', () => {
    expect(buildAdvisorAssignment({}, 5).id).toBe('40000000-0000-4000-8000-000000000005');
  });

  it('applies overrides', () => {
    const assignment = buildAdvisorAssignment({
      studentId: '30000000-0000-4000-8000-000000000009',
      effectiveTo: '2026-12-18T23:59:59.000-06:00',
    });

    expect(assignment.studentId).toBe('30000000-0000-4000-8000-000000000009');
    expect(assignment.effectiveTo).toBe('2026-12-18T23:59:59.000-06:00');
  });

  it('returns an assignment that passes the domain schema', () => {
    expect(AdvisorAssignmentSchema.safeParse(buildAdvisorAssignment()).success).toBe(true);
  });

  it('rejects an assignment that ends before it starts', () => {
    expect(() =>
      buildAdvisorAssignment({ effectiveTo: '2026-08-16T00:00:00.000-05:00' }),
    ).toThrow();
  });
});
