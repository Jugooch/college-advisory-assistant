/**
 * @file Tests for listing candidate courses once each.
 */
import { describe, expect, it } from 'vitest';

import { type AcademicSummaryResponse, ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { buildRequirementResult, SYNTHETIC_COURSES } from '@caa/test-kit';

import { listCandidateCourses, planCandidateCourses } from './candidate-courses';

describe('listCandidateCourses', () => {
  it('lists each course once with every requirement that names it', () => {
    const { math101, math102 } = SYNTHETIC_COURSES;
    const core = buildRequirementResult(
      { label: 'Core', candidateCourseIds: [math101.id, math102.id] },
      1,
    );
    const elective = buildRequirementResult(
      { label: 'Elective', candidateCourseIds: [math102.id] },
      2,
    );

    expect(listCandidateCourses([core, elective])).toEqual([
      { courseId: math101.id, requirementLabels: ['Core'] },
      { courseId: math102.id, requirementLabels: ['Core', 'Elective'] },
    ]);
  });
});

describe('planCandidateCourses', () => {
  it('lists the chosen courses without requirements when the summary failed', () => {
    const error = new ApiError({
      code: ErrorCode.SourceUnavailable,
      status: 503,
      message: 'down',
      requestId: null,
    });

    expect(planCandidateCourses(error, ['c1'])).toEqual([
      { courseId: 'c1', requirementLabels: [] },
    ]);
  });

  it('lists the audit candidates when the summary loaded', () => {
    const summary = {
      requirements: [{ label: 'Core', candidateCourseIds: ['c2'] }],
    } as unknown as AcademicSummaryResponse;

    expect(planCandidateCourses(summary, ['c1'])).toEqual([
      { courseId: 'c2', requirementLabels: ['Core'] },
    ]);
  });
});
