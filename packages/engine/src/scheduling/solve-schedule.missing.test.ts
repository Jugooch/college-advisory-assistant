/**
 * @file Tests for the solver's answers when section data is missing: needs verification, never a guess.
 */
import { describe, expect, it } from 'vitest';

import { type Course, type Section, SectionModality } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildAllowedModalities,
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildSection,
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
const POLICY = buildAcademicPolicy({
  termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 3000 },
});

/**
 * Builds a section of a course meeting MWF at an hour.
 *
 * @param course - The course.
 * @param hour - The local start hour, such as `09`.
 * @param seed - The section seed.
 * @returns The section.
 */
function sectionAt(course: Course, hour: string, seed: number): Section {
  const meeting = buildMeetingPattern({ startTime: `${hour}:00`, endTime: `${hour}:50` });
  return buildSection({ courseId: course.id, meetings: [meeting] }, seed);
}

/**
 * Builds a request from a course's sections.
 *
 * @param course - The requested course.
 * @param sections - Its sections, and any linked sections.
 * @param links - Linked groups and the linked courses.
 * @returns The request.
 */
function requestOf(
  course: Course,
  sections: readonly Section[],
  links: {
    readonly groups: readonly ReturnType<typeof buildLinkedSectionGroup>[];
    readonly courses: readonly Course[];
  } = { groups: [], courses: [] },
): ScheduleCourseRequest {
  return {
    courseId: course.id,
    bundles: buildSectionBundles({
      course,
      snapshot: { sections, linkedSectionGroups: links.groups },
      linkedCourses: links.courses,
      transitionPolicy: null,
    }),
  };
}

/**
 * Solves with the default policy and no constraints.
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
    policy: POLICY,
    constraints: [],
    transitionPolicy: null,
    workCap: 3_000_000,
    ...overrides,
  });
}

const A1 = sectionAt(COURSE_A, '09', 1);
const B1 = sectionAt(COURSE_B, '09', 3);
const REQUEST_A = requestOf(COURSE_A, [A1]);

describe('solveSchedule missing data', () => {
  it('needs verification with SECTION_DATA_MISSING for a course with no sections, without searching', () => {
    const solution = solve([REQUEST_A, requestOf(COURSE_B, [])]);

    expect(solution).toMatchObject({
      outcome: 'NEEDS_VERIFICATION',
      searchComplete: false,
      options: [],
      conflictSet: null,
      workUsed: 0,
      unresolved: [
        {
          state: 'UNKNOWN',
          reasonCode: 'SECTION_DATA_MISSING',
          evidence: {
            scheduleIssues: [{ reasonCode: 'SECTION_DATA_MISSING', courseId: COURSE_B.id }],
          },
        },
      ],
    });
  });

  it('needs verification with LINKED_SECTION_UNAVAILABLE when a required component has no section', () => {
    const group = buildLinkedSectionGroup({
      primarySectionId: B1.id,
      components: [buildLinkedSectionComponent({ permittedSectionIds: [] })],
    });

    const solution = solve([
      requestOf(COURSE_A, [A1]),
      requestOf(COURSE_B, [B1], { groups: [group], courses: [] }),
    ]);

    expect(solution.outcome).toBe('NEEDS_VERIFICATION');
    expect(solution.unresolved.map((check) => check.reasonCode)).toEqual([
      'LINKED_SECTION_UNAVAILABLE',
    ]);
  });

  it('reports infeasibility before missing data', () => {
    const constraints = [
      buildAllowedModalities({ ...HARD_STRENGTH, modalities: [SectionModality.Hybrid] }),
    ];

    expect(solve([REQUEST_A, requestOf(COURSE_B, [])], { constraints }).outcome).toBe(
      'NO_FEASIBLE_PLAN',
    );
  });
});
