/**
 * @file Tests that the audit is not older than the student record: skew, instants, invalid input.
 */
import { describe, expect, it } from 'vitest';

import type { AuditSnapshot } from '@caa/domain';
import { buildAuditSnapshot } from '@caa/test-kit';

import { AuditRecordInputError, checkAuditReflectsRecord } from './check-audit-reflects-record';

/** The default audit ran against the record effective 2026-09-20 07:30 -05:00 (12:30Z). */
const AUDIT = buildAuditSnapshot();
const FIVE_MINUTES_MS = 300_000;
const REFLECTS_RECORD = { state: 'PASS', reasonCode: null };
const STALE = { state: 'UNKNOWN', reasonCode: 'AUDIT_STALE' };

describe('checkAuditReflectsRecord', () => {
  it('passes when the record is the one the audit ran against', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-20T07:30:00.000-05:00', 0)).toEqual(
      REFLECTS_RECORD,
    );
  });

  it('passes an older record, a direction this check does not judge (see #62)', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-19T07:30:00.000-05:00', 0)).toEqual(
      REFLECTS_RECORD,
    );
  });

  it('passes when the record is newer by less than the skew', () => {
    expect(
      checkAuditReflectsRecord(AUDIT, '2026-09-20T07:34:59.999-05:00', FIVE_MINUTES_MS),
    ).toEqual(REFLECTS_RECORD);
  });

  it('passes when the record is newer by exactly the skew', () => {
    expect(
      checkAuditReflectsRecord(AUDIT, '2026-09-20T07:35:00.000-05:00', FIVE_MINUTES_MS),
    ).toEqual(REFLECTS_RECORD);
  });

  it('is UNKNOWN with AUDIT_STALE when the record is newer by one millisecond more (AC10)', () => {
    expect(
      checkAuditReflectsRecord(AUDIT, '2026-09-20T07:35:00.001-05:00', FIVE_MINUTES_MS),
    ).toEqual(STALE);
  });

  it('is UNKNOWN with AUDIT_STALE for any newer record when the skew is 0', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-20T07:30:00.001-05:00', 0)).toEqual(STALE);
  });

  it('treats the same instant in another offset as the same record', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-20T12:30:00Z', 0)).toEqual(REFLECTS_RECORD);
  });

  it('passes for an older record whose string sorts after the audit record', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-20T08:00:00.000+01:00', 0)).toEqual(
      REFLECTS_RECORD,
    );
  });

  it('is stale for a newer record whose string sorts before the audit record', () => {
    expect(checkAuditReflectsRecord(AUDIT, '2026-09-20T07:00:00.000-07:00', 0)).toEqual(STALE);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects a maximum skew of %s',
    (maxSkewMs) => {
      expect(() =>
        checkAuditReflectsRecord(AUDIT, '2026-09-20T07:30:00.000-05:00', maxSkewMs),
      ).toThrow(new AuditRecordInputError('maxSkewMs'));
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

  it('rejects an audit record time without an offset', () => {
    const audit: AuditSnapshot = { ...AUDIT, studentRecordEffectiveAt: '2026-09-20T07:30:00' };

    expect(() => checkAuditReflectsRecord(audit, '2026-09-20T07:30:00.000-05:00', 0)).toThrow(
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
