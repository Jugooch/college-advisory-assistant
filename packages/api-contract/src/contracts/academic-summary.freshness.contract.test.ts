/**
 * @file Tests for the academic summary's source freshness and the audit's record time.
 */
import { describe, expect, it } from 'vitest';

import { AcademicSummaryResponseSchema } from './academic-summary.contract';

const PROGRAM_ID = '4d5e6f70-0000-4000-8000-000000000001';
const AUDIT_WITHOUT_RECORD_TIME = {
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  programId: PROGRAM_ID,
  catalogYear: '2025-2026',
  generatedAt: '2026-08-21T10:00:00Z',
};
const AUDIT = {
  ...AUDIT_WITHOUT_RECORD_TIME,
  studentRecordEffectiveAt: '2026-08-20T09:00:00-05:00',
};
const CURRENT = { state: 'CURRENT', judgedAt: '2026-08-21T12:00:00Z' };
const WITHOUT_FRESHNESS = {
  student: { id: '2b3c4d5e-0000-4000-8000-000000000001', sourceStudentId: 'DEMO-S-0001' },
  studentSnapshot: {
    id: '3c4d5e6f-0000-4000-8000-000000000001',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-08-20T09:00:00-05:00',
  },
  audit: AUDIT,
  auditReflectsRecord: { state: 'PASS', reasonCode: null },
  programCatalogConsistency: { state: 'PASS', reasonCode: null },
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
const VALID = { ...WITHOUT_FRESHNESS, sourceFreshness: CURRENT };
const NO_AUDIT = {
  ...VALID,
  audit: null,
  auditReflectsRecord: null,
  programCatalogConsistency: null,
  requirements: [],
};

/**
 * Returns whether the response schema accepts a payload.
 *
 * @param payload - Candidate response body.
 * @returns `true` when it parses.
 */
const accepts = (payload: unknown): boolean =>
  AcademicSummaryResponseSchema.safeParse(payload).success;

describe('AcademicSummaryResponseSchema source freshness', () => {
  it('accepts a CURRENT summary with the time it was judged', () => {
    expect(AcademicSummaryResponseSchema.parse(VALID).sourceFreshness).toEqual(CURRENT);
  });

  it('accepts a HISTORICAL summary, with or without an audit', () => {
    const historical = { state: 'HISTORICAL', judgedAt: '2026-08-23T12:00:00-05:00' };

    expect(AcademicSummaryResponseSchema.parse({ ...VALID, sourceFreshness: historical })).toEqual({
      ...VALID,
      sourceFreshness: historical,
    });
    expect(accepts({ ...NO_AUDIT, sourceFreshness: historical })).toBe(true);
  });

  it('accepts an omitted freshness while it is still optional (#169)', () => {
    expect(AcademicSummaryResponseSchema.parse(WITHOUT_FRESHNESS).sourceFreshness).toBeUndefined();
  });

  it.each([
    ['an unknown state', { state: 'FRESH', judgedAt: '2026-08-21T12:00:00Z' }],
    ['a guessed state', { state: 'PROBABLY_CURRENT', judgedAt: '2026-08-21T12:00:00Z' }],
    ['an offset-less judgedAt', { state: 'CURRENT', judgedAt: '2026-08-21T12:00:00' }],
    ['a missing judgedAt', { state: 'CURRENT' }],
    ['a null freshness', null],
  ])('rejects %s', (_case, sourceFreshness) => {
    expect(accepts({ ...VALID, sourceFreshness })).toBe(false);
  });
});

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

  it('accepts an omitted record time while it is still optional (#169)', () => {
    expect(accepts({ ...VALID, audit: AUDIT_WITHOUT_RECORD_TIME })).toBe(true);
  });
});
