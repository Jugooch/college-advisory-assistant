/**
 * @file Tests for the advisor assignment data object.
 */
import { describe, expect, it } from 'vitest';

import { type AdvisorAssignmentInput, createAdvisorAssignment } from './advisor-assignment.model';

const VALID: AdvisorAssignmentInput = {
  id: '3c4d5e6f-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  advisorUserId: '1a2b3c4d-0000-4000-8000-000000000002',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  effectiveFrom: '2026-08-15T00:00:00.000-05:00',
  effectiveTo: '2026-12-20T00:00:00.000-06:00',
  approvedBy: '1a2b3c4d-0000-4000-8000-000000000003',
};

describe('createAdvisorAssignment', () => {
  it('accepts a bounded assignment', () => {
    expect(createAdvisorAssignment(VALID)).toEqual({
      id: '3c4d5e6f-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      advisorUserId: '1a2b3c4d-0000-4000-8000-000000000002',
      studentId: '2b3c4d5e-0000-4000-8000-000000000001',
      effectiveFrom: '2026-08-15T00:00:00.000-05:00',
      effectiveTo: '2026-12-20T00:00:00.000-06:00',
      approvedBy: '1a2b3c4d-0000-4000-8000-000000000003',
    });
  });

  it('accepts a null effectiveTo as open-ended', () => {
    expect(createAdvisorAssignment({ ...VALID, effectiveTo: null }).effectiveTo).toBeNull();
  });

  it('accepts effectiveTo equal to effectiveFrom as a zero-length assignment', () => {
    const assignment = createAdvisorAssignment({
      ...VALID,
      effectiveTo: '2026-08-15T00:00:00.000-05:00',
    });

    expect(assignment.effectiveTo).toBe('2026-08-15T00:00:00.000-05:00');
  });

  it('accepts the same instant written with a different offset', () => {
    const assignment = createAdvisorAssignment({
      ...VALID,
      effectiveTo: '2026-08-15T05:00:00.000Z',
    });

    expect(assignment.effectiveTo).toBe('2026-08-15T05:00:00.000Z');
  });

  it('rejects effectiveTo earlier than effectiveFrom', () => {
    expect(() =>
      createAdvisorAssignment({ ...VALID, effectiveTo: '2026-08-14T23:59:59.999-05:00' }),
    ).toThrow(/effectiveTo must not be earlier than effectiveFrom/);
  });

  it('rejects an earlier instant that sorts later as a string', () => {
    expect(() =>
      createAdvisorAssignment({ ...VALID, effectiveTo: '2026-08-15T04:00:00.000Z' }),
    ).toThrow(/effectiveTo must not be earlier than effectiveFrom/);
  });

  it('rejects an effectiveFrom without an offset', () => {
    expect(() =>
      createAdvisorAssignment({ ...VALID, effectiveFrom: '2026-08-15T00:00:00' }),
    ).toThrow();
  });

  it('rejects an approvedBy that is not a UUID', () => {
    expect(() => createAdvisorAssignment({ ...VALID, approvedBy: 'registrar' })).toThrow();
  });
});
