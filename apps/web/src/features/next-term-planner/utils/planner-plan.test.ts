/**
 * @file Tests for planning the schedule-options request: preferred by default, hard only when
 * chosen, contradictions reported and never adjusted.
 */
import { describe, expect, it } from 'vitest';

import { ConstraintStrength } from '@caa/domain';
import { SYNTHETIC_COURSES, syntheticId } from '@caa/test-kit';

import { indexCourses } from '@/shared/utils/course-display';

import { planScheduleRequest } from './planner-plan';
import { readPlannerQuery, type SearchParams } from './planner-query';

const STUDENT_ID = syntheticId('student', 1);
const TERM_ID = syntheticId('term', 1);
const { math101 } = SYNTHETIC_COURSES;
const BASE: SearchParams = { studentId: STUDENT_ID, term: TERM_ID, course: math101.id };

/**
 * Plans from query params added to a valid term and course.
 *
 * @param extra - Params to add.
 * @returns The plan.
 */
function plan(extra: SearchParams = {}): ReturnType<typeof planScheduleRequest> {
  return planScheduleRequest(readPlannerQuery({ ...BASE, ...extra }).values, indexCourses([]));
}

describe('planScheduleRequest', () => {
  it('sends no constraints when none are stated', () => {
    const result = plan();

    expect(result.issues).toEqual([]);
    expect(result.request).toMatchObject({
      termId: TERM_ID,
      courseIds: [math101.id],
      constraints: [],
    });
  });

  it('states "no Fridays" as a preference for the whole day unless the student chose required', () => {
    const result = plan({ 'block1-day': 'FRIDAY' });

    expect(result.request?.constraints).toEqual([
      {
        kind: 'UNAVAILABLE_TIME',
        weekdays: ['FRIDAY'],
        startTime: '00:00',
        endTime: '24:00',
        strength: ConstraintStrength.Preferred,
        priorityRank: 1,
      },
    ]);
  });

  it('makes a constraint hard, with no priority, only when chosen', () => {
    const result = plan({ 'block1-day': 'FRIDAY', 'block1-strength': 'HARD' });

    expect(result.request?.constraints[0]).toMatchObject({ strength: 'HARD', priorityRank: null });
  });

  it('reports a hard credit range with a minimum above the maximum and sends nothing', () => {
    const result = plan({
      'credit-range-min': '15',
      'credit-range-max': '12',
      'credit-range-strength': 'HARD',
    });

    expect(result.request).toBeNull();
    expect(result.issues.map((issue) => issue.name)).toContain('credit-range-min');
  });

  it('reports a block that ends before it starts, on the time fields', () => {
    const result = plan({ 'block1-day': 'MONDAY', 'block1-start': '14:00', 'block1-end': '09:00' });

    expect(result.request).toBeNull();
    expect(result.issues[0]?.name).toBe('block1-end');
  });

  it('reports two preferences that share a priority as a whole-set issue', () => {
    const result = plan({
      'block1-day': 'FRIDAY',
      'block1-rank': '2',
      'credit-range-min': '12',
      'credit-range-rank': '2',
    });

    expect(result.request).toBeNull();
    expect(result.issues).toEqual([
      { name: null, message: 'Give each preference a different priority number.' },
    ]);
  });

  it('reports a missing term and no courses', () => {
    const result = planScheduleRequest(
      readPlannerQuery({ studentId: STUDENT_ID }).values,
      indexCourses([]),
    );

    expect(result.issues.map((issue) => issue.name)).toEqual(['term', 'course']);
  });

  it('reports a day-less block that has times', () => {
    const result = plan({ 'block1-start': '09:00' });

    expect(result.issues[0]).toMatchObject({ name: 'block1-day' });
  });
});
