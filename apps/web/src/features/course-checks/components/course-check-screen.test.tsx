/**
 * @file Tests that the course check screen renders every part with unique element ids.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ApiError, type CourseChecksResponse, CourseChecksResponseSchema } from '@caa/api-contract';
import { AggregateState, CheckKind, CheckState, ErrorCode, ReasonCode } from '@caa/domain';
import { buildCheckResult, SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import type { CourseCheckView } from '../utils/course-check-view';
import { CourseCheckScreen } from './course-check-screen';

const STUDENT_ID = syntheticId('student', 1);
const { math101, math102 } = SYNTHETIC_COURSES;

/** A NEEDS_VERIFICATION result for two courses that are also picker candidates. */
const RESULT: CourseChecksResponse = CourseChecksResponseSchema.parse({
  courseResults: [math101.id, math102.id].map((courseId) => ({
    courseId,
    prerequisite: null,
    applicability: buildCheckResult({ kind: CheckKind.RequirementApplicability }),
  })),
  setResults: {
    allocation: [buildCheckResult({ kind: CheckKind.RequirementAllocation })],
    creditLoad: buildCheckResult({
      kind: CheckKind.CreditLoad,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.CreditBoundsUndefined,
    }),
  },
  aggregate: AggregateState.NeedsVerification,
  pinnedInputs: {
    studentSnapshotId: syntheticId('studentSnapshot', 1),
    studentRecordEffectiveAt: '2026-09-12T14:00:00Z',
    auditRecordEffectiveAt: '2026-09-10T09:00:00Z',
    auditSource: 'demo-audit',
    auditVersion: 'audit_demo_r7',
    rulesetVersion: 'demo-2026.1',
  },
});

/**
 * Builds an API error envelope.
 *
 * @param code - The error code.
 * @param message - The API's message.
 * @returns The error.
 */
function apiError(code: ErrorCode, message: string): ApiError {
  return new ApiError({ code, status: 503, message, requestId: null });
}

const CANDIDATES = [
  { courseId: math101.id, requirementLabels: ['Core'] },
  { courseId: math102.id, requirementLabels: ['Core'] },
];

/**
 * Lists every id attribute in rendered markup.
 *
 * @param html - Rendered markup.
 * @returns The ids, in document order.
 */
function idsIn(html: string): readonly string[] {
  return [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1] ?? '');
}

describe('CourseCheckScreen', () => {
  it('gives results, a summary error, and the picker unique ids for the same courses', () => {
    const view: CourseCheckView = {
      result: RESULT,
      resultError: null,
      summaryError: apiError(ErrorCode.SourceUnavailable, 'The audit system is not responding.'),
      candidates: CANDIDATES,
      isCandidateListUnavailable: false,
      selectionError: 'Choose at least one course.',
    };

    const html = renderToStaticMarkup(
      <CourseCheckScreen studentId={STUDENT_ID} view={view} selectedCourseIds={[math101.id]} />,
    );
    const ids = idsIn(html);

    expect(ids.length).toBeGreaterThan(8);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('<h2 id="results-heading">Check results</h2>');
    expect(html).toContain('<p>The audit system is not responding.</p>');
    expect(html).toContain('<h2 id="picker-heading">Choose courses</h2>');
  });

  it('gives a check error and a summary error distinct heading ids', () => {
    const view: CourseCheckView = {
      result: null,
      resultError: apiError(ErrorCode.StaleSource, 'Your academic record needs to be verified.'),
      summaryError: apiError(ErrorCode.SourceUnavailable, 'The audit system is not responding.'),
      candidates: [{ courseId: math101.id, requirementLabels: [] }],
      isCandidateListUnavailable: true,
      selectionError: null,
    };

    const html = renderToStaticMarkup(
      <CourseCheckScreen studentId={STUDENT_ID} view={view} selectedCourseIds={[math101.id]} />,
    );
    const ids = idsIn(html);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['check-error-heading', 'summary-error-heading']));
  });
});
