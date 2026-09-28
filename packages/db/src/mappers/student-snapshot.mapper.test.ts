/**
 * @file Tests for the student snapshot row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { StudentSnapshotRow } from '../tables/student-snapshot.table';
import { toStudentSnapshot } from './student-snapshot.mapper';

const ATTEMPT_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const ATTEMPT_B = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const ROW: StudentSnapshotRow = {
  id: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
  programId: null,
  catalogYear: null,
  sourceEffectiveAt: new Date('2026-09-25T06:00:00.000Z'),
  ingestedAt: new Date('2026-09-25T07:00:00.000Z'),
};

describe('toStudentSnapshot', () => {
  it('keeps the attempt order and converts both times to ISO strings', () => {
    const snapshot = toStudentSnapshot(ROW, [ATTEMPT_B, ATTEMPT_A]);

    expect(snapshot).toEqual({
      id: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '7e2d3c4b-5a6f-4e7d-9c8b-2b3c4d5e6f70',
      programId: null,
      catalogYear: null,
      attemptIds: [ATTEMPT_B, ATTEMPT_A],
      sourceEffectiveAt: '2026-09-25T06:00:00.000Z',
      ingestedAt: '2026-09-25T07:00:00.000Z',
    });
  });

  it('rejects a stored record ingested before the time it describes', () => {
    const row = { ...ROW, ingestedAt: new Date('2026-09-25T05:00:00.000Z') };

    expect(() => toStudentSnapshot(row, [])).toThrow(ZodError);
  });

  it('rejects an attempt listed twice', () => {
    expect(() => toStudentSnapshot(ROW, [ATTEMPT_A, ATTEMPT_A])).toThrow(ZodError);
  });
});
