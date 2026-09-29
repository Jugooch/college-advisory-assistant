/**
 * @file Tests for planning the course check screen, one branch per API outcome.
 */
import { describe, expect, it } from 'vitest';

import {
  type AcademicSummaryResponse,
  AcademicSummaryResponseSchema,
  ApiError,
  type CourseChecksResponse,
  CourseChecksResponseSchema,
} from '@caa/api-contract';
import { AggregateState, CheckKind, CheckState, ErrorCode } from '@caa/domain';
import {
  buildCheckResult,
  buildRequirementResult,
  SYNTHETIC_COURSES,
  syntheticId,
} from '@caa/test-kit';

import { planCheckRequest } from './check-request-plan';
import { type CourseCheckQuery, readCourseCheckQuery } from './course-check-query';
import {
  type CourseCheckView,
  CREDIT_ERROR_SUMMARY,
  planCourseCheckView,
} from './course-check-view';

const STUDENT_ID = syntheticId('student', 1);
const PROGRAM_ID = syntheticId('program', 1);
const { math101, math102, ind390 } = SYNTHETIC_COURSES;

const SUMMARY: AcademicSummaryResponse = AcademicSummaryResponseSchema.parse({
  student: { id: STUDENT_ID, sourceStudentId: 'SYN-000001' },
  studentSnapshot: {
    id: syntheticId('studentSnapshot', 1),
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-09-12T14:00:00Z',
    programName: null,
  },
  audit: {
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    programName: null,
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
      courseId: ind390.id,
      code: 'DEMO-IND 390',
      title: null,
      credits: { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
    },
  ],
});

const RESULT: CourseChecksResponse = CourseChecksResponseSchema.parse({
  courseResults: [
    {
      courseId: math101.id,
      prerequisite: null,
      applicability: buildCheckResult({ kind: CheckKind.RequirementApplicability }),
    },
  ],
  setResults: {
    allocation: [buildCheckResult({ kind: CheckKind.RequirementAllocation })],
    creditLoad: buildCheckResult({
      kind: CheckKind.CreditLoad,
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [],
        creditLoad: {
          totalCreditsHundredths: 300,
          minCreditsHundredths: 0,
          maxCreditsHundredths: 1800,
        },
      },
    }),
  },
  aggregate: AggregateState.Validated,
  pinnedInputs: {
    studentSnapshotId: syntheticId('studentSnapshot', 1),
    studentRecordEffectiveAt: '2026-09-12T14:00:00Z',
    auditRecordEffectiveAt: '2026-09-10T09:00:00Z',
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    rulesetVersion: 'demo-2026.1',
  },
  courses: [
    {
      courseId: math101.id,
      code: 'DEMO-MATH 101',
      title: null,
      credits: { kind: 'FIXED', creditsHundredths: 300 },
    },
  ],
});

const UNAVAILABLE = new ApiError({
  code: ErrorCode.SourceUnavailable,
  status: 503,
  message: 'Your academic record is not available yet. Please contact your advisor.',
  requestId: 'req-syn-010',
});

const CHECKED: CourseCheckQuery = readCourseCheckQuery({
  studentId: STUDENT_ID,
  course: math101.id,
});

/**
 * Plans the view with the request the page would plan from the same query and summary.
 *
 * @param query - The parsed query.
 * @param summary - The summary outcome.
 * @param result - The check outcome.
 * @returns The view.
 */
function plan(
  query: CourseCheckQuery,
  summary: AcademicSummaryResponse | ApiError,
  result: CourseChecksResponse | ApiError | null,
): CourseCheckView {
  return planCourseCheckView({ query, summary, plan: planCheckRequest(query, summary), result });
}

describe('planCourseCheckView', () => {
  it('shows results and offers the audit candidates when both calls succeed', () => {
    expect(plan(CHECKED, SUMMARY, RESULT)).toMatchObject({
      result: RESULT,
      resultError: null,
      summaryError: null,
      candidates: [{ courseId: math102.id, requirementLabels: ['Core'] }, { courseId: ind390.id }],
      isCandidateListUnavailable: false,
      selectionError: null,
    });
  });

  it('names courses from both responses, so checked and candidate courses show their codes', () => {
    const { courses } = plan(CHECKED, SUMMARY, RESULT);

    expect(courses.get(math101.id)?.code).toBe('DEMO-MATH 101');
    expect(courses.get(ind390.id)?.code).toBe('DEMO-IND 390');
    expect(courses.has(math102.id)).toBe(false);
  });

  it('shows the summary error beside the results and offers the checked courses again', () => {
    expect(plan(CHECKED, UNAVAILABLE, RESULT)).toMatchObject({
      result: RESULT,
      resultError: null,
      summaryError: UNAVAILABLE,
      candidates: [{ courseId: math101.id, requirementLabels: [] }],
      isCandidateListUnavailable: true,
      selectionError: null,
    });
  });

  it('shows the check error and still offers the audit candidates', () => {
    expect(plan(CHECKED, SUMMARY, UNAVAILABLE)).toMatchObject({
      result: null,
      resultError: UNAVAILABLE,
      summaryError: null,
    });
  });

  it('shows no results and no candidates when the summary fails before any check', () => {
    const query = readCourseCheckQuery({ studentId: STUDENT_ID });

    expect(plan(query, UNAVAILABLE, null)).toMatchObject({
      result: null,
      resultError: null,
      summaryError: UNAVAILABLE,
      candidates: [],
      isCandidateListUnavailable: true,
      selectionError: null,
    });
  });

  it('passes the selection error to the picker', () => {
    const query = readCourseCheckQuery({ studentId: STUDENT_ID, submitted: '1' });

    expect(plan(query, SUMMARY, null).selectionError).toBe('Choose at least one course.');
  });

  it('asks for the credit value to be fixed and keeps the typed text and its error', () => {
    const query = readCourseCheckQuery({
      studentId: STUDENT_ID,
      course: ind390.id,
      [`credits-${ind390.id}`]: '5',
    });

    const view = plan(query, SUMMARY, null);

    expect(view.selectionError).toBe(CREDIT_ERROR_SUMMARY);
    expect(view.credits.inputs.get(ind390.id)).toBe('5');
    expect(view.credits.errors.get(ind390.id)).toBe('Enter a number from 1 to 3.');
  });
});
