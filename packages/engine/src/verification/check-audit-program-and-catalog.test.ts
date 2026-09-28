/**
 * @file Tests for the record ↔ audit program and catalog check.
 */
import { describe, expect, it } from 'vitest';

import {
  createStudentSnapshot,
  type StudentSnapshot,
  type StudentSnapshotInput,
} from '@caa/domain';
import { buildAuditSnapshot, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { checkAuditProgramAndCatalog } from './check-audit-program-and-catalog';

/** The default audit is for program 1, catalog `2025-2026`. */
const AUDIT = buildAuditSnapshot();
const CONSISTENT = { state: 'PASS', reasonCode: null };
const MISMATCH = { state: 'UNKNOWN', reasonCode: 'AUDIT_PROGRAM_MISMATCH' };

/**
 * Builds the snapshot the default audit ran against, with the given fields replaced.
 *
 * @param overrides - Fields to replace.
 * @returns The student snapshot.
 */
function snapshotWith(overrides: Partial<StudentSnapshotInput> = {}): StudentSnapshot {
  return createStudentSnapshot({
    id: syntheticId('studentSnapshot', 1),
    tenantId: SYNTHETIC_TENANTS.a.id,
    studentId: syntheticId('student', 1),
    programId: syntheticId('program', 1),
    catalogYear: '2025-2026',
    attemptIds: [],
    sourceEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    ingestedAt: '2026-09-21T00:00:00.000-05:00',
    ...overrides,
  });
}

describe('checkAuditProgramAndCatalog', () => {
  it('passes when the record states the audit program and catalog', () => {
    expect(checkAuditProgramAndCatalog(snapshotWith(), AUDIT)).toEqual(CONSISTENT);
  });

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when the record is in another program (AC10)', () => {
    const record = snapshotWith({ programId: syntheticId('program', 2) });

    expect(checkAuditProgramAndCatalog(record, AUDIT)).toEqual(MISMATCH);
  });

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when the record follows another catalog', () => {
    const record = snapshotWith({ catalogYear: '2026-2027' });

    expect(checkAuditProgramAndCatalog(record, AUDIT)).toEqual(MISMATCH);
  });

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when the record states no program', () => {
    expect(checkAuditProgramAndCatalog(snapshotWith({ programId: null }), AUDIT)).toEqual(MISMATCH);
  });

  it('is UNKNOWN AUDIT_PROGRAM_MISMATCH when the record states no catalog', () => {
    expect(checkAuditProgramAndCatalog(snapshotWith({ catalogYear: null }), AUDIT)).toEqual(
      MISMATCH,
    );
  });
});
