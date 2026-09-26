/**
 * @file Tests for the advisor assignment row mapper.
 */
import { describe, expect, it } from 'vitest';

import type { AdvisorAssignmentRow } from '../tables/advisor-assignment.table';
import { toAdvisorAssignment } from './advisor-assignment.mapper';

const ROW: AdvisorAssignmentRow = {
  id: '9f4e5d6c-7b8a-4f9e-a0d1-3c4d5e6f7081',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  advisorUserId: '5d1c2b3a-4f5e-4d6c-8b7a-1a2b3c4d5e6f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  effectiveFrom: new Date('2026-08-15T05:00:00.000Z'),
  effectiveTo: new Date('2026-12-20T06:00:00.000Z'),
  approvedBy: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
};

describe('toAdvisorAssignment', () => {
  it('converts both effective dates to ISO strings', () => {
    const assignment = toAdvisorAssignment(ROW);

    expect(assignment.effectiveFrom).toBe('2026-08-15T05:00:00.000Z');
    expect(assignment.effectiveTo).toBe('2026-12-20T06:00:00.000Z');
  });

  it('keeps an open-ended assignment as null', () => {
    const assignment = toAdvisorAssignment({ ...ROW, effectiveTo: null });

    expect(assignment.effectiveTo).toBeNull();
  });
});
