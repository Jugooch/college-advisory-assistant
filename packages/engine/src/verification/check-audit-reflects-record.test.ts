/**
 * @file Tests that the audit reflects the pinned record: identity, revision, skew both ways, input errors.
 */
import { describe, expect, it } from 'vitest';

import {
  type AuditSnapshot,
  createStudentSnapshot,
  type StudentSnapshot,
  type StudentSnapshotInput,
} from '@caa/domain';
import { buildAuditSnapshot, SYNTHETIC_TENANTS, syntheticId } from '@caa/test-kit';

import { AuditRecordInputError, checkAuditReflectsRecord } from './check-audit-reflects-record';

/** The default audit ran against student snapshot 1, effective 2026-09-20 07:30 -05:00 (12:30Z). */
const AUDIT = buildAuditSnapshot();
const FIVE_MINUTES_MS = 300_000;
const REFLECTS_RECORD = { state: 'PASS', reasonCode: null };
const STALE = { state: 'UNKNOWN', reasonCode: 'AUDIT_STALE' };
const AMBIGUOUS = { state: 'UNKNOWN', reasonCode: 'AUDIT_AMBIGUOUS' };

/**
 * Builds the pinned snapshot the default audit ran against, with the given fields replaced.
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

/**
 * Checks the default audit against its own snapshot, effective at the given time.
 *
 * @param sourceEffectiveAt - When the pinned record took effect.
 * @param maxSkewMs - The allowed skew.
 * @returns The reflection.
 */
function reflectionAt(sourceEffectiveAt: string, maxSkewMs = 0): unknown {
  return checkAuditReflectsRecord(AUDIT, snapshotWith({ sourceEffectiveAt }), maxSkewMs);
}

describe('checkAuditReflectsRecord with the snapshot the audit ran against', () => {
  it('passes when the record time is the audit record time', () => {
    expect(reflectionAt('2026-09-20T07:30:00.000-05:00')).toEqual(REFLECTS_RECORD);
  });

  it('treats the same instant in another offset as the same time', () => {
    expect(reflectionAt('2026-09-20T12:30:00Z')).toEqual(REFLECTS_RECORD);
  });

  it('passes when the record is newer by exactly the skew', () => {
    expect(reflectionAt('2026-09-20T07:35:00.000-05:00', FIVE_MINUTES_MS)).toEqual(REFLECTS_RECORD);
  });

  it('is UNKNOWN AUDIT_STALE when the record is newer by one millisecond more (AC10)', () => {
    expect(reflectionAt('2026-09-20T07:35:00.001-05:00', FIVE_MINUTES_MS)).toEqual(STALE);
  });

  it('passes when the record is older by exactly the skew', () => {
    expect(reflectionAt('2026-09-20T07:25:00.000-05:00', FIVE_MINUTES_MS)).toEqual(REFLECTS_RECORD);
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS when the record is older by one millisecond more', () => {
    expect(reflectionAt('2026-09-20T07:24:59.999-05:00', FIVE_MINUTES_MS)).toEqual(AMBIGUOUS);
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS for an older record whose string sorts after the audit record', () => {
    expect(reflectionAt('2026-09-20T08:00:00.000+01:00')).toEqual(AMBIGUOUS);
  });

  it('is UNKNOWN AUDIT_STALE for a newer record whose string sorts before the audit record', () => {
    expect(reflectionAt('2026-09-20T07:00:00.000-07:00')).toEqual(STALE);
  });

  it('passes whatever program the record states, which is a separate check', () => {
    const record = snapshotWith({ programId: null, catalogYear: '2026-2027' });

    expect(checkAuditReflectsRecord(AUDIT, record, 0)).toEqual(REFLECTS_RECORD);
  });
});

describe('checkAuditReflectsRecord with another record', () => {
  it('is UNKNOWN AUDIT_AMBIGUOUS for an audit of another tenant', () => {
    const record = snapshotWith({ tenantId: SYNTHETIC_TENANTS.b.id });

    expect(checkAuditReflectsRecord(AUDIT, record, 0)).toEqual(AMBIGUOUS);
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS for an audit of another student, even for a newer record', () => {
    const record = snapshotWith({
      studentId: syntheticId('student', 2),
      sourceEffectiveAt: '2026-09-20T09:00:00.000-05:00',
    });

    expect(checkAuditReflectsRecord(AUDIT, record, 0)).toEqual(AMBIGUOUS);
  });

  it('is UNKNOWN AUDIT_STALE for a later revision, even within the skew (AC10)', () => {
    const record = snapshotWith({
      id: syntheticId('studentSnapshot', 2),
      sourceEffectiveAt: '2026-09-20T07:30:00.001-05:00',
    });

    expect(checkAuditReflectsRecord(AUDIT, record, FIVE_MINUTES_MS)).toEqual(STALE);
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS for another revision at the audit record time', () => {
    const record = snapshotWith({ id: syntheticId('studentSnapshot', 2) });

    expect(checkAuditReflectsRecord(AUDIT, record, FIVE_MINUTES_MS)).toEqual(AMBIGUOUS);
  });

  it('is UNKNOWN AUDIT_AMBIGUOUS for an earlier revision', () => {
    const record = snapshotWith({
      id: syntheticId('studentSnapshot', 2),
      sourceEffectiveAt: '2026-09-19T07:30:00.000-05:00',
    });

    expect(checkAuditReflectsRecord(AUDIT, record, FIVE_MINUTES_MS)).toEqual(AMBIGUOUS);
  });
});

describe('checkAuditReflectsRecord with a record time only (transitional, #122)', () => {
  it('passes an older record, a direction the time-only form does not judge', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-19T07:30:00.000-05:00', 0)).toEqual(
      REFLECTS_RECORD,
    );
  });

  it('passes when the record is newer by exactly the skew', () => {
    expect(
      checkAuditReflectsRecord(AUDIT, '2026-09-20T07:35:00.000-05:00', FIVE_MINUTES_MS),
    ).toEqual(REFLECTS_RECORD);
  });

  it('is UNKNOWN AUDIT_STALE when the record is newer by one millisecond more', () => {
    expect(
      checkAuditReflectsRecord(AUDIT, '2026-09-20T07:35:00.001-05:00', FIVE_MINUTES_MS),
    ).toEqual(STALE);
  });
});

describe('checkAuditReflectsRecord input errors', () => {
  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a maximum skew of %s',
    (maxSkewMs) => {
      expect(() => checkAuditReflectsRecord(AUDIT, snapshotWith(), maxSkewMs)).toThrow(
        new AuditRecordInputError('maxSkewMs'),
      );
    },
  );

  it.each(['2026-09-20T07:30:00', '2026-09-20', '2026-13-40T07:30:00Z', '', 'Sep 20 2026 07:30'])(
    'rejects the record time %j',
    (studentRecordEffectiveAt) => {
      expect(() => checkAuditReflectsRecord(AUDIT, studentRecordEffectiveAt, 0)).toThrow(
        new AuditRecordInputError('studentRecordEffectiveAt'),
      );
    },
  );

  it('rejects a snapshot time without an offset that bypassed the schema', () => {
    const record: StudentSnapshot = { ...snapshotWith(), sourceEffectiveAt: '2026-09-20T07:30:00' };

    expect(() => checkAuditReflectsRecord(AUDIT, record, 0)).toThrow(
      new AuditRecordInputError('studentSnapshot.sourceEffectiveAt'),
    );
  });

  it('rejects an audit record time without an offset', () => {
    const audit: AuditSnapshot = { ...AUDIT, studentRecordEffectiveAt: '2026-09-20T07:30:00' };

    expect(() => checkAuditReflectsRecord(audit, snapshotWith(), 0)).toThrow(
      new AuditRecordInputError('audit.studentRecordEffectiveAt'),
    );
  });

  it('names the error and the invalid field', () => {
    const error = new AuditRecordInputError('maxSkewMs');

    expect({ name: error.name, message: error.message }).toEqual({
      name: 'AuditRecordInputError',
      message: 'Audit record check input maxSkewMs is invalid',
    });
  });
});
