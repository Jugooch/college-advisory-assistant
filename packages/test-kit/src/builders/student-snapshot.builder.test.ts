/**
 * @file Tests for the synthetic student snapshot builder.
 */
import { describe, expect, it } from 'vitest';

import { StudentSnapshotSchema } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { buildAuditSnapshot } from './audit-snapshot.builder';
import { buildStudentSnapshot } from './student-snapshot.builder';

describe('buildStudentSnapshot', () => {
  it('defaults to student 1 in program 1 with no attempts, at the default audit record time', () => {
    expect(buildStudentSnapshot()).toEqual({
      id: 'a0000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      studentId: '30000000-0000-4000-8000-000000000001',
      programId: '80000000-0000-4000-8000-000000000001',
      catalogYear: '2025-2026',
      attemptIds: [],
      sourceEffectiveAt: '2026-09-20T07:30:00.000-05:00',
      ingestedAt: '2026-09-20T07:45:00.000-05:00',
    });
  });

  it('is the snapshot the default audit names, at the same record time', () => {
    const snapshot = buildStudentSnapshot();
    const audit = buildAuditSnapshot();

    expect([snapshot.id, snapshot.sourceEffectiveAt]).toEqual([
      audit.studentSnapshotId,
      audit.studentRecordEffectiveAt,
    ]);
  });

  it('returns deep-equal snapshots for the same arguments', () => {
    expect(buildStudentSnapshot({}, 7)).toEqual(buildStudentSnapshot({}, 7));
  });

  it('derives only the id from the seed', () => {
    const snapshot = buildStudentSnapshot({}, 7);

    expect(snapshot.id).toBe('a0000000-0000-4000-8000-000000000007');
    expect(snapshot.studentId).toBe('30000000-0000-4000-8000-000000000001');
  });

  it('applies overrides', () => {
    const snapshot = buildStudentSnapshot({
      programId: null,
      catalogYear: null,
      attemptIds: [syntheticId('attempt', 1), syntheticId('attempt', 2)],
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
      ingestedAt: '2026-09-20T09:05:00.000-05:00',
    });

    expect(snapshot).toMatchObject({
      programId: null,
      catalogYear: null,
      attemptIds: ['60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002'],
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
      ingestedAt: '2026-09-20T09:05:00.000-05:00',
    });
  });

  it('returns a snapshot that passes the domain schema', () => {
    expect(StudentSnapshotSchema.safeParse(buildStudentSnapshot()).success).toBe(true);
  });

  it('rejects a snapshot ingested before the time it describes', () => {
    expect(() =>
      buildStudentSnapshot({ sourceEffectiveAt: '2026-09-20T08:00:00.000-05:00' }),
    ).toThrow();
  });

  it('rejects a snapshot that lists an attempt twice', () => {
    expect(() =>
      buildStudentSnapshot({ attemptIds: [syntheticId('attempt', 1), syntheticId('attempt', 1)] }),
    ).toThrow();
  });
});
