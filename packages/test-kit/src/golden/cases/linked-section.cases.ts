/**
 * @file Golden scheduling cases: a lecture that requires a linked lab is scheduled as one bundle with it, and a bundle whose own sections conflict is never offered (#219, AC06, AC08). GC-LINK-001–004 and GC-LINK-007.
 * @module @caa/test-kit/golden/cases/linked-section
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import {
  CheckState,
  type LinkedSectionGroup,
  MeetingLocationKind,
  ReasonCode,
  ScheduleOutcome,
  Weekday,
} from '@caa/domain';

import { buildCampusTransition } from '../../builders/campus-transition-policy.builder';
import {
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
} from '../../builders/linked-section-group.builder';
import { SYNTHETIC_CAMPUSES } from '../../fixtures/synthetic-campuses';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  expectOneOption,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleCheck,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { phys201, phys201Lab } = SYNTHETIC_COURSES;
const { north, south } = SYNTHETIC_CAMPUSES;
const FAMILY = GoldenScheduleFamily.LinkedSection;
const REQUIREMENTS = ['FR-07', 'FR-18', 'AC06', 'T05'];
const BUNDLES = 'planning/08 §Constraint formulation (required linked sections)';
const TUESDAY = [Weekday.Tuesday];
const THURSDAY = [Weekday.Thursday];
const MONDAY = [Weekday.Monday];

/** DEMO-PHYS 201 lecture 001, MWF 09:00–09:50. */
const LECTURE = scheduleSection(phys201.id, 3101);
/** Lab L01, Tuesdays 13:00–15:50: clear of the lecture. */
const LAB_TUESDAY = scheduleSection(phys201Lab.id, 3102, {
  meeting: { weekdays: TUESDAY, startTime: '13:00', endTime: '15:50' },
  section: { sectionCode: 'L01' },
});
/** Lab L02, Thursdays 13:00–15:50: clear of the lecture. */
const LAB_THURSDAY = scheduleSection(phys201Lab.id, 3103, {
  meeting: { weekdays: THURSDAY, startTime: '13:00', endTime: '15:50' },
  section: { sectionCode: 'L02' },
});
/** Lab L01, Mondays 09:30–12:20: overlaps the lecture by 20 minutes every Monday. */
const LAB_OVERLAPPING = scheduleSection(phys201Lab.id, 3104, {
  meeting: { weekdays: MONDAY, startTime: '09:30', endTime: '12:20' },
  section: { sectionCode: 'L01' },
});
/** Lab L01 on the south campus, Mondays 10:00–12:50: 10 minutes after the lecture ends. */
const LAB_SOUTH = scheduleSection(phys201Lab.id, 3105, {
  meeting: {
    weekdays: MONDAY,
    startTime: '10:00',
    endTime: '12:50',
    location: { kind: MeetingLocationKind.OnCampus, campusId: south.id, room: null },
  },
  section: { sectionCode: 'L01', campusId: south.id },
});

/**
 * Builds the linked group that makes a lecture require one lab from the permitted sections.
 *
 * @param primary - The lecture.
 * @param permitted - The permitted lab sections; empty when the registrar lists none.
 * @param seed - The group seed.
 * @returns The group.
 */
function lectureNeedsLab(
  primary: { readonly id: string },
  permitted: readonly { readonly id: string }[],
  seed: number,
): LinkedSectionGroup {
  return buildLinkedSectionGroup(
    {
      primarySectionId: primary.id,
      components: [
        buildLinkedSectionComponent({
          courseId: phys201Lab.id,
          permittedSectionIds: permitted.map((section) => section.id),
        }),
      ],
    },
    seed,
  );
}

/** Linked-section cases (AC06). */
export const LINKED_SECTION_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-LINK-001',
    family: FAMILY,
    title: 'A lecture with two permitted labs is offered as two bundles',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LAB_TUESDAY, LAB_THURSDAY],
      linkedSectionGroups: [lectureNeedsLab(LECTURE, [LAB_TUESDAY, LAB_THURSDAY], 3101)],
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        { sectionIds: sectionIdsOf(LECTURE, LAB_TUESDAY), scheduleFeasibility: SCHEDULE_PASS },
        { sectionIds: sectionIdsOf(LECTURE, LAB_THURSDAY), scheduleFeasibility: SCHEDULE_PASS },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(LECTURE),
        claim: 'the lecture alone is never an option when it requires a lab',
      },
    ],
    rationale:
      'The lecture needs exactly one permitted lab, so there are two bundles, {001, L01} and {001, L02}. Neither lab meets with the lecture, so both pass, and the tie-break puts the lower section IDs first.',
    citations: [BUNDLES, 'ADR-0010 §2 and §4'],
  }),
  scheduleCase({
    id: 'GC-LINK-002',
    family: FAMILY,
    title: 'A lecture whose only lab overlaps it has no bundle, and the lab is not left out',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LAB_OVERLAPPING],
      linkedSectionGroups: [lectureNeedsLab(LECTURE, [LAB_OVERLAPPING], 3102)],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.MeetingConflict,
          sectionIds: sectionIdsOf(LECTURE, LAB_OVERLAPPING),
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a bundle that leaves the required lab out is never offered (AC06)',
      },
    ],
    rationale:
      'The lecture meets MWF 09:00–09:50 and the only permitted lab meets Mondays from 09:30, so the bundle conflicts. The lab is required, so the course has no bundle.',
    citations: [BUNDLES, 'planning/13 AC06', 'ADR-0010 §3 and §5'],
  }),
  scheduleCase({
    id: 'GC-LINK-003',
    family: FAMILY,
    title: 'A blocked lab leaves the bundle with the lab that fits',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LAB_OVERLAPPING, LAB_THURSDAY],
      linkedSectionGroups: [lectureNeedsLab(LECTURE, [LAB_OVERLAPPING, LAB_THURSDAY], 3103)],
    }),
    expected: expectOneOption(sectionIdsOf(LECTURE, LAB_THURSDAY)),
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(LECTURE, LAB_OVERLAPPING),
        claim: 'a bundle with a meeting conflict is never offered',
      },
    ],
    rationale:
      'The Monday lab overlaps the lecture, so its bundle is blocked. The Thursday lab doesn’t, so one bundle remains.',
    citations: [BUNDLES, 'planning/13 AC06', 'ADR-0010 §3'],
  }),
  scheduleCase({
    id: 'GC-LINK-004',
    family: FAMILY,
    title: 'A lab component with no permitted section needs verification',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE],
      linkedSectionGroups: [lectureNeedsLab(LECTURE, [], 3104)],
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
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a missing required lab is never treated as satisfied',
      },
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'missing data is UNKNOWN, not a verified conflict',
      },
    ],
    rationale:
      'The registrar lists no permitted lab section, which is missing data, so the course has no bundle and the answer is UNKNOWN. The search does not run.',
    citations: [BUNDLES, 'ADR-0010 §5 and §6'],
  }),
  scheduleCase({
    id: 'GC-LINK-007',
    family: FAMILY,
    title: 'A lab on another campus too soon after its lecture blocks the bundle',
    requirementIds: [...REQUIREMENTS, 'AC08'],
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LAB_SOUTH],
      linkedSectionGroups: [lectureNeedsLab(LECTURE, [LAB_SOUTH], 3107)],
      transitions: [buildCampusTransition(north.id, south.id, 15)],
    }),
    expected: expectNoPlan([
      scheduleCheck(CheckState.Fail, [
        {
          reasonCode: ReasonCode.TransitionTimeInsufficient,
          sectionIds: sectionIdsOf(LECTURE, LAB_SOUTH),
          fromCampusId: north.id,
          toCampusId: south.id,
          requiredMinutes: 15,
          availableMinutes: 10,
        },
      ]),
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'travel between a lecture and its lab is never ignored',
      },
    ],
    rationale:
      'The lecture ends at 09:50 on the north campus and the lab starts at 10:00 on the south campus: 10 minutes against the 15 the table requires.',
    citations: [BUNDLES, 'ADR-0010 §8', 'planning/13 AC08'],
  }),
];
