/**
 * @file Tests for choosing the planner step: a search runs only after the review is confirmed.
 */
import { describe, expect, it } from 'vitest';

import { ApiError } from '@caa/api-contract';
import { ErrorCode } from '@caa/domain';
import { SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { PlannerStep } from './planner-fields';
import { planScheduleRequest } from './planner-plan';
import { readPlannerQuery } from './planner-query';
import { isSearchRequested, planPlannerView } from './planner-view';

const VALID = readPlannerQuery({
  studentId: syntheticId('student', 1),
  term: syntheticId('term', 1),
  course: SYNTHETIC_COURSES.math101.id,
  'block1-day': 'FRIDAY',
}).values;
const GOOD = planScheduleRequest(VALID, indexCourses([]));
const BAD = planScheduleRequest(readPlannerQuery({}).values, indexCourses([]));

describe('planPlannerView', () => {
  it('shows the form with no issues on the edit step, even for valid values', () => {
    expect(planPlannerView(PlannerStep.Edit, GOOD, null)).toEqual({ kind: 'form', issues: [] });
  });

  it('shows the review, not a search, on the review step', () => {
    expect(isSearchRequested(PlannerStep.Review, GOOD)).toBe(false);
    expect(planPlannerView(PlannerStep.Review, GOOD, null).kind).toBe('review');
  });

  it('sends the student back to the form with the issues when the values are invalid', () => {
    expect(isSearchRequested(PlannerStep.Search, BAD)).toBe(false);
    expect(planPlannerView(PlannerStep.Search, BAD, null)).toEqual({
      kind: 'form',
      issues: BAD.issues,
    });
  });

  it('searches only on the confirm step with a valid request', () => {
    expect(isSearchRequested(PlannerStep.Search, GOOD)).toBe(true);
  });

  it('keeps the confirmed constraints when the search fails', () => {
    const error = new ApiError({
      code: ErrorCode.SourceUnavailable,
      status: 503,
      message: 'down',
      requestId: 'r',
    });

    const view = planPlannerView(PlannerStep.Search, GOOD, error);

    expect(view).toMatchObject({ kind: 'search-failed' });
    expect(view.kind === 'search-failed' && view.constraints).toHaveLength(1);
  });
});
