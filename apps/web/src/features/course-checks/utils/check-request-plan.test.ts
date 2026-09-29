/**
 * @file Tests for planning the course-checks request: credit selections only for variable-credit
 * courses, within their catalog range, and never an assumed value.
 */
import { describe, expect, it } from 'vitest';

import {
  type AcademicSummaryResponse,
  AcademicSummaryResponseSchema,
  ApiError,
} from '@caa/api-contract';
import { CheckState, ErrorCode } from '@caa/domain';
import { buildRequirementResult, SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { planCheckRequest, summaryCourses } from './check-request-plan';
import { readCourseCheckQuery, type SearchParams } from './course-check-query';

const STUDENT_ID = syntheticId('student', 1);
const PROGRAM_ID = syntheticId('program', 1);
const { math102, ind390 } = SYNTHETIC_COURSES;

/** A summary whose catalog entries make DEMO-MATH 102 fixed and DEMO-IND 390 1 to 3 credits. */
const SUMMARY: AcademicSummaryResponse = AcademicSummaryResponseSchema.parse({
  student: { id: STUDENT_ID, sourceStudentId: 'SYN-000001' },
  studentSnapshot: {
    id: syntheticId('studentSnapshot', 1),
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-09-12T14:00:00Z',
    programName: 'Demo BS Mathematics',
  },
  audit: {
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    programName: 'Demo BS Mathematics',
    generatedAt: '2026-09-10T09:00:00Z',
    studentRecordEffectiveAt: '2026-09-10T08:00:00Z',
  },
  auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
  programCatalogConsistency: { state: CheckState.Pass, reasonCode: null },
  requirements: [
    buildRequirementResult({ label: 'Core', candidateCourseIds: [math102.id, ind390.id] }),
  ],
  courses: [
    {
      courseId: math102.id,
      code: 'DEMO-MATH 102',
      title: null,
      credits: { kind: 'FIXED', creditsHundredths: 300 },
    },
    {
      courseId: ind390.id,
      code: 'DEMO-IND 390',
      title: null,
      credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
    },
  ],
});

const UNAVAILABLE = new ApiError({
  code: ErrorCode.SourceUnavailable,
  status: 503,
  message: 'Your academic record is not available yet. Please contact your advisor.',
  requestId: 'req-syn-011',
});

/**
 * Plans the request for a query that checks both courses.
 *
 * @param extra - More query fields, such as typed credits.
 * @param summary - The summary outcome.
 * @returns The plan.
 */
function planFor(
  extra: SearchParams,
  summary: AcademicSummaryResponse | ApiError = SUMMARY,
): ReturnType<typeof planCheckRequest> {
  const query = readCourseCheckQuery({
    studentId: STUDENT_ID,
    course: [math102.id, ind390.id],
    ...extra,
  });
  return planCheckRequest(query, summary);
}

describe('planCheckRequest', () => {
  it('sends the chosen credits of the variable-credit course', () => {
    expect(planFor({ [`credits-${ind390.id}`]: '2' })).toEqual({
      request: {
        courseIds: [math102.id, ind390.id],
        creditSelections: [{ courseId: ind390.id, selectedCreditsHundredths: 200 }],
      },
      creditErrors: new Map(),
    });
  });

  it('sends no selection for a blank field, so the credit load stays unknown', () => {
    expect(planFor({ [`credits-${ind390.id}`]: '' }).request).toEqual({
      courseIds: [math102.id, ind390.id],
    });
  });

  it('ignores a value for a fixed-credit course, which offers no field', () => {
    expect(planFor({ [`credits-${math102.id}`]: '2' }).request).toEqual({
      courseIds: [math102.id, ind390.id],
    });
  });

  it('sends nothing and reports the range when a value is outside it', () => {
    expect(planFor({ [`credits-${ind390.id}`]: '3.5' })).toEqual({
      request: null,
      creditErrors: new Map([[ind390.id, 'Enter a number from 1 to 3.']]),
    });
  });

  it('sends no selection when the summary failed, since the credit range is unknown', () => {
    expect(planFor({ [`credits-${ind390.id}`]: '2' }, UNAVAILABLE).request).toEqual({
      courseIds: [math102.id, ind390.id],
    });
  });

  it('ignores a value for a course that was not selected', () => {
    const query = readCourseCheckQuery({
      studentId: STUDENT_ID,
      course: math102.id,
      [`credits-${ind390.id}`]: '2',
    });

    expect(planCheckRequest(query, SUMMARY).request).toEqual({ courseIds: [math102.id] });
  });

  it('sends nothing when no valid selection was submitted', () => {
    const query = readCourseCheckQuery({ studentId: STUDENT_ID, submitted: '1' });

    expect(planCheckRequest(query, SUMMARY)).toEqual({ request: null, creditErrors: new Map() });
  });
});

describe('summaryCourses', () => {
  it('indexes the summary entries, and nothing for an error', () => {
    expect(summaryCourses(SUMMARY).get(ind390.id)?.code).toBe('DEMO-IND 390');
    expect(summaryCourses(UNAVAILABLE).size).toBe(0);
  });
});
