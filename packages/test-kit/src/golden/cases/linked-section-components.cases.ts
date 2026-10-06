/**
 * @file Golden scheduling cases: a lecture with two required linked components, a lab and a
 *   recitation, is one bundle of three sections (#219, AC06). GC-LINK-008.
 * @module @caa/test-kit/golden/cases/linked-section-components
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckState, Weekday } from '@caa/domain';

import {
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
} from '../../builders/linked-section-group.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectOneOption,
  scheduleCase,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math101, phys201, phys201Lab } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.LinkedSection;
const REQUIREMENTS = ['FR-07', 'FR-18', 'AC06', 'T05'];
const BUNDLES = 'planning/08 §Constraint formulation (required linked sections)';

/** DEMO-PHYS 201 lecture 001, MWF 09:00–09:50. */
const LECTURE = scheduleSection(phys201.id, 3151);
/** Lab L01, Tuesdays 13:00–15:50. */
const LAB_TUESDAY = scheduleSection(phys201Lab.id, 3152, {
  meeting: { weekdays: [Weekday.Tuesday], startTime: '13:00', endTime: '15:50' },
  section: { sectionCode: 'L01' },
});
/** Recitation of DEMO-MATH 101, Thursdays 13:00–13:50, for the two-component lecture. */
const RECITATION = scheduleSection(math101.id, 3153, {
  meeting: { weekdays: [Weekday.Thursday], startTime: '13:00', endTime: '13:50' },
  section: { sectionCode: 'R01' },
});

/** The lecture's lab-and-recitation case. */
export const LINKED_SECTION_COMPONENT_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-LINK-008',
    family: FAMILY,
    title: 'A lecture with a lab and a recitation is one bundle of three sections',
    requirementIds: REQUIREMENTS,
    inputs: scheduleInputs({
      requestedCourseIds: [phys201.id],
      sections: [LECTURE, LAB_TUESDAY, RECITATION],
      linkedSectionGroups: [
        buildLinkedSectionGroup(
          {
            primarySectionId: LECTURE.id,
            components: [
              buildLinkedSectionComponent({
                name: 'Lab',
                courseId: phys201Lab.id,
                permittedSectionIds: [LAB_TUESDAY.id],
              }),
              buildLinkedSectionComponent({
                name: 'Recitation',
                courseId: math101.id,
                permittedSectionIds: [RECITATION.id],
              }),
            ],
          },
          3108,
        ),
      ],
    }),
    expected: expectOneOption(sectionIdsOf(LECTURE, LAB_TUESDAY, RECITATION)),
    prohibitedClaims: [
      {
        state: CheckState.Pass,
        sectionIds: sectionIdsOf(LECTURE, LAB_TUESDAY),
        claim: 'a bundle missing a required component is never offered',
      },
    ],
    rationale:
      'A student takes exactly one permitted section of each required component, so the lecture, its lab and its recitation form one bundle, and they don’t overlap.',
    citations: [BUNDLES, 'ADR-0010 §2'],
  }),
];
