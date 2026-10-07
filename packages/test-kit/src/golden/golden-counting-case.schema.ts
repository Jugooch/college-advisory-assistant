/**
 * @file The attempt-counting golden case format: a student's attempts at one course, or at the
 *   courses of one equivalency group, the catalog and policy that decide which attempts count,
 *   and the expected counting resolution (state, reason, and earned credit in hundredths). It is
 *   a kind of its own because the expectation is earned credit, which no check result carries.
 * @module @caa/test-kit/golden/golden-counting-case-schema
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { z } from 'zod';

import {
  AcademicPolicySchema,
  CountingState,
  CountingStateSchema,
  CourseAttemptSchema,
  CourseSchema,
  ReasonCodeSchema,
  TermCalendarSchema,
} from '@caa/domain';

import { GOLDEN_ADJUDICATION_FIELDS } from './golden-case.schema';
import { GoldenRuleFamily } from './golden-rule-family';

/**
 * The expected counting resolution of the one group a case builds. `earnedCreditsHundredths` is
 * `null` exactly when the group is UNDETERMINED or a counted attempt's credit is unknown.
 */
export const ExpectedCountingSchema = z
  .strictObject({
    state: CountingStateSchema,
    /** Why the group is UNDETERMINED; `null` for COUNTED and NONE. */
    reasonCode: ReasonCodeSchema.nullable(),
    earnedCreditsHundredths: z.number().int().nonnegative().nullable(),
  })
  .refine(
    (expected) =>
      (expected.state === CountingState.Undetermined) === (expected.reasonCode !== null),
    {
      message: 'Only an UNDETERMINED group states a reason code',
      path: ['reasonCode'],
    },
  )
  .refine(
    (expected) =>
      expected.state !== CountingState.Undetermined || expected.earnedCreditsHundredths === null,
    { message: 'An UNDETERMINED group earns null', path: ['earnedCreditsHundredths'] },
  )
  .refine(
    (expected) => expected.state !== CountingState.None || expected.earnedCreditsHundredths === 0,
    {
      message: 'A NONE group earns 0',
      path: ['earnedCreditsHundredths'],
    },
  )
  .readonly();

/** A validated expected counting resolution. */
export type ExpectedCounting = z.infer<typeof ExpectedCountingSchema>;

/** A claim the engine must never make: a counting state, or an earned credit total. */
export const CountingProhibitedClaimSchema = z
  .strictObject({
    state: CountingStateSchema.optional(),
    earnedCreditsHundredths: z.number().int().nonnegative().optional(),
    claim: z.string().min(1),
  })
  .refine(
    (claim) => (claim.state === undefined) !== (claim.earnedCreditsHundredths === undefined),
    {
      message: 'A prohibited claim names a state or an earned credit, not both',
    },
  )
  .readonly();

/** One prohibited counting claim. */
export type CountingProhibitedClaim = z.infer<typeof CountingProhibitedClaimSchema>;

/**
 * Returns whether a resolution makes a prohibited claim.
 *
 * @param resolution - The resolution, expected or returned.
 * @param claim - The prohibited claim.
 * @returns `true` when the resolution has the prohibited state or earned credit.
 */
export function countingMakesClaim(
  resolution: Pick<ExpectedCounting, 'state' | 'earnedCreditsHundredths'>,
  claim: CountingProhibitedClaim,
): boolean {
  return claim.state === undefined
    ? resolution.earnedCreditsHundredths === claim.earnedCreditsHundredths
    : resolution.state === claim.state;
}

/** Schema for one attempt-counting golden case. */
export const GoldenCountingCaseSchema = z
  .strictObject({
    ...GOLDEN_ADJUDICATION_FIELDS,
    family: z.literal(GoldenRuleFamily.Repeat),
    inputs: z
      .strictObject({
        academicPolicy: AcademicPolicySchema,
        termCalendar: TermCalendarSchema,
        courses: z.array(CourseSchema).min(1).readonly(),
        attempts: z.array(CourseAttemptSchema).min(1).readonly(),
      })
      .readonly(),
    expected: ExpectedCountingSchema,
    /** Other complete results an adjudicator accepted as equally correct; usually none. */
    allowedAlternatives: z.array(ExpectedCountingSchema).readonly(),
    prohibitedClaims: z.array(CountingProhibitedClaimSchema).min(1).readonly(),
  })
  // SAFETY: an oracle that expects a result it also prohibits can never be met.
  .refine(
    (golden) =>
      [golden.expected, ...golden.allowedAlternatives].every((expected) =>
        golden.prohibitedClaims.every((claim) => !countingMakesClaim(expected, claim)),
      ),
    { message: 'An accepted result must not make a prohibited claim', path: ['expected'] },
  )
  // SAFETY: every attempted course is in the catalog, so a case never tests the missing-catalog
  // path by accident.
  .refine(
    (golden) =>
      golden.inputs.attempts.every((attempt) =>
        golden.inputs.courses.some((course) => course.id === attempt.courseId),
      ),
    { message: 'Every attempted course must be in the catalog', path: ['inputs', 'courses'] },
  )
  .readonly();

/** A validated attempt-counting golden case. */
export type GoldenCountingCase = z.infer<typeof GoldenCountingCaseSchema>;

/** Raw input accepted by {@link defineGoldenCountingCase}. */
export type GoldenCountingCaseInput = z.input<typeof GoldenCountingCaseSchema>;

/**
 * Validates one attempt-counting case.
 *
 * @param input - The case as written by the QA engineer.
 * @returns The validated case.
 * @throws {z.ZodError} When a field is invalid or an accepted result makes a prohibited claim.
 */
export function defineGoldenCountingCase(input: GoldenCountingCaseInput): GoldenCountingCase {
  return GoldenCountingCaseSchema.parse(input);
}
