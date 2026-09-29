/**
 * @file Tests that audit-derived checks read the audit only when it reflects the pinned record's program.
 */
import { describe, expect, it } from 'vitest';

import { type StudentSnapshot, type StudentSnapshotInput } from '@caa/domain';
import { buildAuditSnapshot, buildStudentSnapshot, syntheticId } from '@caa/test-kit';

import { checkAuditAgainstRecord } from './check-audit-against-record';

/** The default audit ran against snapshot 1 at 07:30 -05:00, for program 1 and `2025-2026`. */
const AUDIT = buildAuditSnapshot();

/**
 * Builds the snapshot the default audit ran against, ingested late enough for any record time
 * the tests use, with the given fields replaced.
 *
 * @param overrides - Fields to replace.
 * @returns The student snapshot.
 */
function snapshotWith(overrides: Partial<StudentSnapshotInput> = {}): StudentSnapshot {
  return buildStudentSnapshot({ ingestedAt: '2026-09-21T00:00:00.000-05:00', ...overrides });
}

describe('checkAuditAgainstRecord', () => {
  it('passes when the audit reflects the record and is for its program and catalog', () => {
    const agreement = checkAuditAgainstRecord(AUDIT, {
      studentSnapshot: snapshotWith(),
      maxSkewMs: 0,
    });

    expect(agreement).toEqual({ state: 'PASS', reasonCode: null });
  });

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when only the program differs', () => {
    const studentSnapshot = snapshotWith({ programId: syntheticId('program', 2) });

    expect(checkAuditAgainstRecord(AUDIT, { studentSnapshot, maxSkewMs: 0 })).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'AUDIT_PROGRAM_MISMATCH',
    });
  });

  it('reports a stale audit before a program mismatch (AC10)', () => {
    const studentSnapshot = snapshotWith({
      id: syntheticId('studentSnapshot', 2),
      programId: syntheticId('program', 2),
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
    });

    expect(checkAuditAgainstRecord(AUDIT, { studentSnapshot, maxSkewMs: 3_600_000 })).toEqual({
      state: 'UNKNOWN',
      reasonCode: 'AUDIT_STALE',
    });
  });
});
