/**
 * @file Tests that the solver's conflict set lists each distinct FAIL result once (ADR-0010 §5).
 */
import { describe, expect, it } from 'vitest';

import { type Course, type Section, Weekday } from '@caa/domain';
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

const MATH_102 = buildCourse({ label: 'DEMO-MATH 102' }, 102);
const ENGL_101 = buildCourse({ label: 'DEMO-ENGL 101' }, 101);
/** The demo policy's load: 12.00 to 18.00 credits. */
const FULL_TIME = buildAcademicPolicy({
  termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
});

/**
 * Builds a section meeting on one weekday at an hour.
 *
 * @param course - The course.
 * @param slot - The weekday and the local start hour, such as `09`.
 * @param seed - The section seed.
 * @returns The section.
 */
function sectionOn(
  course: Course,
  slot: { readonly day: Weekday; readonly hour: string },
  seed: number,
): Section {
  const { day, hour } = slot;
  const meeting = buildMeetingPattern({
    weekdays: [day],
    startTime: `${hour}:00`,
    endTime: `${hour}:50`,
  });
  return buildSection({ courseId: course.id, meetings: [meeting] }, seed);
}

/**
 * Builds a request from a course's sections and any linked groups.
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
 * Solves with no constraints.
 *
 * @param requests - The requests.
 * @param policy - The academic policy.
 * @returns The solution.
 */
function solve(
  requests: readonly ScheduleCourseRequest[],
  policy: SolveScheduleInput['policy'],
): ScheduleSolution {
  return solveSchedule({
    requests,
    selectedCredits: new Map(),
    policy,
    constraints: [],
    transitionPolicy: null,
    prerequisiteRules: [],
    workCap: 3_000_000,
  });
}

const MATH_SECTIONS = [
  sectionOn(MATH_102, { day: Weekday.Monday, hour: '09' }, 1),
  sectionOn(MATH_102, { day: Weekday.Monday, hour: '10' }, 2),
];
const ENGL_SECTIONS = [
  sectionOn(ENGL_101, { day: Weekday.Tuesday, hour: '09' }, 3),
  sectionOn(ENGL_101, { day: Weekday.Tuesday, hour: '10' }, 4),
];

describe('solveSchedule conflict set, credit load', () => {
  it('lists a load below the minimum once, however many section choices give it (#610)', () => {
    const solution = solve(
      [requestOf(MATH_102, MATH_SECTIONS), requestOf(ENGL_101, ENGL_SECTIONS)],
      FULL_TIME,
    );

    // Four candidates, each 6.00 credits against a 12.00 minimum, give one FAIL.
    expect(solution).toMatchObject({
      outcome: 'NO_FEASIBLE_PLAN',
      searchComplete: true,
      workUsed: 6,
    });
    expect(solution.conflictSet).toEqual({
      isMinimal: false,
      omittedCount: 0,
      items: [
        {
          kind: 'CREDIT_LOAD',
          state: 'FAIL',
          reasonCode: 'CREDIT_BELOW_MINIMUM',
          sourceRef: 'demo-2026.1:termCreditBounds',
          evidence: {
            rulesetVersion: 'demo-2026.1',
            decisiveLeaves: [],
            courseIds: [
              '50000000-0000-4000-8000-000000000065',
              '50000000-0000-4000-8000-000000000066',
            ],
            creditLoad: {
              totalCreditsHundredths: 600,
              minCreditsHundredths: 1200,
              maxCreditsHundredths: 1800,
            },
          },
        },
      ],
    });
  });

  it('gives the same conflict set whatever the request order', () => {
    const forward = solve(
      [requestOf(MATH_102, MATH_SECTIONS), requestOf(ENGL_101, ENGL_SECTIONS)],
      FULL_TIME,
    );
    const reversed = solve(
      [requestOf(ENGL_101, [...ENGL_SECTIONS].reverse()), requestOf(MATH_102, MATH_SECTIONS)],
      FULL_TIME,
    );

    expect(reversed.conflictSet).toEqual(forward.conflictSet);
  });

  it('lists one FAIL per distinct load when bundles differ in their courses', () => {
    const lab = buildCourse({ label: 'DEMO-MATH 102L', creditsHundredths: 100 }, 103);
    const lecture = sectionOn(MATH_102, { day: Weekday.Monday, hour: '09' }, 5);
    const labSection = sectionOn(lab, { day: Weekday.Wednesday, hour: '09' }, 6);
    const group = buildLinkedSectionGroup({
      primarySectionId: lecture.id,
      components: [
        buildLinkedSectionComponent({ courseId: lab.id, permittedSectionIds: [labSection.id] }),
      ],
    });
    const plain = sectionOn(MATH_102, { day: Weekday.Monday, hour: '10' }, 7);

    const solution = solve(
      [
        requestOf(MATH_102, [lecture, labSection, plain], { groups: [group], courses: [lab] }),
        requestOf(ENGL_101, ENGL_SECTIONS),
      ],
      FULL_TIME,
    );

    // With the lab: 7.00 credits; without: 6.00. Two section choices give each. The lab's
    // lecture sorts before the plain section, so its FAIL comes first.
    expect(
      solution.conflictSet?.items.map((item) => [
        item.reasonCode,
        item.evidence?.creditLoad?.totalCreditsHundredths,
      ]),
    ).toEqual([
      ['CREDIT_BELOW_MINIMUM', 700],
      ['CREDIT_BELOW_MINIMUM', 600],
    ]);
    expect(solution.conflictSet?.omittedCount).toBe(0);
  });
});

describe('solveSchedule conflict set, schedule feasibility', () => {
  it('lists a FAIL inside a bundle once when two bundles share it', () => {
    const lab = buildCourse({ label: 'DEMO-MATH 102L', creditsHundredths: 0 }, 103);
    const recitation = buildCourse({ label: 'DEMO-MATH 102R', creditsHundredths: 0 }, 104);
    const lecture = sectionOn(MATH_102, { day: Weekday.Monday, hour: '09' }, 5);
    // The lab overlaps the lecture; each recitation is compatible with both.
    const labSection = sectionOn(lab, { day: Weekday.Monday, hour: '09' }, 6);
    const recitations = [
      sectionOn(recitation, { day: Weekday.Friday, hour: '13' }, 7),
      sectionOn(recitation, { day: Weekday.Friday, hour: '14' }, 8),
    ];
    const group = buildLinkedSectionGroup({
      primarySectionId: lecture.id,
      components: [
        buildLinkedSectionComponent({ courseId: lab.id, permittedSectionIds: [labSection.id] }),
        buildLinkedSectionComponent({
          courseId: recitation.id,
          permittedSectionIds: recitations.map((section) => section.id),
        }),
      ],
    });

    const solution = solve(
      [
        requestOf(MATH_102, [lecture, labSection, ...recitations], {
          groups: [group],
          courses: [lab, recitation],
        }),
      ],
      FULL_TIME,
    );

    expect(solution.outcome).toBe('NO_FEASIBLE_PLAN');
    expect(solution.conflictSet?.items).toMatchObject([
      { kind: 'SCHEDULE_FEASIBILITY', state: 'FAIL', reasonCode: 'MEETING_CONFLICT' },
    ]);
    expect(solution.conflictSet?.omittedCount).toBe(0);
  });
});
