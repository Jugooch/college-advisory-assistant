/**
 * @file Tests for the academic summary's display fields: program names and candidate courses.
 */
import { describe, expect, it } from 'vitest';

import { AcademicSummaryResponseSchema } from './academic-summary.contract';

const PROGRAM_ID = '4d5e6f70-0000-4000-8000-000000000001';
const CALC = '00000000-0000-4000-8000-000000000101';
const STATS = '00000000-0000-4000-8000-000000000102';
const CALCULUS = {
  courseId: CALC,
  code: 'MATH 101',
  title: 'Calculus I',
  credits: { kind: 'FIXED', creditsHundredths: 400 },
};
const STATISTICS = {
  courseId: STATS,
  code: 'STAT 290',
  title: null,
  credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
};
const SNAPSHOT = {
  id: '3c4d5e6f-0000-4000-8000-000000000001',
  programId: PROGRAM_ID,
  catalogYear: '2025-2026',
  sourceEffectiveAt: '2026-08-20T09:00:00-05:00',
  programName: 'BS Mathematics',
};
const AUDIT = {
  auditSource: 'demo-audit',
  auditVersion: 'audit_demo_r7',
  programId: PROGRAM_ID,
  catalogYear: '2025-2026',
  programName: 'BS Mathematics',
  generatedAt: '2026-08-21T10:00:00Z',
  studentRecordEffectiveAt: '2026-08-20T09:00:00-05:00',
};
const VALID = {
  student: { id: '2b3c4d5e-0000-4000-8000-000000000001', sourceStudentId: 'DEMO-S-0001' },
  studentSnapshot: SNAPSHOT,
  audit: AUDIT,
  auditReflectsRecord: { state: 'PASS', reasonCode: null },
  programCatalogConsistency: { state: 'PASS', reasonCode: null },
  courses: [CALCULUS, STATISTICS],
  requirements: [
    {
      sourceRequirementId: 'REQ-CORE',
      parentSourceRequirementId: null,
      label: 'Mathematics core',
      state: 'INCOMPLETE',
      remainingCreditsHundredths: 700,
      remainingCourseCount: 2,
      candidateCourseIds: [CALC, STATS],
      sourceRef: 'REQ-CORE',
    },
  ],
};
const NO_AUDIT = {
  ...VALID,
  audit: null,
  auditReflectsRecord: null,
  programCatalogConsistency: null,
  courses: [],
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

/**
 * Copies an object without one of its fields.
 *
 * @param source - Object to copy.
 * @param field - Field to leave out.
 * @returns The copy.
 */
const without = (source: object, field: string): object =>
  Object.fromEntries(Object.entries(source).filter(([key]) => key !== field));

describe('AcademicSummaryResponseSchema display fields', () => {
  it('returns program names and candidate courses unchanged', () => {
    const parsed = AcademicSummaryResponseSchema.parse(VALID);

    expect(parsed.studentSnapshot.programName).toBe('BS Mathematics');
    expect(parsed.audit?.programName).toBe('BS Mathematics');
    expect(parsed.courses).toEqual([CALCULUS, STATISTICS]);
  });

  it('accepts program names the catalog does not supply as null', () => {
    const studentSnapshot = { ...SNAPSHOT, programName: null };
    const audit = { ...AUDIT, programName: null };

    expect(accepts({ ...VALID, studentSnapshot, audit })).toBe(true);
  });

  it('accepts a subset of candidates, and no courses without an audit', () => {
    expect(accepts({ ...VALID, courses: [STATISTICS] })).toBe(true);
    expect(AcademicSummaryResponseSchema.parse(NO_AUDIT).courses).toEqual([]);
  });

  it.each([
    ['the record program name', { ...VALID, studentSnapshot: without(SNAPSHOT, 'programName') }],
    ['the audit program name', { ...VALID, audit: without(AUDIT, 'programName') }],
    ['the courses', without(VALID, 'courses')],
  ])('rejects a summary without %s', (_case, summary) => {
    expect(accepts(summary)).toBe(false);
  });

  it('rejects a program name for a record that states no program', () => {
    const studentSnapshot = { ...SNAPSHOT, programId: null };
    const mismatch = { state: 'UNKNOWN', reasonCode: 'AUDIT_PROGRAM_MISMATCH' };

    expect(accepts({ ...VALID, studentSnapshot, programCatalogConsistency: mismatch })).toBe(false);
    expect(
      accepts({
        ...VALID,
        studentSnapshot: { ...studentSnapshot, programName: null },
        programCatalogConsistency: mismatch,
      }),
    ).toBe(true);
  });

  it('rejects an empty program name', () => {
    expect(accepts({ ...VALID, audit: { ...AUDIT, programName: '' } })).toBe(false);
  });

  it('rejects a course that no requirement names', () => {
    const other = { ...CALCULUS, courseId: '00000000-0000-4000-8000-000000000199' };

    expect(accepts({ ...VALID, courses: [CALCULUS, other] })).toBe(false);
    expect(accepts({ ...NO_AUDIT, courses: [CALCULUS] })).toBe(false);
  });

  it('rejects two entries for one course', () => {
    expect(accepts({ ...VALID, courses: [CALCULUS, CALCULUS] })).toBe(false);
  });
});
