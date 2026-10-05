/**
 * @file The scheduling golden case format: the complete solver inputs (requested courses, a
 *   section snapshot with its linked groups, the campus transition table, the constraints, the
 *   credit policy, and the work cap), the expected outcome, prohibited claims, and the
 *   adjudication record. It is a kind of its own because its expectation is a whole response
 *   (ADR-0010 §5), not a list of checks of one kind.
 * @module @caa/test-kit/golden/golden-schedule-case-schema
 * @requirement FR-07
 * @requirement FR-18
 * @requirement NFR-01
 * @requirement NFR-07
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { z } from 'zod';

import {
  AcademicPolicySchema,
  CampusTransitionPolicySchema,
  CheckStateSchema,
  CourseIdSchema,
  CourseSchema,
  ScheduleConstraintSetSchema,
  ScheduleOutcomeSchema,
  SectionIdSchema,
  SectionSnapshotSchema,
} from '@caa/domain';

import { GOLDEN_ADJUDICATION_FIELDS } from './golden-case.schema';
import {
  type ExpectedSchedule,
  ExpectedScheduleSchema,
  isAscendingIds,
} from './golden-schedule-expectation.schema';

/** Most work units a solve may use (ADR-0010 §1). */
export const GOLDEN_MAX_WORK_CAP = 3_000_000;

/** Most courses one request names (ADR-0010 §2). */
const MAX_REQUESTED_COURSES = 8;

/**
 * Scheduling family of a golden case (#226), counted apart from the check families because the
 * scheduling cases run through the solver, not one check.
 *
 * - `MEETING_OVERLAP`: two timed meetings by weekday, time, excluded dates, and DST.
 * - `TERM_DATE_OVERLAP`: meetings in half-terms or other partial date ranges (AC07).
 * - `TRANSITION_TIME`: travel between campuses against the transition table (AC08).
 * - `LINKED_SECTION`: lectures with required linked components, and their credits (AC06).
 * - `MEETING_TIME_UNKNOWN`: TBA times, days, or locations, which are never PASS.
 * - `HARD_VERSUS_SOFT`: hard constraints never relaxed, preferences ranked.
 * - `SOLVER_OUTCOME`: complete, incomplete, infeasible, timeout (AC12), and the tie-break.
 */
export const GoldenScheduleFamily = {
  MeetingOverlap: 'MEETING_OVERLAP',
  TermDateOverlap: 'TERM_DATE_OVERLAP',
  TransitionTime: 'TRANSITION_TIME',
  LinkedSection: 'LINKED_SECTION',
  MeetingTimeUnknown: 'MEETING_TIME_UNKNOWN',
  HardVersusSoft: 'HARD_VERSUS_SOFT',
  SolverOutcome: 'SOLVER_OUTCOME',
} as const;

/** Union of every {@link GoldenScheduleFamily} value. */
export type GoldenScheduleFamily = (typeof GoldenScheduleFamily)[keyof typeof GoldenScheduleFamily];

/** Runtime schema for {@link GoldenScheduleFamily}. */
export const GoldenScheduleFamilySchema = z.enum(GoldenScheduleFamily);

/**
 * Returns whether values are distinct.
 *
 * @param values - The values.
 * @returns `true` when no value repeats.
 */
function isDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Everything the solver reads for one request, stated independently of the engine's own input
 * types, so the oracle doesn't import the code it checks.
 */
export const GoldenScheduleInputsSchema = z
  .strictObject({
    /** Catalog entries of the requested courses and of every linked component's course. */
    courses: z.array(CourseSchema).min(1).readonly(),
    /** The required courses, in request order (ADR-0010 §2). */
    requestedCourseIds: z.array(CourseIdSchema).min(1).max(MAX_REQUESTED_COURSES).readonly(),
    /** Chosen credits of variable-credit requested courses. */
    creditSelections: z
      .array(
        z
          .strictObject({
            courseId: CourseIdSchema,
            selectedCreditsHundredths: z.number().int().nonnegative(),
          })
          .readonly(),
      )
      .readonly(),
    sectionSnapshot: SectionSnapshotSchema,
    /** The tenant's campus transition table, or `null` when it has none. */
    transitionPolicy: CampusTransitionPolicySchema.nullable(),
    constraints: ScheduleConstraintSetSchema,
    /** Supplies the term credit bounds. */
    academicPolicy: AcademicPolicySchema,
    workCap: z.number().int().min(1).max(GOLDEN_MAX_WORK_CAP),
  })
  .refine(
    ({ courses, requestedCourseIds }) =>
      isDistinct(requestedCourseIds) &&
      requestedCourseIds.every((id) => courses.some((course) => course.id === id)),
    { message: 'Requested courses must be distinct and in courses', path: ['requestedCourseIds'] },
  )
  .refine(
    ({ creditSelections, requestedCourseIds }) =>
      isDistinct(creditSelections.map((selection) => selection.courseId)) &&
      creditSelections.every((selection) => requestedCourseIds.includes(selection.courseId)),
    {
      message: 'Credit selections must name distinct requested courses',
      path: ['creditSelections'],
    },
  )
  .refine(
    ({ sectionSnapshot, transitionPolicy, academicPolicy }) =>
      academicPolicy.tenantId === sectionSnapshot.tenantId &&
      (transitionPolicy === null || transitionPolicy.tenantId === sectionSnapshot.tenantId),
    { message: 'Every source must belong to the snapshot tenant', path: ['sectionSnapshot'] },
  )
  .readonly();

/** Raw input accepted for {@link GoldenScheduleInputsSchema}. */
export type GoldenScheduleInputsInput = z.input<typeof GoldenScheduleInputsSchema>;

/**
 * A claim the engine must never make: an outcome, or a schedule check state, for every option
 * or for the option with `sectionIds`.
 */
export const ScheduleProhibitedClaimSchema = z
  .strictObject({
    outcome: ScheduleOutcomeSchema.optional(),
    state: CheckStateSchema.optional(),
    /** The option the state is prohibited for, ascending; every option when omitted. */
    sectionIds: z.array(SectionIdSchema).min(1).readonly().optional(),
    claim: z.string().min(1),
  })
  .refine((claim) => (claim.outcome === undefined) !== (claim.state === undefined), {
    message: 'A prohibited claim names an outcome or a state, not both',
  })
  .refine((claim) => claim.sectionIds === undefined || claim.state !== undefined, {
    message: 'Only a prohibited state names an option',
    path: ['sectionIds'],
  })
  // NOTE: `makesClaim` compares section sets as written, so they must be written one way.
  .refine((claim) => isAscendingIds(claim.sectionIds ?? []), {
    message: 'A prohibited claim names its sections distinct and ascending',
    path: ['sectionIds'],
  })
  .readonly();

/** One prohibited scheduling claim. */
export type ScheduleProhibitedClaim = z.infer<typeof ScheduleProhibitedClaimSchema>;

/** Raw input accepted for {@link ScheduleProhibitedClaimSchema}. */
export type ScheduleProhibitedClaimInput = z.input<typeof ScheduleProhibitedClaimSchema>;

/**
 * Returns whether an accepted result makes a prohibited claim.
 *
 * @param expected - One accepted result.
 * @param claim - One prohibited claim.
 * @returns `true` when the result makes the claim.
 */
export function makesClaim(expected: ExpectedSchedule, claim: ScheduleProhibitedClaim): boolean {
  if (claim.outcome !== undefined) {
    return expected.outcome === claim.outcome;
  }
  const target = claim.sectionIds?.join(',');
  return expected.options.some(
    (option) =>
      (target === undefined || option.sectionIds.join(',') === target) &&
      option.scheduleFeasibility.check.state === claim.state,
  );
}

/** Schema for one scheduling golden case. */
export const GoldenScheduleCaseSchema = z
  .strictObject({
    ...GOLDEN_ADJUDICATION_FIELDS,
    family: GoldenScheduleFamilySchema,
    inputs: GoldenScheduleInputsSchema,
    expected: ExpectedScheduleSchema,
    /** Other complete results an adjudicator accepted as equally correct; usually none. */
    allowedAlternatives: z.array(ExpectedScheduleSchema).readonly(),
    prohibitedClaims: z.array(ScheduleProhibitedClaimSchema).min(1).readonly(),
  })
  // SAFETY: an oracle that expects a result it also prohibits can never be met.
  .refine(
    (golden) =>
      [golden.expected, ...golden.allowedAlternatives].every((expected) =>
        golden.prohibitedClaims.every((claim) => !makesClaim(expected, claim)),
      ),
    { message: 'An accepted result must not make a prohibited claim', path: ['expected'] },
  )
  // SAFETY: an expected option can only be made of sections the snapshot publishes.
  .refine(
    (golden) => {
      const published = new Set<string>(golden.inputs.sectionSnapshot.sections.map((s) => s.id));
      return [golden.expected, ...golden.allowedAlternatives].every((expected) =>
        expected.options.every((option) => option.sectionIds.every((id) => published.has(id))),
      );
    },
    { message: 'Expected options must use published sections', path: ['expected'] },
  )
  // SAFETY: every requested course is required, so each option schedules exactly one primary
  // section of each, and no other primary section (ADR-0010 §2 and §3). An option that dropped
  // a course would drop that course's checks too.
  .refine(
    (golden) => {
      const courseOf = new Map<string, string>(
        golden.inputs.sectionSnapshot.sections.map((s) => [s.id, s.courseId]),
      );
      const requested = new Set<string>(golden.inputs.requestedCourseIds);
      return [golden.expected, ...golden.allowedAlternatives].every((expected) =>
        expected.options.every((option) => {
          // NOTE: an unpublished section is the published-sections rule's finding, not this one.
          if (option.sectionIds.some((id) => !courseOf.has(id))) {
            return true;
          }
          const primaries = option.sectionIds
            .map((id) => courseOf.get(id) ?? '')
            .filter((courseId) => requested.has(courseId));
          return primaries.length === requested.size && new Set(primaries).size === requested.size;
        }),
      );
    },
    { message: 'Every option must schedule each requested course once', path: ['expected'] },
  )
  .readonly();

/** A validated scheduling golden case. */
export type GoldenScheduleCase = z.infer<typeof GoldenScheduleCaseSchema>;

/** Raw input accepted by {@link defineGoldenScheduleCase}. */
export type GoldenScheduleCaseInput = z.input<typeof GoldenScheduleCaseSchema>;

/**
 * Validates one scheduling golden case.
 *
 * @param input - The case as written by the QA engineer.
 * @returns The validated case.
 * @throws {z.ZodError} When a field is invalid, the expectation doesn't fit its outcome, or it
 *   makes a claim the case prohibits.
 */
export function defineGoldenScheduleCase(input: GoldenScheduleCaseInput): GoldenScheduleCase {
  return GoldenScheduleCaseSchema.parse(input);
}
