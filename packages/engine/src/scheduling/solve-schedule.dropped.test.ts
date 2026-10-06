/**
 * @file Tests that sections dropped for missing data stay in `unresolved` when the search runs.
 */
import { describe, expect, it } from 'vitest';

import type { CheckResult, Course, Section, SectionId } from '@caa/domain';
import {
  buildAcademicPolicy,
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildMeetingPattern,
  buildSection,
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
const LAB_COURSE = buildCourse({}, 3);
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
 * Builds a request whose listed sections each require a lab with no permitted section.
 *
 * @param course - The requested course.
 * @param sections - Its sections.
 * @param labless - The sections whose required lab has no permitted section.
 * @returns The request.
 */
function requestOf(
  course: Course,
  sections: readonly Section[],
  labless: readonly Section[] = [],
): ScheduleCourseRequest {
  const groups = labless.map((section) =>
    buildLinkedSectionGroup({
      primarySectionId: section.id,
      components: [
        buildLinkedSectionComponent({ courseId: LAB_COURSE.id, permittedSectionIds: [] }),
      ],
    }),
  );
  return {
    courseId: course.id,
    bundles: buildSectionBundles({
      course,
      snapshot: { sections, linkedSectionGroups: groups },
      linkedCourses: [LAB_COURSE],
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
    prerequisiteRules: [],
    workCap: 3_000_000,
    ...overrides,
  });
}

/**
 * Builds the UNKNOWN result for a course whose section's required lab has no permitted section.
 *
 * @param primarySectionId - The dropped section.
 * @returns The expected result.
 */
function labUnavailable(primarySectionId: SectionId): CheckResult {
  return {
    kind: 'SCHEDULE_FEASIBILITY',
    state: 'UNKNOWN',
    reasonCode: 'LINKED_SECTION_UNAVAILABLE',
    evidence: {
      rulesetVersion: null,
      decisiveLeaves: [],
      scheduleIssues: [
        {
          reasonCode: 'LINKED_SECTION_UNAVAILABLE',
          primarySectionId,
          componentName: 'Lab',
          courseId: LAB_COURSE.id,
        },
      ],
    },
  };
}

const A1 = sectionAt(COURSE_A, '09', 1);
const A2 = sectionAt(COURSE_A, '10', 2);
const B1 = sectionAt(COURSE_B, '09', 3);
const B2 = sectionAt(COURSE_B, '10', 4);
const B3 = sectionAt(COURSE_B, '11', 5);
const KEPT = [requestOf(COURSE_A, [A1]), requestOf(COURSE_B, [B1, B2])];
const WITH_DROPPED = [requestOf(COURSE_A, [A1, A2], [A2]), requestOf(COURSE_B, [B1, B2])];
const DROPPED_IN_BOTH = [
  requestOf(COURSE_B, [B3, B2, B1], [B3]),
  requestOf(COURSE_A, [A2, A1], [A2]),
];

describe('solveSchedule unresolved when the search runs (ADR-0010 Amendment 5)', () => {
  it('is OPTIONS_FOUND with the dropped section in unresolved and options as without it', () => {
    const solution = solve(WITH_DROPPED);

    expect(solution).toMatchObject({
      outcome: 'OPTIONS_FOUND',
      searchComplete: true,
      conflictSet: null,
      unresolved: [labUnavailable(A2.id)],
    });
    expect(
      solution.options.map((option) => option.bundles.map((b) => b.bundle.sections[0]?.id)),
    ).toEqual([[A1.id, B2.id]]);
    expect(solution).toEqual({ ...solve(KEPT), unresolved: [labUnavailable(A2.id)] });
  });

  it('is SEARCH_TIMEOUT with the dropped section in unresolved when the cap ends the search', () => {
    expect(solve(WITH_DROPPED, { workCap: 2 })).toEqual({
      outcome: 'SEARCH_TIMEOUT',
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [labUnavailable(A2.id)],
      workCap: 2,
      workUsed: 2,
    });
  });

  it('keeps unresolved empty on OPTIONS_FOUND when nothing was dropped', () => {
    expect(solve(KEPT)).toMatchObject({ outcome: 'OPTIONS_FOUND', unresolved: [] });
  });

  it('orders unresolved by course ID whatever the order of requests and sections', () => {
    const solution = solve(DROPPED_IN_BOTH);
    const reordered = solve([
      requestOf(COURSE_A, [A1, A2], [A2]),
      requestOf(COURSE_B, [B1, B2, B3], [B3]),
    ]);

    expect(solution.outcome).toBe('OPTIONS_FOUND');
    expect(solution.unresolved).toEqual([labUnavailable(A2.id), labUnavailable(B3.id)]);
    expect(reordered).toEqual(solution);
  });
});
