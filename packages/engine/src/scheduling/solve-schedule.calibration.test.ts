/**
 * @file Calibration test: the default cap finishes the worst S4 input, 8 courses of 6 bundles.
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import { describe, expect, it } from 'vitest';

import { type Course, type Section, Weekday } from '@caa/domain';
import { buildAcademicPolicy, buildCourse, buildMeetingPattern, buildSection } from '@caa/test-kit';

import { buildSectionBundles } from './build-section-bundles';
import { DEFAULT_SOLVER_WORK_CAP, type ScheduleCourseRequest } from './schedule-solution';
import { solveSchedule } from './solve-schedule';

const DAYS = [Weekday.Monday, Weekday.Tuesday, Weekday.Wednesday, Weekday.Thursday];
const COURSES = 8;
const BUNDLES = 6;

/**
 * Builds one requested course with six sections in its own time slot, so no two courses ever
 * conflict and every combination is a candidate: the search's worst case.
 *
 * @param position - The course's position, 0 to 7.
 * @returns The request.
 */
function worstCaseRequest(position: number): ScheduleCourseRequest {
  const course: Course = buildCourse({}, position + 1);
  const meeting = buildMeetingPattern({
    weekdays: [DAYS[position % DAYS.length] ?? Weekday.Friday],
    startTime: position < DAYS.length ? '08:00' : '13:00',
    endTime: position < DAYS.length ? '08:50' : '13:50',
  });
  const sections: Section[] = Array.from({ length: BUNDLES }, (_, offset) =>
    buildSection({ courseId: course.id, meetings: [meeting] }, 100 + position * 10 + offset),
  );
  return {
    courseId: course.id,
    bundles: buildSectionBundles({
      course,
      snapshot: { sections, linkedSectionGroups: [] },
      linkedCourses: [],
      transitionPolicy: null,
    }),
  };
}

describe('solveSchedule calibration (ADR-0010 §1)', () => {
  // NOTE: coverage instrumentation inflates this run past Vitest's 5 s default, so it gets an
  // explicit timeout; the 2 s target is checked separately, uninstrumented (ADR-0010 Amendment 3).
  it(
    'finishes 8 courses × 6 bundles within the default cap: 2,015,538 attempts',
    { timeout: 30_000 },
    () => {
      const requests = Array.from({ length: COURSES }, (_, position) => worstCaseRequest(position));

      const solution = solveSchedule({
        requests,
        selectedCredits: new Map(),
        policy: buildAcademicPolicy({
          termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 3000 },
        }),
        constraints: [],
        transitionPolicy: null,
        workCap: DEFAULT_SOLVER_WORK_CAP,
      });

      expect(solution.outcome).toBe('OPTIONS_FOUND');
      expect(solution.searchComplete).toBe(true);
      expect(solution.workUsed).toBe(2_015_538);
      expect(solution.workUsed).toBeLessThanOrEqual(DEFAULT_SOLVER_WORK_CAP);
      expect(solution.options).toHaveLength(3);
    },
  );
});
