/**
 * @file Tests for the solver's ranking: PASS before UNKNOWN, preferences in priority order.
 */
import { describe, expect, it } from 'vitest';

import { type Course, type Section, Weekday } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildCreditRange,
  buildMeetingPattern,
  buildSection,
  buildTbaMeeting,
  buildUnavailableTime,
  buildVariableCreditCourse,
  HARD_STRENGTH,
} from '@caa/test-kit';

import { buildSectionBundles } from './build-section-bundles';
import type {
  ScheduleCourseRequest,
  ScheduleSolution,
  SolveScheduleInput,
} from './schedule-solution';
import { solveSchedule } from './solve-schedule';

const COURSE_A = buildCourse({}, 1);
const COURSE_B = buildCourse({}, 2);

/**
 * Builds a request from a course's sections, with no linked groups.
 *
 * @param course - The requested course.
 * @param sections - Its sections.
 * @returns The request.
 */
function requestOf(course: Course, sections: readonly Section[]): ScheduleCourseRequest {
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
    prerequisiteRules: [],
    workCap: 3_000_000,
    ...overrides,
  });
}

/**
 * Builds a section of a course on Tuesdays and Thursdays at an hour.
 *
 * @param course - The course.
 * @param hour - The local start hour.
 * @param seed - The section seed.
 * @returns The section.
 */
function tthAt(course: Course, hour: string, seed: number): Section {
  const meeting = buildMeetingPattern({
    weekdays: [Weekday.Tuesday, Weekday.Thursday],
    startTime: `${hour}:00`,
    endTime: `${hour}:50`,
  });
  return buildSection({ courseId: course.id, meetings: [meeting] }, seed);
}

describe('solveSchedule ranking (ADR-0010 §4)', () => {
  it('ranks a PASS option above one with a TBA meeting, which is UNKNOWN, never PASS', () => {
    const tba = buildSection({ courseId: COURSE_A.id, meetings: [buildTbaMeeting()] }, 1);
    const timed = tthAt(COURSE_A, '09', 2);

    const solution = solve([
      requestOf(COURSE_A, [tba, timed]),
      requestOf(COURSE_B, [tthAt(COURSE_B, '13', 3)]),
    ]);

    expect(solution.options.map((option) => option.scheduleFeasibility.state)).toEqual([
      'PASS',
      'UNKNOWN',
    ]);
    expect(solution.options[1]?.scheduleFeasibility).toMatchObject({
      reasonCode: 'MEETING_TIME_UNKNOWN',
    });
  });

  it('ranks by the first preference first and lists every unmet preference', () => {
    const constraints = [
      buildUnavailableTime({ weekdays: [Weekday.Tuesday], startTime: '00:00', endTime: '10:00' }),
      buildUnavailableTime({
        priorityRank: 2,
        weekdays: [Weekday.Thursday],
        startTime: '12:00',
        endTime: '24:00',
      }),
    ];
    const early = tthAt(COURSE_A, '09', 1);
    const late = tthAt(COURSE_A, '14', 2);

    const solution = solve([requestOf(COURSE_A, [early, late])], { constraints });

    expect(solution.options.map((option) => option.bundles[0]?.bundle.sections[0]?.id)).toEqual([
      late.id,
      early.id,
    ]);
    expect(solution.options[0]?.unmetPreferences).toEqual([
      {
        constraintIndex: 1,
        priorityRank: 2,
        kind: 'UNAVAILABLE_TIME',
        sectionId: late.id,
        meetingIndex: 0,
        isDataUnknown: false,
      },
    ]);
    expect(solution.options[1]?.unmetPreferences).toMatchObject([
      { constraintIndex: 0, priorityRank: 1 },
    ]);
  });

  it('counts a preference that depends on a TBA time as missed, marked unknown', () => {
    const constraints = [buildUnavailableTime({ weekdays: [Weekday.Monday] })];
    const tba = buildSection({ courseId: COURSE_A.id, meetings: [buildTbaMeeting()] }, 1);

    const [option] = solve([requestOf(COURSE_A, [tba])], { constraints }).options;

    expect(option?.unmetPreferences).toMatchObject([{ constraintIndex: 0, isDataUnknown: true }]);
  });

  it('keeps an option with a hard TBA conflict as UNKNOWN, never PASS', () => {
    const constraints = [buildUnavailableTime({ ...HARD_STRENGTH, weekdays: [Weekday.Monday] })];
    const tba = buildSection({ courseId: COURSE_A.id, meetings: [buildTbaMeeting()] }, 1);

    const [option] = solve([requestOf(COURSE_A, [tba])], { constraints }).options;

    expect(option?.scheduleFeasibility).toMatchObject({
      state: 'UNKNOWN',
      reasonCode: 'MEETING_TIME_UNKNOWN',
    });
  });

  it('is UNKNOWN for a TBA meeting against a timed one in another course', () => {
    const tba = buildSection({ courseId: COURSE_B.id, meetings: [buildTbaMeeting()] }, 2);

    const [option] = solve([
      requestOf(COURSE_A, [tthAt(COURSE_A, '09', 1)]),
      requestOf(COURSE_B, [tba]),
    ]).options;

    expect(option?.scheduleFeasibility.evidence?.scheduleIssues).toMatchObject([
      {
        reasonCode: 'MEETING_TIME_UNKNOWN',
        meeting: { sectionId: tba.id },
        otherMeeting: { sectionId: tthAt(COURSE_A, '09', 1).id },
      },
    ]);
  });
});

describe('solveSchedule credit preferences and unknown credits', () => {
  it('ranks an option inside the preferred credit range first', () => {
    const light = buildCourse({ creditsHundredths: 100 }, 3);
    const heavy = buildCourse({ creditsHundredths: 400 }, 4);
    const constraints = [
      buildCreditRange({ minCreditsHundredths: 500, maxCreditsHundredths: 700 }),
    ];

    const solution = solve(
      [requestOf(COURSE_A, [tthAt(COURSE_A, '09', 1)]), requestOf(light, [tthAt(light, '10', 2)])],
      { constraints },
    );
    const heavier = solve(
      [requestOf(COURSE_A, [tthAt(COURSE_A, '09', 1)]), requestOf(heavy, [tthAt(heavy, '10', 2)])],
      { constraints },
    );

    expect(solution.options[0]?.unmetPreferences).toEqual([
      {
        constraintIndex: 0,
        priorityRank: 1,
        kind: 'CREDIT_RANGE',
        sectionId: null,
        meetingIndex: null,
        isDataUnknown: false,
      },
    ]);
    expect(heavier.options[0]?.unmetPreferences).toEqual([]);
  });

  it('leaves the schedule UNKNOWN when a variable credit value is not chosen', () => {
    const variable = buildVariableCreditCourse({}, 3);
    const constraints = [buildCreditRange()];

    const [option] = solve([requestOf(variable, [tthAt(variable, '09', 1)])], {
      constraints,
    }).options;

    expect(option).toMatchObject({
      scheduleFeasibility: { state: 'UNKNOWN', reasonCode: 'VARIABLE_CREDIT_UNSELECTED' },
      creditLoad: { state: 'UNKNOWN', reasonCode: 'VARIABLE_CREDIT_UNSELECTED' },
      bundles: [{ creditsCountedHundredths: null }],
      unmetPreferences: [{ kind: 'CREDIT_RANGE', isDataUnknown: true }],
    });
  });

  it('uses a chosen variable credit value', () => {
    const variable = buildVariableCreditCourse({}, 3);

    const [option] = solve([requestOf(variable, [tthAt(variable, '09', 1)])], {
      selectedCredits: new Map([[variable.id, 200]]),
    }).options;

    expect(option?.creditLoad).toMatchObject({
      state: 'PASS',
      evidence: { creditLoad: { totalCreditsHundredths: 200 } },
    });
  });

  it('removes candidates above the hard credit range and names it in the conflict', () => {
    const constraints = [
      buildCreditRange({ ...HARD_STRENGTH, minCreditsHundredths: null, maxCreditsHundredths: 500 }),
    ];

    const solution = solve(
      [
        requestOf(COURSE_A, [tthAt(COURSE_A, '09', 1)]),
        requestOf(COURSE_B, [tthAt(COURSE_B, '10', 2)]),
      ],
      { constraints },
    );

    expect(solution.outcome).toBe('NO_FEASIBLE_PLAN');
    expect(solution.conflictSet?.items).toMatchObject([
      {
        kind: 'CREDIT_LOAD',
        reasonCode: 'CREDIT_LIMIT_EXCEEDED',
        sourceRef: 'demo-2026.1:constraints[0]',
      },
    ]);
  });
});
