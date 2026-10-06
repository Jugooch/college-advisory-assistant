/**
 * @file Golden scheduling cases: what a linked lab adds to a bundle's credit load (#219, AC06). GC-LINK-005 and GC-LINK-006.
 * @module @caa/test-kit/golden/cases/linked-section-credits
 * @requirement FR-07
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import { CheckKind, CheckState, ReasonCode, ScheduleOutcome, Weekday } from '@caa/domain';

import { buildCourse } from '../../builders/course.builder';
import {
  buildLinkedSectionComponent,
  buildLinkedSectionGroup,
} from '../../builders/linked-section-group.builder';
import { SYNTHETIC_COURSES } from '../../fixtures/synthetic-courses';
import type { ExpectedCheckInput } from '../golden-expectation.schema';
import { GoldenScheduleFamily } from '../golden-rule-family';
import type { GoldenScheduleCase } from '../golden-schedule-case.schema';
import {
  expectNoPlan,
  SCHEDULE_PASS,
  scheduleCase,
  scheduleInputs,
  scheduleSection,
  sectionIdsOf,
} from '../golden-schedule-factories';

const { math102, phys201Lab } = SYNTHETIC_COURSES;
const FAMILY = GoldenScheduleFamily.LinkedSection;
const REQUIREMENTS = ['FR-07', 'FR-18', 'AC06', 'T05'];
const TUESDAY = [Weekday.Tuesday];

/**
 * Builds a CREDIT_LOAD check as the schedule cases state it.
 *
 * @param load - The state, the reason (`null` for PASS), the load, and the term maximum, in
 *   hundredths of a credit.
 * @returns The expected check.
 */
function loadCheck(load: {
  readonly state: CheckState;
  readonly reasonCode: ReasonCode | null;
  readonly total: number;
  readonly max: number;
}): ExpectedCheckInput {
  const { state, reasonCode, total, max } = load;
  return {
    kind: CheckKind.CreditLoad,
    state,
    reasonCode,
    evidence: {
      creditLoad: {
        totalCreditsHundredths: total,
        minCreditsHundredths: 100,
        maxCreditsHundredths: max,
      },
    },
  };
}

/** DEMO-MATH 102 lecture MWF 09:00–09:50, with a 1.00-credit lab included in its credits. */
const MATH_LECTURE = scheduleSection(math102.id, 3141);
const INCLUDED_LAB_COURSE = buildCourse(
  { label: 'DEMO-MATH 102L', creditsHundredths: 100, creditsIncludedInCourseId: math102.id },
  3140,
);
const INCLUDED_LAB = scheduleSection(INCLUDED_LAB_COURSE.id, 3142, {
  meeting: { weekdays: TUESDAY, startTime: '13:00', endTime: '13:50' },
  section: { sectionCode: 'L01' },
});
/** The same lecture with a separately credited lab (DEMO-PHYS 201L, 1.00 credit). */
const COUNTED_LAB = scheduleSection(phys201Lab.id, 3143, {
  meeting: { weekdays: TUESDAY, startTime: '13:00', endTime: '13:50' },
  section: { sectionCode: 'L01' },
});

/** Linked-section cases (AC06). */
export const LINKED_SECTION_CREDIT_CASES: readonly GoldenScheduleCase[] = [
  scheduleCase({
    id: 'GC-LINK-005',
    family: FAMILY,
    title: 'A lab whose credits are included in its lecture adds none, at the load maximum',
    requirementIds: [...REQUIREMENTS, 'FR-06'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      extraCourses: [INCLUDED_LAB_COURSE],
      sections: [MATH_LECTURE, INCLUDED_LAB],
      linkedSectionGroups: [
        buildLinkedSectionGroup(
          {
            primarySectionId: MATH_LECTURE.id,
            components: [
              buildLinkedSectionComponent({
                courseId: INCLUDED_LAB_COURSE.id,
                permittedSectionIds: [INCLUDED_LAB.id],
              }),
            ],
          },
          3105,
        ),
      ],
      creditBounds: { minCreditsHundredths: 100, maxCreditsHundredths: 300 },
    }),
    expected: {
      outcome: ScheduleOutcome.OptionsFound,
      searchComplete: true,
      options: [
        {
          sectionIds: sectionIdsOf(MATH_LECTURE, INCLUDED_LAB),
          scheduleFeasibility: SCHEDULE_PASS,
          creditLoad: loadCheck({ state: CheckState.Pass, reasonCode: null, total: 300, max: 300 }),
        },
      ],
      conflictSet: null,
      unresolved: [],
    },
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.NoFeasiblePlan,
        claim: 'an included lab’s credit is never counted twice',
      },
    ],
    rationale:
      'The 3.00-credit lecture is the whole load, because the lab’s 1.00 credit is included in it. 3.00 equals the term maximum, so the load passes exactly at the limit.',
    citations: ['planning/08 §Constraint formulation', 'ADR-0010 §3', 'ADR-0010 Amendment 4'],
  }),
  scheduleCase({
    id: 'GC-LINK-006',
    family: FAMILY,
    title: 'A separately credited lab adds its own credits and breaks the load maximum',
    requirementIds: [...REQUIREMENTS, 'FR-06'],
    inputs: scheduleInputs({
      requestedCourseIds: [math102.id],
      sections: [MATH_LECTURE, COUNTED_LAB],
      linkedSectionGroups: [
        buildLinkedSectionGroup(
          {
            primarySectionId: MATH_LECTURE.id,
            components: [
              buildLinkedSectionComponent({
                courseId: phys201Lab.id,
                permittedSectionIds: [COUNTED_LAB.id],
              }),
            ],
          },
          3106,
        ),
      ],
      creditBounds: { minCreditsHundredths: 100, maxCreditsHundredths: 300 },
    }),
    expected: expectNoPlan([
      {
        check: loadCheck({
          state: CheckState.Fail,
          reasonCode: ReasonCode.CreditLimitExceeded,
          total: 400,
          max: 300,
        }),
        issues: [],
      },
    ]),
    prohibitedClaims: [
      {
        outcome: ScheduleOutcome.OptionsFound,
        claim: 'a load over the term maximum is never offered',
      },
    ],
    rationale:
      'The lab counts its own 1.00 credit, so the bundle is 4.00 credits against a 3.00 maximum. The credit load is a hard rule and is never relaxed.',
    citations: ['planning/08 §Constraint formulation', 'ADR-0010 §3 and §5'],
  }),
];
