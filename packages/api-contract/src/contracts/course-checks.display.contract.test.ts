/**
 * @file Tests for the course-checks response's course display fields.
 */
import { describe, expect, it } from 'vitest';

import { CourseChecksResponseSchema } from './course-checks.contract';

const CALC = '00000000-0000-4000-8000-000000000101';
const RESEARCH = '00000000-0000-4000-8000-000000000102';
const APPLICABILITY_PASS = { kind: 'REQUIREMENT_APPLICABILITY', state: 'PASS' };
const CALCULUS = {
  courseId: CALC,
  code: 'MATH 101',
  title: 'Calculus I',
  credits: { kind: 'FIXED', creditsHundredths: 400 },
};
const UNDERGRADUATE_RESEARCH = {
  courseId: RESEARCH,
  code: 'MATH 390',
  title: null,
  credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
};
const WITHOUT_COURSES = {
  courseResults: [
    { courseId: CALC, prerequisite: null, applicability: APPLICABILITY_PASS },
    { courseId: RESEARCH, prerequisite: null, applicability: APPLICABILITY_PASS },
  ],
  setResults: {
    allocation: [{ kind: 'REQUIREMENT_ALLOCATION', state: 'PASS' }],
    creditLoad: {
      kind: 'CREDIT_LOAD',
      state: 'UNKNOWN',
      reasonCode: 'VARIABLE_CREDIT_UNSELECTED',
    },
  },
  aggregate: 'NEEDS_VERIFICATION',
  pinnedInputs: {
    studentSnapshotId: '3c4d5e6f-0000-4000-8000-000000000001',
    studentRecordEffectiveAt: '2026-09-20T07:30:00.000-05:00',
    auditRecordEffectiveAt: '2026-09-20T07:15:00.000-05:00',
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    rulesetVersion: 'demo-2026.1',
  },
};
const VALID = { ...WITHOUT_COURSES, courses: [CALCULUS, UNDERGRADUATE_RESEARCH] };

/**
 * Returns whether the response schema accepts a payload.
 *
 * @param payload - Candidate response body.
 * @returns `true` when it parses.
 */
const accepts = (payload: unknown): boolean =>
  CourseChecksResponseSchema.safeParse(payload).success;

describe('CourseChecksResponseSchema course display fields', () => {
  it('returns the checked courses with their code, title, and credit rule', () => {
    expect(CourseChecksResponseSchema.parse(VALID).courses).toEqual([
      CALCULUS,
      UNDERGRADUATE_RESEARCH,
    ]);
  });

  it('accepts a checked course that has no catalog entry', () => {
    expect(accepts({ ...VALID, courses: [CALCULUS] })).toBe(true);
  });

  it('rejects a response without courses, and accepts an empty list', () => {
    expect(accepts(WITHOUT_COURSES)).toBe(false);
    expect(CourseChecksResponseSchema.parse({ ...WITHOUT_COURSES, courses: [] }).courses).toEqual(
      [],
    );
  });

  it('rejects a course that was not checked', () => {
    const other = { ...CALCULUS, courseId: '00000000-0000-4000-8000-000000000199' };

    expect(accepts({ ...VALID, courses: [CALCULUS, other] })).toBe(false);
  });

  it('rejects two entries for one course', () => {
    expect(accepts({ ...VALID, courses: [CALCULUS, CALCULUS] })).toBe(false);
  });

  it('rejects an inverted variable credit range', () => {
    const inverted = {
      ...UNDERGRADUATE_RESEARCH,
      credits: { kind: 'VARIABLE', minCreditsHundredths: 400, maxCreditsHundredths: 300 },
    };

    expect(accepts({ ...VALID, courses: [CALCULUS, inverted] })).toBe(false);
  });
});
