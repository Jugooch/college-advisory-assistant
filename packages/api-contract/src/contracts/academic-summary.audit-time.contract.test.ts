/**
 * @file Tests for the record time of the audit in the academic summary.
 */
import { describe, expect, it } from 'vitest';

import { AcademicSummaryResponseSchema } from './academic-summary.contract';

const PROGRAM_ID = '4d5e6f70-0000-4000-8000-000000000001';
const AUDIT_WITHOUT_RECORD_TIME = {
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  programId: PROGRAM_ID,
  catalogYear: '2025-2026',
  programName: null,
  generatedAt: '2026-08-21T10:00:00Z',
};
const AUDIT = {
  ...AUDIT_WITHOUT_RECORD_TIME,
  studentRecordEffectiveAt: '2026-08-20T09:00:00-05:00',
};
const VALID = {
  student: { id: '2b3c4d5e-0000-4000-8000-000000000001', sourceStudentId: 'DEMO-S-0001' },
  studentSnapshot: {
    id: '3c4d5e6f-0000-4000-8000-000000000001',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-08-20T09:00:00-05:00',
    programName: null,
  },
  audit: AUDIT,
  auditReflectsRecord: { state: 'PASS', reasonCode: null },
  programCatalogConsistency: { state: 'PASS', reasonCode: null },
  courses: [],
  requirements: [
    {
      sourceRequirementId: 'REQ-CORE',
      parentSourceRequirementId: null,
      label: 'Mathematics core',
      state: 'INCOMPLETE',
      remainingCreditsHundredths: 700,
      remainingCourseCount: 2,
      candidateCourseIds: ['00000000-0000-4000-8000-000000000101'],
      sourceRef: 'REQ-CORE',
    },
  ],
};

/**
 * Returns whether the response schema accepts a payload.
 *
 * @param payload - Candidate response body.
 * @returns `true` when it parses.
 */
const accepts = (payload: unknown): boolean =>
  AcademicSummaryResponseSchema.safeParse(payload).success;

describe('SummaryAuditSchema studentRecordEffectiveAt', () => {
  it('carries the record time the audit was run against', () => {
    expect(AcademicSummaryResponseSchema.parse(VALID).audit?.studentRecordEffectiveAt).toBe(
      '2026-08-20T09:00:00-05:00',
    );
  });

  it('accepts a record time equal to generatedAt, compared as instants', () => {
    const audit = { ...AUDIT, studentRecordEffectiveAt: '2026-08-21T05:00:00-05:00' };

    expect(accepts({ ...VALID, audit })).toBe(true);
  });

  it('rejects a record time later than generatedAt, compared as instants', () => {
    const audit = { ...AUDIT, studentRecordEffectiveAt: '2026-08-21T05:00:01-05:00' };

    expect(accepts({ ...VALID, audit })).toBe(false);
  });

  it('rejects an offset-less or null record time', () => {
    expect(
      accepts({ ...VALID, audit: { ...AUDIT, studentRecordEffectiveAt: '2026-08-20T09:00:00' } }),
    ).toBe(false);
    expect(accepts({ ...VALID, audit: { ...AUDIT, studentRecordEffectiveAt: null } })).toBe(false);
  });

  it('rejects an audit without its record time', () => {
    expect(accepts({ ...VALID, audit: AUDIT_WITHOUT_RECORD_TIME })).toBe(false);
  });

  it('carries no freshness verdict: a stale summary is 409 STALE_SOURCE, not a 200', () => {
    const verdict = { state: 'HISTORICAL', judgedAt: '2026-08-23T12:00:00Z' };

    expect(AcademicSummaryResponseSchema.parse({ ...VALID, sourceFreshness: verdict })).toEqual(
      VALID,
    );
  });
});
