/**
 * @file Frozen holdout scheduling cases added in v0.5: a second unknown-time case, a dropped
 *   linked section beside a timeout, an included lab at the load limit, and a hard block one
 *   minute past its boundary. Kept out of engine development; see README.md in this folder
 *   before reading further.
 * @module @caa/tests/golden/holdout/holdout-schedule-additions
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckKind, CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';
import {
  buildCourse,
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  buildUnavailableTime,
  expectNoPlan,
  expectOneOption,
  type GoldenScheduleCase,
  GoldenScheduleFamily,
  HARD_STRENGTH,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math101, math102, phys201 } = SYNTHETIC_COURSES;
const TTH = [Weekday.Tuesday, Weekday.Thursday];

/** DEMO-MATH 102: Tuesdays and Thursdays, times to be announced. */
const TBA_TIMES_TTH = scheduleSection(math102.id, 1201, {
  meeting: { weekdays: TTH, startTime: null, endTime: null },
});
/** DEMO-MATH 101, MWF 14:00–14:50: no Tuesday or Thursday. */
const MATH101_MWF_1400 = scheduleSection(math101.id, 1202, {
  meeting: { startTime: '14:00', endTime: '14:50' },
});
/** DEMO-PHYS 201 lecture that needs a lab, with none permitted. */
const LECTURE_NO_LAB = scheduleSection(phys201.id, 1211);
/** DEMO-PHYS 201 lecture with no linked component, TTh 15:00–15:50. */
const LECTURE_PLAIN = scheduleSection(phys201.id, 1212, {
  meeting: { weekdays: TTH, startTime: '15:00', endTime: '15:50' },
});
/** DEMO-MATH 102, MWF 08:00–08:50. */
const MATH102_0800 = scheduleSection(math102.id, 1213, {
  meeting: { startTime: '08:00', endTime: '08:50' },
});
const INCLUDED_LAB_COURSE = buildCourse(
  { label: 'DEMO-PHYS 201X', creditsHundredths: 100, creditsIncludedInCourseId: phys201.id },
  1220,
);
/** DEMO-PHYS 201 lecture MWF 13:00–13:50 with its included lab Fridays 14:00–14:50. */
const LECTURE_WITH_LAB = scheduleSection(phys201.id, 1221, {
  meeting: { startTime: '13:00', endTime: '13:50' },
});
const INCLUDED_LAB = scheduleSection(INCLUDED_LAB_COURSE.id, 1222, {
  meeting: { weekdays: [Weekday.Friday], startTime: '14:00', endTime: '14:50' },
});
/** DEMO-MATH 102, Tuesdays 13:59–14:49: starts one minute inside a 13:00–14:00 hard block. */
const ONE_MINUTE_INSIDE = scheduleSection(math102.id, 1231, {
  meeting: { weekdays: [Weekday.Tuesday], startTime: '13:59', endTime: '14:49' },
});

/** Holdout scheduling cases added in v0.5. */
export const HOLDOUT_SCHEDULE_ADDITION_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GH-TBA-002',
    family: GoldenScheduleFamily.MeetingTimeUnknown,
    title: 'Known weekdays with unknown times never meet a timed section on other weekdays',
    requirementIds: ['FR-07', 'FR-18', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id],
      sections: [TBA_TIMES_TTH, MATH101_MWF_1400],
    }),
    expected: expectOneOption(sectionIdsOf(MATH101_MWF_1400, TBA_TIMES_TTH)),
    prohibitedClaims: [
      {
        state: CheckState.Unknown,
        claim: 'with no possible shared date there is nothing to verify (GR-02)',
      },
    ],
    rationale:
      'The TBA section can only meet on Tuesdays and Thursdays, and the other meets MWF, so they share no possible date. The pair passes.',
    citations: ['ADR-0010 Amendment 1 (ruling GR-02)', 'planning/08 §Schedule model'],
  }),
  scheduleCase({
    id: 'GH-SOLVE-003',
    family: GoldenScheduleFamily.SolverOutcome,
    title: 'A capped search with no candidate still lists the section dropped for a missing lab',
    requirementIds: ['FR-18', 'NFR-07', 'AC12', 'AC06', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id, phys201.id],
      sections: [MATH102_0800, LECTURE_NO_LAB, LECTURE_PLAIN],
      linkedSectionGroups: [
        buildLinkedSectionGroup(
          {
            primarySectionId: LECTURE_NO_LAB.id,
            components: [
              buildLinkedSectionComponent({
                courseId: SYNTHETIC_COURSES.phys201Lab.id,
                permittedSectionIds: [],
              }),
            ],
          },
          1211,
        ),
      ],
      workCap: 1,
    }),
    expected: {
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [
        scheduleCheck(CheckState.Unknown, [
          {
            reasonCode: ReasonCode.LinkedSectionUnavailable,
            sectionIds: sectionIdsOf(LECTURE_NO_LAB),
            courseId: SYNTHETIC_COURSES.phys201Lab.id,
          },
        ]),
      ],
    },
    prohibitedClaims: [
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'a capped search is never infeasible' },
    ],
    rationale:
      'Each course keeps one bundle, so a candidate needs two attempts and the cap is one: a timeout. The lecture dropped for its missing lab is still shown as UNKNOWN, never hidden.',
    citations: ['ADR-0010 §1 and §5', 'ADR-0010 Amendment 5', 'planning/13 AC12'],
  }),
  scheduleCase({
    id: 'GH-LINK-004',
    family: GoldenScheduleFamily.LinkedSection,
    title: 'An included lab leaves a 4.00-credit lecture at exactly the 4.00 maximum',
    requirementIds: ['FR-07', 'FR-18', 'FR-06', 'AC06', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      extraCourses: [INCLUDED_LAB_COURSE],
      sections: [LECTURE_WITH_LAB, INCLUDED_LAB],
      linkedSectionGroups: [
        buildLinkedSectionGroup(
          {
            primarySectionId: LECTURE_WITH_LAB.id,
            components: [
              buildLinkedSectionComponent({
                courseId: INCLUDED_LAB_COURSE.id,
                permittedSectionIds: [INCLUDED_LAB.id],
              }),
            ],
          },
          1221,
        ),
      ],
      creditBounds: { minCreditsHundredths: 100, maxCreditsHundredths: 400 },
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(LECTURE_WITH_LAB, INCLUDED_LAB),
          scheduleFeasibility: SCHEDULE_PASS,
          creditLoad: {
            kind: CheckKind.CreditLoad,
            state: CheckState.Pass,
            reasonCode: null,
            evidence: {
              creditLoad: {
                totalCreditsHundredths: 400,
                minCreditsHundredths: 100,
                maxCreditsHundredths: 400,
              },
            },
          },
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'an included lab adds no credits' },
    ],
    rationale:
      'The lab’s credit is included in the lecture’s, so the load is the lecture’s 4.00, which equals the maximum.',
    citations: ['planning/08 §Constraint formulation', 'ADR-0010 §3'],
  }),
  scheduleCase({
    id: 'GH-HARD-003',
    family: GoldenScheduleFamily.HardVersusSoft,
    title: 'A meeting starting one minute inside a hard unavailable block is removed',
    requirementIds: ['FR-07', 'FR-08', 'FR-18', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [ONE_MINUTE_INSIDE],
      constraints: [
        buildUnavailableTime({
          ...HARD_STRENGTH,
          weekdays: [Weekday.Tuesday],
          startTime: '13:00',
          endTime: '14:00',
        }),
      ],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.UnavailableTimeConflict,
          sectionIds: sectionIdsOf(ONE_MINUTE_INSIDE),
          constraintIndex: 0,
        },
      ]),
    ]),
    prohibitedClaims: [
      { outcome: ScheduleOutcome.OptionsFound, claim: 'a hard block is never relaxed' },
    ],
    rationale:
      'The meeting [13:59, 14:49) shares the minute 13:59 with the block [13:00, 14:00), so it conflicts.',
    citations: ['ADR-0010 §3', 'planning/08 §Constraint formulation'],
  }),
];
