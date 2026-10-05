/**
 * @file Tests for the solver's outcomes: options, infeasibility, the cap, and missing data (AC12).
 */
import { describe, expect, it } from 'vitest';

import { type Course, type Section, SectionModality, Weekday } from '@caa/domain';
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

/** The seeded slice shape: A1 and B1 at 09:00, A2 and B2 at 10:00, so two pairs conflict. */
const A1 = sectionAt(COURSE_A, '09', 1);
const A2 = sectionAt(COURSE_A, '10', 2);
const B1 = sectionAt(COURSE_B, '09', 3);
const B2 = sectionAt(COURSE_B, '10', 4);
const SLICE = [requestOf(COURSE_A, [A1, A2]), requestOf(COURSE_B, [B1, B2])];

/**
 * Lists each option's section IDs.
 *
 * @param solution - The solution.
 * @returns The IDs per option, bundles by course ID.
 */
function optionIds(solution: ScheduleSolution): string[][] {
  return solution.options.map((option) =>
    option.bundles.flatMap((entry) => entry.bundle.sections.map((section) => section.id)),
  );
}

describe('solveSchedule options', () => {
  it('gives exactly two options for the seeded slice shape, in tie-break order', () => {
    const solution = solve(SLICE);

    expect(solution).toMatchObject({
      outcome: 'OPTIONS_FOUND',
      searchComplete: true,
      conflictSet: null,
      unresolved: [],
      workCap: 3_000_000,
      workUsed: 6,
    });
    expect(optionIds(solution)).toEqual([
      [A1.id, B2.id],
      [A2.id, B1.id],
    ]);
    expect(solution.options[0]).toMatchObject({
      rank: 1,
      scheduleFeasibility: { kind: 'SCHEDULE_FEASIBILITY', state: 'PASS' },
      creditLoad: {
        kind: 'CREDIT_LOAD',
        state: 'PASS',
        evidence: { creditLoad: { totalCreditsHundredths: 600 } },
      },
      unmetPreferences: [],
    });
    expect(solution.options[1]?.bundles.map((entry) => entry.creditsCountedHundredths)).toEqual([
      300, 300,
    ]);
  });

  it('gives a deep-equal result for shuffled requests and sections', () => {
    const shuffled = [requestOf(COURSE_B, [B2, B1]), requestOf(COURSE_A, [A2, A1])];

    expect(solve(shuffled)).toEqual(solve(SLICE));
  });

  it('keeps at most three distinct options', () => {
    const a3 = sectionAt(COURSE_A, '11', 5);
    const b3 = sectionAt(COURSE_B, '13', 6);

    const solution = solve([requestOf(COURSE_A, [A1, A2, a3]), requestOf(COURSE_B, [B1, B2, b3])]);

    expect(solution.options.map((option) => option.rank)).toEqual([1, 2, 3]);
    expect(new Set(optionIds(solution).map((ids) => ids.join())).size).toBe(3);
  });
});

describe('solveSchedule work cap (ADR-0010 §1; AC12)', () => {
  it('is SEARCH_TIMEOUT, never infeasible, when the cap ends the search before any candidate', () => {
    expect(solve(SLICE, { workCap: 2 })).toEqual({
      outcome: 'SEARCH_TIMEOUT',
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [],
      workCap: 2,
      workUsed: 2,
    });
  });

  it('says "search incomplete" when the cap stops it after a candidate', () => {
    const solution = solve(SLICE, { workCap: 3 });

    expect(solution).toMatchObject({
      outcome: 'OPTIONS_FOUND',
      searchComplete: false,
      workUsed: 3,
    });
    expect(optionIds(solution)).toEqual([[A1.id, B2.id]]);
  });

  it('is complete when the search needs exactly the cap', () => {
    expect(solve(SLICE, { workCap: 6 })).toMatchObject({ searchComplete: true, workUsed: 6 });
  });
});

describe('solveSchedule infeasibility', () => {
  it('is NO_FEASIBLE_PLAN with a verified, non-minimal conflict set when every pair conflicts', () => {
    const solution = solve([requestOf(COURSE_A, [A1]), requestOf(COURSE_B, [B1])]);

    expect(solution).toMatchObject({
      outcome: 'NO_FEASIBLE_PLAN',
      searchComplete: true,
      options: [],
      workUsed: 2,
      conflictSet: {
        isMinimal: false,
        omittedCount: 0,
        items: [{ kind: 'SCHEDULE_FEASIBILITY', state: 'FAIL', reasonCode: 'MEETING_CONFLICT' }],
      },
    });
  });

  it('is NO_FEASIBLE_PLAN before the search when a hard modality rules out every section', () => {
    const constraints = [
      buildAllowedModalities({ ...HARD_STRENGTH, modalities: [SectionModality.Hybrid] }),
    ];

    const solution = solve(SLICE, { constraints });

    expect(solution).toMatchObject({
      outcome: 'NO_FEASIBLE_PLAN',
      searchComplete: true,
      workUsed: 0,
    });
    expect(solution.conflictSet?.items.map((item) => item.reasonCode)).toEqual([
      'MODALITY_NOT_ALLOWED',
      'MODALITY_NOT_ALLOWED',
      'MODALITY_NOT_ALLOWED',
      'MODALITY_NOT_ALLOWED',
    ]);
  });

  it('is NO_FEASIBLE_PLAN when every bundle conflicts with its own required lab (AC06)', () => {
    const labCourse = buildCourse({ creditsHundredths: 100 }, 3);
    const lab = buildSection(
      { courseId: labCourse.id, meetings: [buildMeetingPattern({ startTime: '09:30' })] },
      7,
    );
    const group = buildLinkedSectionGroup({
      primarySectionId: A1.id,
      components: [
        buildLinkedSectionComponent({ courseId: labCourse.id, permittedSectionIds: [lab.id] }),
      ],
    });

    const solution = solve([
      requestOf(COURSE_A, [A1, lab], { groups: [group], courses: [labCourse] }),
    ]);

    expect(solution.outcome).toBe('NO_FEASIBLE_PLAN');
    expect(solution.conflictSet?.items).toMatchObject([
      { state: 'FAIL', reasonCode: 'MEETING_CONFLICT' },
    ]);
  });

  it('records credit-load FAILs, showing 20 and counting the rest', () => {
    const many = (course: Course, day: Weekday, first: number): Section[] =>
      Array.from({ length: 5 }, (_, offset) =>
        buildSection(
          { courseId: course.id, meetings: [buildMeetingPattern({ weekdays: [day] })] },
          first + offset,
        ),
      );
    const tight = buildAcademicPolicy({
      termCreditBounds: { minCreditsHundredths: 0, maxCreditsHundredths: 500 },
    });

    const solution = solve(
      [
        requestOf(COURSE_A, many(COURSE_A, Weekday.Monday, 10)),
        requestOf(COURSE_B, many(COURSE_B, Weekday.Tuesday, 20)),
      ],
      { policy: tight },
    );

    expect(solution.outcome).toBe('NO_FEASIBLE_PLAN');
    expect(solution.conflictSet?.items).toHaveLength(20);
    expect(solution.conflictSet?.omittedCount).toBe(5);
    expect(solution.conflictSet?.items[0]).toMatchObject({
      kind: 'CREDIT_LOAD',
      reasonCode: 'CREDIT_LIMIT_EXCEEDED',
    });
  });
});
