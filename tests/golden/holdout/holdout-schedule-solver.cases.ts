/**
 * @file Frozen holdout scheduling cases for hard and soft constraints and solver outcomes. Kept out
 *   of engine development; see README.md in this folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-schedule-solver
 * @requirement FR-07
 * @requirement FR-08
 * @requirement FR-18
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckState,
  MeetingLocationKind,
  ReasonCode,
  ScheduleOutcome,
  SectionModality,
  Weekday,
} from '@caa/domain';
import {
  buildAllowedCampuses,
  buildAllowedModalities,
  expectNoPlan,
  type GoldenScheduleCase,
  GoldenScheduleFamily,
  HARD_STRENGTH,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_CAMPUSES,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math101, math102, phys201 } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
const TTH = [Weekday.Tuesday, Weekday.Thursday];

/** DEMO-MATH 102 on the south campus only, TTh 09:00–09:50. */
const MATH_SOUTH = scheduleSection(math102.id, 1031, {
  meeting: {
    weekdays: TTH,
    location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
  },
  section: { campusId: south.id },
});
/** DEMO-MATH 102 in person, MWF 08:00–08:50. */
const MATH_MWF_0800 = scheduleSection(math102.id, 1032, {
  meeting: { startTime: '08:00', endTime: '08:50' },
});
/** DEMO-MATH 101, MWF 11:00–11:50. */
const MATH101_MWF_1100 = scheduleSection(math101.id, 1041, {
  meeting: { startTime: '11:00', endTime: '11:50' },
});
/** DEMO-PHYS 201, TTh 13:00–13:50. */
const PHYS_TTH_1300 = scheduleSection(phys201.id, 1042, {
  meeting: { weekdays: TTH, startTime: '13:00', endTime: '13:50' },
});
/** Four interchangeable DEMO-MATH 102 sections, Saturday 09:00–09:50; IDs ascend A to D. */
const SATURDAY = { meeting: { weekdays: [Weekday.Saturday] } };
const MATH_A = scheduleSection(math102.id, 1051, SATURDAY);
const MATH_B = scheduleSection(math102.id, 1052, SATURDAY);
const MATH_C = scheduleSection(math102.id, 1053, SATURDAY);
const MATH_D = scheduleSection(math102.id, 1054, SATURDAY);

/** Holdout scheduling cases about constraints and solver outcomes. */
export const HOLDOUT_SCHEDULE_SOLVER_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GH-HARD-001',
    family: GoldenScheduleFamily.HardVersusSoft,
    title: 'A hard north-only campus rule removes the only south section',
    requirementIds: ['FR-07', 'FR-08', 'FR-18', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_SOUTH],
      constraints: [buildAllowedCampuses({ ...HARD_STRENGTH, campusIds: [north.id] })],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.CampusNotAllowed,
          sectionIds: sectionIdsOf(MATH_SOUTH),
          constraintIndex: 0,
        },
      ]),
    ]),
    prohibitedClaims: [
      { outcome: ScheduleOutcome.OptionsFound, claim: 'a hard constraint is never relaxed' },
    ],
    rationale: 'The only section meets on the south campus, which the hard rule excludes.',
    citations: ['ADR-0010 §3', 'planning/08 §Constraint formulation'],
  }),
  scheduleCase({
    id: 'GH-HARD-002',
    family: GoldenScheduleFamily.HardVersusSoft,
    title: 'A preferred online modality never removes an in-person section',
    requirementIds: ['FR-07', 'FR-08', 'FR-18', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_MWF_0800],
      constraints: [buildAllowedModalities({ modalities: [SectionModality.OnlineSynchronous] })],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(MATH_MWF_0800),
          scheduleFeasibility: SCHEDULE_PASS,
          unmetPreferenceIndexes: [0],
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'a preference is never treated as hard' },
    ],
    rationale:
      'A preference only ranks options, so the in-person section is offered with the preference listed as unmet.',
    citations: ['ADR-0010 §4', 'planning/08 §Constraint formulation'],
  }),
  scheduleCase({
    id: 'GH-SOLVE-001',
    family: GoldenScheduleFamily.SolverOutcome,
    title: 'Three single-bundle courses under a cap of two time out without a candidate',
    requirementIds: ['FR-18', 'NFR-07', 'AC12', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math101.id, math102.id, phys201.id],
      sections: [MATH101_MWF_1100, MATH_MWF_0800, PHYS_TTH_1300],
      workCap: 2,
    }),
    expected: {
      outcome: ScheduleOutcome.SearchTimeout,
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'a capped search is never reported as infeasible',
      },
    ],
    rationale: 'The first candidate needs three attempts, one per course, and the cap allows two.',
    citations: ['planning/13 AC12', 'ADR-0010 §1 and §5'],
  }),
  scheduleCase({
    id: 'GH-SOLVE-002',
    family: GoldenScheduleFamily.SolverOutcome,
    title: 'Four equal sections give the three with the lowest IDs, whatever the listing order',
    requirementIds: ['FR-18', 'NFR-01', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_D, MATH_C, MATH_B, MATH_A],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [MATH_A, MATH_B, MATH_C].map((section) => ({
        sectionIds: sectionIdsOf(section),
        scheduleFeasibility: SCHEDULE_PASS,
      })),
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      { state: CheckState.Pass, sectionIds: sectionIdsOf(MATH_D), claim: 'only the best three' },
    ],
    rationale:
      'All four options are PASS with no preference, so the tie-break orders them by section ID ascending and keeps three.',
    citations: ['ADR-0010 §4'],
  }),
];
