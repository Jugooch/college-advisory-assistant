/**
 * @file Frozen holdout scheduling cases for linked sections. Kept out of engine development; see
 *   README.md in this folder before reading further.
 * @module @caa/tests/golden/holdout/holdout-schedule-links
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckState,
  type LinkedSectionGroup,
  ReasonCode,
  ScheduleOutcome,
  Weekday,
} from '@caa/domain';
import {
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
  expectNoPlan,
  expectOneOption,
  type GoldenScheduleCase,
  GoldenScheduleFamily,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

const { math102, phys201, phys201Lab } = SYNTHETIC_COURSES;

/** DEMO-PHYS 201 lecture, TTh 11:00–12:15. */
const LECTURE = scheduleSection(phys201.id, 1021, {
  meeting: { weekdays: [Weekday.Tuesday, Weekday.Thursday], startTime: '11:00', endTime: '12:15' },
});
/** Lab L21, Th 12:00–14:50: overlaps the lecture by 15 minutes every Thursday. */
const LAB_OVERLAPPING = scheduleSection(phys201Lab.id, 1022, {
  meeting: { weekdays: [Weekday.Thursday], startTime: '12:00', endTime: '14:50' },
  section: { sectionCode: 'L21' },
});
/** A second DEMO-PHYS 201 lecture, MWF 14:00–14:50, with no linked component. */
const LECTURE_UNLINKED = scheduleSection(phys201.id, 1023, {
  meeting: { startTime: '14:00', endTime: '14:50' },
});
/** DEMO-MATH 102, MWF 08:00–08:50. */
const MATH_MWF_0800 = scheduleSection(math102.id, 1024, {
  meeting: { startTime: '08:00', endTime: '08:50' },
});

/**
 * Links {@link LECTURE} to a Lab component permitting the given sections.
 *
 * @param permittedSectionIds - The lab sections the lecture may be taken with.
 * @returns The one linked-section group.
 */
function lectureNeedsLab(permittedSectionIds: readonly string[]): readonly LinkedSectionGroup[] {
  return [
    buildLinkedSectionGroup(
      {
        primarySectionId: LECTURE.id,
        components: [buildLinkedSectionComponent({ courseId: phys201Lab.id, permittedSectionIds })],
      },
      1021,
    ),
  ];
}

/** Holdout scheduling cases about linked sections. */
export const HOLDOUT_SCHEDULE_LINK_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GH-LINK-001',
    family: GoldenScheduleFamily.LinkedSection,
    title: 'A lecture whose only lab overlaps it on Thursdays has no bundle',
    requirementIds: ['FR-07', 'FR-18', 'AC06', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LAB_OVERLAPPING],
      linkedSectionGroups: lectureNeedsLab([LAB_OVERLAPPING.id]),
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LECTURE, LAB_OVERLAPPING),
          sharedDates: { firstDate: '2027-01-14', lastDate: '2027-05-06', weekdays: ['THURSDAY'] },
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'never the lecture without its required lab',
      },
    ],
    rationale:
      'The only bundle is the lecture with lab L21, which overlap 12:00–12:15 every Thursday. Every bundle of the course failed, so no plan exists.',
    citations: ['planning/13 AC06', 'ADR-0010 §5 (precedence before the search)'],
  }),
  scheduleCase({
    id: 'GH-LINK-002',
    family: GoldenScheduleFamily.LinkedSection,
    title: 'A lecture with no permitted lab is dropped while an unlinked lecture remains',
    requirementIds: ['FR-07', 'FR-18', 'AC06', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LECTURE_UNLINKED],
      linkedSectionGroups: lectureNeedsLab([]),
    }),
    expected: expectOneOption(sectionIdsOf(LECTURE_UNLINKED)),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NeedsVerification,
        claim: 'the course still has a bundle, so the search runs',
      },
    ],
    rationale:
      'The linked lecture has no permitted lab, so it forms no bundle. The course keeps the unlinked lecture, which needs no lab.',
    citations: ['ADR-0010 §5', 'planning/08 §Schedule model'],
  }),
  scheduleCase({
    id: 'GH-LINK-003',
    family: GoldenScheduleFamily.LinkedSection,
    title: 'A requested course whose only lecture has no permitted lab needs verification',
    requirementIds: ['FR-07', 'FR-18', 'AC06', 'T05'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id, phys201.id],
      sections: [MATH_MWF_0800, LECTURE],
      linkedSectionGroups: lectureNeedsLab([]),
    }),
    expected: {
      outcome: ScheduleOutcome.NeedsVerification,
      searchComplete: false,
      options: [],
      conflictSet: null,
      unresolved: [
        scheduleCheck(CheckState.Unknown, [
          {
            reasonCode: ReasonCode.LinkedSectionUnavailable,
            sectionIds: sectionIdsOf(LECTURE),
            courseId: phys201Lab.id,
          },
        ]),
      ],
    },
    prohibitedClaims: [
      { outcome: ScheduleOutcome.OptionsFound, claim: 'never a schedule without the required lab' },
      { outcome: ScheduleOutcome.NoFeasiblePlan, claim: 'missing data is not a proven conflict' },
    ],
    rationale:
      'DEMO-PHYS 201 has no bundle, and missing lab data is the reason, so the search doesn’t run.',
    citations: ['ADR-0010 §5', 'planning/08 §Authority and result semantics'],
  }),
];
