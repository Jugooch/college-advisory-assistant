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

import { type CourseCheckQuery, readCourseCheckQuery } from './course-check-query';
import { planCourseCheckView } from './course-check-view';

const STUDENT_ID = syntheticId('student', 1);
const PROGRAM_ID = syntheticId('program', 1);
const { math101, math102 } = SYNTHETIC_COURSES;

const SUMMARY: AcademicSummaryResponse = AcademicSummaryResponseSchema.parse({
  student: { id: STUDENT_ID, sourceStudentId: 'SYN-000001' },
  studentSnapshot: {
    id: syntheticId('studentSnapshot', 1),
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    sourceEffectiveAt: '2026-09-12T14:00:00Z',
  },
  audit: {
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    programId: PROGRAM_ID,
    catalogYear: '2025-2026',
    generatedAt: '2026-09-10T09:00:00Z',
  },
  auditReflectsRecord: { state: CheckState.Pass, reasonCode: null },
  programCatalogConsistency: { state: CheckState.Pass, reasonCode: null },
  requirements: [buildRequirementResult({ label: 'Core', candidateCourseIds: [math102.id] })],
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

describe('planCourseCheckView', () => {
  it('shows results and offers the audit candidates when both calls succeed', () => {
    expect(planCourseCheckView({ query: CHECKED, summary: SUMMARY, result: RESULT })).toEqual({
      result: RESULT,
      resultError: null,
      summaryError: null,
      candidates: [{ courseId: math102.id, requirementLabels: ['Core'] }],
      isCandidateListUnavailable: false,
      selectionError: null,
    });
  });

  it('shows the summary error beside the results and offers the checked courses again', () => {
    expect(planCourseCheckView({ query: CHECKED, summary: UNAVAILABLE, result: RESULT })).toEqual({
      result: RESULT,
      resultError: null,
      summaryError: UNAVAILABLE,
      candidates: [{ courseId: math101.id, requirementLabels: [] }],
      isCandidateListUnavailable: true,
      selectionError: null,
    });
  });

  it('shows the check error and still offers the audit candidates', () => {
    expect(
      planCourseCheckView({ query: CHECKED, summary: SUMMARY, result: UNAVAILABLE }),
    ).toMatchObject({ result: null, resultError: UNAVAILABLE, summaryError: null });
  });

  it('shows no results and no candidates when the summary fails before any check', () => {
    const query = readCourseCheckQuery({ studentId: STUDENT_ID });

    expect(planCourseCheckView({ query, summary: UNAVAILABLE, result: null })).toEqual({
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

    expect(planCourseCheckView({ query, summary: SUMMARY, result: null }).selectionError).toBe(
      'Choose at least one course.',
    );
  });
});
