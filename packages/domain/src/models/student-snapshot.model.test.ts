/**
 * @file Tests for the student snapshot data object.
 */
import { describe, expect, it } from 'vitest';

import {
  createStudentSnapshot,
  type StudentSnapshotInput,
  StudentSnapshotSchema,
} from './student-snapshot.model';

const VALID: StudentSnapshotInput = {
  id: '8192a3b4-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  studentId: '2b3c4d5e-0000-4000-8000-000000000001',
  programId: '708192a3-0000-4000-8000-000000000001',
  catalogYear: '2025-2026',
  attemptIds: ['5e6f7081-0000-4000-8000-000000000001', '5e6f7081-0000-4000-8000-000000000002'],
  sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
  ingestedAt: '2026-09-25T06:10:00.000-05:00',
};

describe('createStudentSnapshot', () => {
  it('accepts a snapshot with a program, catalog, attempts, and provenance times', () => {
    expect(createStudentSnapshot(VALID)).toEqual({
      id: '8192a3b4-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      studentId: '2b3c4d5e-0000-4000-8000-000000000001',
      programId: '708192a3-0000-4000-8000-000000000001',
      catalogYear: '2025-2026',
      attemptIds: ['5e6f7081-0000-4000-8000-000000000001', '5e6f7081-0000-4000-8000-000000000002'],
      sourceEffectiveAt: '2026-09-25T05:30:00.000-05:00',
      ingestedAt: '2026-09-25T06:10:00.000-05:00',
    });
  });

  it('accepts an unknown program and catalog as explicit nulls', () => {
    const snapshot = createStudentSnapshot({ ...VALID, programId: null, catalogYear: null });

    expect(snapshot.programId).toBeNull();
    expect(snapshot.catalogYear).toBeNull();
  });

  it('accepts a record that lists no attempts', () => {
    expect(createStudentSnapshot({ ...VALID, attemptIds: [] }).attemptIds).toEqual([]);
  });

  it('accepts a source time equal to the ingestion time', () => {
    const snapshot = createStudentSnapshot({
      ...VALID,
      sourceEffectiveAt: '2026-09-25T06:10:00.000-05:00',
    });

    expect(snapshot.sourceEffectiveAt).toBe('2026-09-25T06:10:00.000-05:00');
  });

  it('compares times as instants when the offsets differ', () => {
    // 11:00Z is 06:00-05:00, which is before ingestedAt (06:10-05:00), although it sorts later.
    const snapshot = createStudentSnapshot({ ...VALID, sourceEffectiveAt: '2026-09-25T11:00:00Z' });

    expect(snapshot.sourceEffectiveAt).toBe('2026-09-25T11:00:00Z');
  });

  it('rejects a source time after the ingestion time, even when it sorts earlier', () => {
    // 06:30-05:00 is 11:30Z, after ingestedAt (11:10Z), although the string sorts earlier.
    expect(() =>
      createStudentSnapshot({
        ...VALID,
        sourceEffectiveAt: '2026-09-25T06:30:00.000-05:00',
        ingestedAt: '2026-09-25T11:10:00.000Z',
      }),
    ).toThrow(/sourceEffectiveAt must not be later than ingestedAt/);
  });

  it('rejects an attempt listed twice', () => {
    expect(() =>
      createStudentSnapshot({
        ...VALID,
        attemptIds: [
          '5e6f7081-0000-4000-8000-000000000001',
          '5e6f7081-0000-4000-8000-000000000001',
        ],
      }),
    ).toThrow(/attemptIds must list each attempt at most once/);
  });

  it('rejects an empty catalogYear, because unknown must be an explicit null', () => {
    expect(() => createStudentSnapshot({ ...VALID, catalogYear: '' })).toThrow();
  });

  it('rejects an ingestion time without an offset', () => {
    expect(() => createStudentSnapshot({ ...VALID, ingestedAt: '2026-09-25T06:10:00' })).toThrow();
  });

  it('rejects an attempt ID that is not a UUID', () => {
    expect(() => createStudentSnapshot({ ...VALID, attemptIds: ['MATH101-2026SP'] })).toThrow();
  });
});

describe('StudentSnapshotSchema', () => {
  it('reports a later source time on the sourceEffectiveAt field', () => {
    const result = StudentSnapshotSchema.safeParse({
      ...VALID,
      sourceEffectiveAt: '2026-09-25T07:00:00.000-05:00',
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['sourceEffectiveAt']]);
  });

  it('reports a repeated attempt on the attemptIds field', () => {
    const result = StudentSnapshotSchema.safeParse({
      ...VALID,
      attemptIds: ['5e6f7081-0000-4000-8000-000000000002', '5e6f7081-0000-4000-8000-000000000002'],
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['attemptIds']]);
  });

  it('rejects an omitted programId, because unknown must be an explicit null', () => {
    const { programId: omitted, ...withoutProgram } = VALID;

    expect(omitted).toBe('708192a3-0000-4000-8000-000000000001');
    expect(
      StudentSnapshotSchema.safeParse(withoutProgram).error?.issues.map((issue) => issue.path),
    ).toEqual([['programId']]);
  });

  it('rejects an omitted catalogYear, because unknown must be an explicit null', () => {
    const { catalogYear: omitted, ...withoutCatalog } = VALID;

    expect(omitted).toBe('2025-2026');
    expect(
      StudentSnapshotSchema.safeParse(withoutCatalog).error?.issues.map((issue) => issue.path),
    ).toEqual([['catalogYear']]);
  });
});
