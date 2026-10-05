/**
 * @file Tests for malformed solver input, included credits across bundles, and unmet ordering.
 */
import { describe, expect, it } from 'vitest';

import { type Course, type Section, Weekday } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildCreditRange,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildSection,
  buildUnavailableTime,
} from '@caa/test-kit';

import { buildSectionBundles } from './build-section-bundles';
import { ScheduleInputError } from './schedule-input-error';
import type {
  ScheduleCourseRequest,
  ScheduleSolution,
  SolveScheduleInput,
} from './schedule-solution';
import { solveSchedule } from './solve-schedule';

const LECTURE_COURSE = buildCourse({}, 1);
const LAB_COURSE = buildCourse(
  { creditsHundredths: 100, creditsIncludedInCourseId: LECTURE_COURSE.id },
  2,
);
const LECTURE = buildSection({}, 1);
const LAB = buildSection(
  { courseId: LAB_COURSE.id, meetings: [buildMeetingPattern({ weekdays: [Weekday.Tuesday] })] },
  2,
);
const LAB_GROUP = buildLinkedSectionGroup({
  components: [
    buildLinkedSectionComponent({ courseId: LAB_COURSE.id, permittedSectionIds: [LAB.id] }),
  ],
});

/**
 * Builds a request from a course's sections and linked groups.
 *
 * @param course - The requested course.
 * @param sections - Its sections and any linked sections.
 * @param groups - The linked groups.
 * @returns The request.
 */
function requestOf(
  course: Course,
  sections: readonly Section[],
  groups: readonly ReturnType<typeof buildLinkedSectionGroup>[] = [],
): ScheduleCourseRequest {
  return {
    courseId: course.id,
    bundles: buildSectionBundles({
      course,
      snapshot: { sections, linkedSectionGroups: groups },
      linkedCourses: [LECTURE_COURSE, LAB_COURSE],
      transitionPolicy: null,
    }),
  };
}

/**
 * Solves with bounds 0 to 30 credits.
 *
 * @param requests - The requests.
 * @param overrides - Fields to replace.
 * @returns The solution.
 */
function solve(
  requests: readonly ScheduleCourseRequest[],
  overrides: Partial<SolveScheduleInput> = {},
): ScheduleSolution {
  return solveSchedule({
    requests,
    selectedCredits: new Map(),
    policy: buildAcademicPolicy({
      termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 3000 },
    }),
    constraints: [],
    transitionPolicy: null,
    workCap: 10,
    ...overrides,
  });
}

describe('solveSchedule input errors', () => {
  const one = [requestOf(LECTURE_COURSE, [LECTURE])];

  it.each([0, 1.5, 3_000_001])('throws workCap for a cap of %s', (workCap) => {
    expect(() => solve(one, { workCap })).toThrow(new ScheduleInputError('workCap'));
  });

  it('throws requests for no courses, a repeated course, or more than 8', () => {
    const nine = Array.from({ length: 9 }, (_, index) => {
      const course = buildCourse({}, index + 10);
      return requestOf(course, [buildSection({ courseId: course.id }, index + 10)]);
    });

    expect(() => solve([])).toThrow(new ScheduleInputError('requests'));
    expect(() => solve([...one, ...one])).toThrow(new ScheduleInputError('requests'));
    expect(() => solve(nine)).toThrow(new ScheduleInputError('requests'));
  });

  it('throws courseInTwoRequests when a requested course is also linked in another bundle', () => {
    const lectureWithLab = requestOf(LECTURE_COURSE, [LECTURE, LAB], [LAB_GROUP]);

    expect(() => solve([lectureWithLab, requestOf(LAB_COURSE, [LAB])])).toThrow(
      new ScheduleInputError('courseInTwoRequests'),
    );
  });
});

describe('solveSchedule included credits and unmet ordering', () => {
  it('counts a lab included in its lecture once, across the bundle', () => {
    const [option] = solve([requestOf(LECTURE_COURSE, [LECTURE, LAB], [LAB_GROUP])]).options;

    expect(option?.bundles.map((entry) => entry.creditsCountedHundredths)).toEqual([300]);
    expect(option?.creditLoad.evidence?.creditLoad?.totalCreditsHundredths).toBe(300);
  });

  it('counts a lab requested on its own once when its lecture is requested too', () => {
    const solution = solve([requestOf(LECTURE_COURSE, [LECTURE]), requestOf(LAB_COURSE, [LAB])]);

    expect(solution.options[0]?.bundles.map((entry) => entry.creditsCountedHundredths)).toEqual([
      300, 0,
    ]);
  });

  it('lists unmet preferences by priority rank', () => {
    const constraints = [
      buildCreditRange({ priorityRank: 2, minCreditsHundredths: 1200, maxCreditsHundredths: 1500 }),
      buildUnavailableTime({ weekdays: [Weekday.Monday] }),
    ];

    const [option] = solve([requestOf(LECTURE_COURSE, [LECTURE])], { constraints }).options;

    expect(option?.unmetPreferences.map((entry) => [entry.priorityRank, entry.kind])).toEqual([
      [1, 'UNAVAILABLE_TIME'],
      [2, 'CREDIT_RANGE'],
    ]);
  });
});
