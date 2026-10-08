/**
 * @file Golden scheduling cases: how many items the conflict set shows and how many it counts as
 *   omitted (ADR-0010 §5), and that UNKNOWN pairs never enter it (#226). GC-SOLVE-011–014.
 * @module @caa/test-kit/golden/cases/solver-conflict-set-cap
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, ReasonCode, ScheduleOutcome, type Section, Weekday } from '@caa/domain';

import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  scheduleCase,
  scheduleCheck,
  type ScheduleCheckAuthored,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math101, math102 } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.SolverOutcome;
const REQUIREMENTS = ['FR-07', 'FR-18', 'T05'];
const CITATIONS = ['ADR-0010 §3 and §5'];
const ALL_TERM_MWF = {
  firstDate: '2027-01-11',
  lastDate: '2027-05-07',
  weekdays: ['FRIDAY', 'MONDAY', 'WEDNESDAY'],
};
const MWF = [Weekday.Monday, Weekday.Wednesday, Weekday.Friday];

// NOTE: every section meets MWF 09:00–09:50, so each course A section conflicts with each course B
// section. Course A sections have the lower IDs, so the pairs sort by A's section, then B's.

/**
 * Builds sections of a course at MWF 09:00–09:50.
 *
 * @param courseId - The course.
 * @param firstSeed - The first seed; the rest follow in order.
 * @param count - How many sections.
 * @returns The sections, IDs ascending.
 */
function sectionsOf(courseId: string, firstSeed: number, count: number): readonly Section[] {
  return Array.from({ length: count }, (_, index) => scheduleSection(courseId, firstSeed + index));
}

/**
 * Lists the conflict items of every pairing, in the order the ADR sorts them: by the pair's
 * ascending section IDs, element by element.
 *
 * @param courseA - The sections of the course whose IDs sort first.
 * @param courseB - The sections of the other course.
 * @returns One FAIL meeting-conflict check per pairing.
 */
function pairConflicts(
  courseA: readonly Section[],
  courseB: readonly Section[],
): readonly ScheduleCheckAuthored[] {
  return courseA.flatMap((a) =>
    courseB.map((b) =>
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(a, b),
          sharedDates: ALL_TERM_MWF,
        },
      ]),
    ),
  );
}

/**
 * Builds a case where every pairing of two courses' sections conflicts.
 *
 * @param spec - The case identity and how many sections each course has.
 * @returns The case, expecting the first 20 pairings and the count of the rest.
 */
function allConflictCase(spec: {
  readonly id: string;
  readonly title: string;
  readonly aCount: number;
  readonly bCount: number;
  readonly rationale: string;
}): GoldenScheduleCase {
  const courseA = sectionsOf(math101.id, 3601, spec.aCount);
  const courseB = sectionsOf(math102.id, 3611, spec.bCount);
  const items = pairConflicts(courseA, courseB);
  const [first, ...rest] = items.slice(0, 20);
  if (first === undefined) throw new Error('A conflict-set case needs at least one pairing.');
  return scheduleCase({
    id: spec.id,
    family: FAMILY,
    title: spec.title,
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [...courseA, ...courseB],
    }),
    expected: {
      outcome: ScheduleOutcome.NoFeasiblePlan,
      searchComplete: true,
      options: [],
      conflictSet: { items: [first, ...rest], omittedCount: items.length - 20 },
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a plan with a meeting conflict is never offered',
      },
    ],
    rationale: spec.rationale,
    citations: CITATIONS,
  });
}

/** Conflict-set cap cases. */
export const SOLVER_CONFLICT_SET_CAP_CASES: readonly GoldenScheduleCase[] = [
  allConflictCase({
    id: 'GC-SOLVE-011',
    title: 'Twenty-five conflicting pairs show twenty and count five as omitted',
    aCount: 5,
    bCount: 5,
    rationale:
      'Five sections of each course, all at MWF 09:00, give 5 × 5 = 25 distinct meeting conflicts, each a pair of sections. The set shows the first 20 in section-ID order, which are course A’s first four sections against all five of course B’s, and counts the other 5 (course A’s fifth section against each) as omitted.',
  }),
  allConflictCase({
    id: 'GC-SOLVE-012',
    title: 'Exactly twenty conflicting pairs show all twenty and omit none',
    aCount: 4,
    bCount: 5,
    rationale:
      'Four sections against five, all at MWF 09:00, give exactly 20 distinct conflicts. That is the cap, not past it, so all 20 are shown and omittedCount is 0.',
  }),
  allConflictCase({
    id: 'GC-SOLVE-013',
    title: 'Twenty-one conflicting pairs show twenty and omit exactly one',
    aCount: 3,
    bCount: 7,
    rationale:
      'Three sections against seven, all at MWF 09:00, give 21 distinct conflicts, one past the cap. The first 20 are shown (course A’s first two sections against all seven, then its third against the first six) and the last pair, course A’s third section with course B’s seventh, is the one omitted.',
  }),
  (() => {
    const courseA = Array.from({ length: 5 }, (_, index) =>
      scheduleSection(math101.id, 3621 + index, {
        meeting: { weekdays: MWF, startTime: null, endTime: null },
      }),
    );
    const courseB = sectionsOf(math102.id, 3631, 5);
    const options = [
      [courseA[0], courseB[0]],
      [courseA[0], courseB[1]],
      [courseA[0], courseB[2]],
    ] as const;
    return scheduleCase({
      id: 'GC-SOLVE-014',
      family: FAMILY,
      title: 'Twenty-five pairs that might conflict are options, never a conflict set',
      requirementIds: REQUIREMENTS,
      inputs: scheduleInputs({
        requestedCourseIds: [math101.id, math102.id],
        sections: [...courseA, ...courseB],
      }),
      expected: {
        outcome: ScheduleOutcome.OptionsFound,
        searchComplete: true,
        options: options.map(([a, b]) => {
          if (a === undefined || b === undefined) throw new Error('Sections are missing.');
          return {
            sectionIds: sectionIdsOf(a, b),
            scheduleFeasibility: scheduleCheck(CheckState.Unknown, [
              { reasonCode: ReasonCode.MeetingTimeUnknown, sectionIds: sectionIdsOf(a, b) },
            ]),
          };
        }),
        conflictSet: null,
        unresolved: [],
      },
      prohibitedClaims: [
        {
          state: CheckState.Pass,
          claim: 'a time to be announced is never confirmed conflict-free',
        },
        {
          outcome: ScheduleOutcome.NoFeasiblePlan,
          claim: 'a pair with a time to be announced can’t prove that no plan exists',
        },
      ],
      rationale:
        'Course A’s sections meet MWF with times to be announced and course B’s meet MWF 09:00–09:50, so all 25 pairs share a possible date and are UNKNOWN, never FAIL (ADR-0010 Amendment 1). No candidate breaks a hard rule, so there is no conflict set to cap. The best 3 options rank UNKNOWN equally, so the section-ID tie-break orders them.',
      citations: ['ADR-0010 §4 and §5', 'ADR-0010 Amendment 1 (ruling GR-02)'],
    });
  })(),
];
