/**
 * @file Tests for audit and student-record consistency: skew boundary, instants, and invalid input.
 */
import { describe, expect, it } from 'vitest';

import type { AuditSnapshot } from '@caa/domain';
import { buildAuditSnapshot } from '@caa/test-kit';

import {
  checkSnapshotConsistency,
  SnapshotConsistencyInputError,
} from './check-snapshot-consistency';

/** The default audit ran against the record effective 2026-09-20 07:30 -05:00 (12:30Z). */
const AUDIT = buildAuditSnapshot();
const FIVE_MINUTES_MS = 300_000;
const CONSISTENT = { state: 'PASS', reasonCode: null };
const STALE = { state: 'UNKNOWN', reasonCode: 'AUDIT_STALE' };

describe('checkSnapshotConsistency', () => {
  it('is consistent when the record is the one the audit ran against', () => {
    expect(checkSnapshotConsistency(AUDIT, '2026-09-20T07:30:00.000-05:00', 0)).toEqual(CONSISTENT);
  });

  it('is consistent when the record is older than the audit record', () => {
    expect(checkSnapshotConsistency(AUDIT, '2026-09-19T07:30:00.000-05:00', 0)).toEqual(CONSISTENT);
  });

  it('is consistent when the record is newer by less than the skew', () => {
    expect(
      checkSnapshotConsistency(AUDIT, '2026-09-20T07:34:59.999-05:00', FIVE_MINUTES_MS),
    ).toEqual(CONSISTENT);
  });

  it('is consistent when the record is newer by exactly the skew', () => {
    expect(
      checkSnapshotConsistency(AUDIT, '2026-09-20T07:35:00.000-05:00', FIVE_MINUTES_MS),
    ).toEqual(CONSISTENT);
  });

  it('is UNKNOWN with AUDIT_STALE when the record is newer by one millisecond more (AC10)', () => {
    expect(
      checkSnapshotConsistency(AUDIT, '2026-09-20T07:35:00.001-05:00', FIVE_MINUTES_MS),
    ).toEqual(STALE);
  });

  it('is UNKNOWN with AUDIT_STALE for any newer record when the skew is 0', () => {
    expect(checkSnapshotConsistency(AUDIT, '2026-09-20T07:30:00.001-05:00', 0)).toEqual(STALE);
  });

  it('treats the same instant in another offset as the same record', () => {
    expect(checkSnapshotConsistency(AUDIT, '2026-09-20T12:30:00Z', 0)).toEqual(CONSISTENT);
  });

  it('is consistent for an older record whose string sorts after the audit record', () => {
    expect(checkSnapshotConsistency(AUDIT, '2026-09-20T08:00:00.000+01:00', 0)).toEqual(CONSISTENT);
  });

  it('is stale for a newer record whose string sorts before the audit record', () => {
    expect(checkSnapshotConsistency(AUDIT, '2026-09-20T07:00:00.000-07:00', 0)).toEqual(STALE);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a maximum skew of %s',
    (maxSkewMs) => {
      expect(() =>
        checkSnapshotConsistency(AUDIT, '2026-09-20T07:30:00.000-05:00', maxSkewMs),
      ).toThrow(new SnapshotConsistencyInputError('maxSkewMs'));
    },
  );

  it.each(['2026-09-20T07:30:00', '2026-09-20', '2026-13-40T07:30:00Z', '', 'Sep 20 2026 07:30'])(
    'rejects the record time %j',
    (studentRecordEffectiveAt) => {
      expect(() => checkSnapshotConsistency(AUDIT, studentRecordEffectiveAt, 0)).toThrow(
        new SnapshotConsistencyInputError('studentRecordEffectiveAt'),
      );
    },
  );

  it('rejects an audit record time without an offset', () => {
    const audit: AuditSnapshot = { ...AUDIT, studentRecordEffectiveAt: '2026-09-20T07:30:00' };

    expect(() => checkSnapshotConsistency(audit, '2026-09-20T07:30:00.000-05:00', 0)).toThrow(
      new SnapshotConsistencyInputError('audit.studentRecordEffectiveAt'),
    );
  });

  it('names the error and the invalid field', () => {
    const error = new SnapshotConsistencyInputError('maxSkewMs');

    expect({ name: error.name, message: error.message }).toEqual({
      name: 'SnapshotConsistencyInputError',
      message: 'Snapshot consistency input maxSkewMs is invalid',
    });
  });
});
