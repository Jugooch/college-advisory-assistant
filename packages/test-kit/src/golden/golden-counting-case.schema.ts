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
  type ReasonCode,
  ReasonCodeSchema,
  type RepeatPolicy,
  TermCalendarSchema,
} from '@caa/domain';

import { buildAcademicPolicy } from '../builders/academic-policy.builder';
import { buildTermCalendar } from '../builders/term.builder';
import { GOLDEN_ADJUDICATION_FIELDS } from './golden-case.schema';
import { GoldenRuleFamily } from './golden-rule-family';

/** Source versions behind every attempt-counting case. */
export const COUNTING_SOURCES: readonly string[] = [
  'ruleset demo-2026.1',
  'catalog SYNTHETIC_COURSES v0 and SYNTHETIC_REPEATABLE_COURSES',
  'terms SYNTHETIC_TERMS v0',
];

/**
 * The terms of the counting cases: the four synthetic terms, then 2027FA and 2028SP, so five
 * consecutive terms exist. `2029SP` is deliberately absent.
 */
export const COUNTING_TERM_CALENDAR = buildTermCalendar([
  { termCode: '2025FA', startsOn: '2025-08-25', endsOn: '2025-12-19' },
  { termCode: '2026SP', startsOn: '2026-01-12', endsOn: '2026-05-08' },
  { termCode: '2026FA', startsOn: '2026-08-24', endsOn: '2026-12-18' },
  { termCode: '2027SP', startsOn: '2027-01-11', endsOn: '2027-05-07' },
  { termCode: '2027FA', startsOn: '2027-08-23', endsOn: '2027-12-17' },
  { termCode: '2028SP', startsOn: '2028-01-10', endsOn: '2028-05-05' },
]);

/** Reviewer and date of the repeat-for-credit cases (#366). */
export const COUNTING_REVIEW = {
  reviewer: 'pending-academic-review',
  adjudicatedOn: '2026-10-06',
} as const;

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

/** Fields a case author writes; the factory fills in the rest. */
export type AuthoredCountingCase = Omit<
  GoldenCountingCaseInput,
  'family' | 'sourceVersions' | 'reviewer' | 'adjudicatedOn' | 'allowedAlternatives'
> &
  Partial<Pick<GoldenCountingCaseInput, 'allowedAlternatives'>>;

/**
 * Defines an attempt-counting case in the REPEAT family with the repeat-for-credit adjudication
 * defaults.
 *
 * @param authored - The case's own fields.
 * @returns The validated case.
 */
export function countingCase(authored: AuthoredCountingCase): GoldenCountingCase {
  return defineGoldenCountingCase({
    allowedAlternatives: [],
    sourceVersions: [...COUNTING_SOURCES],
    ...COUNTING_REVIEW,
    ...authored,
    family: GoldenRuleFamily.Repeat,
  });
}

/** What a counting case varies; everything else is the default. */
export interface CountingVariation {
  readonly courses: GoldenCountingCaseInput['inputs']['courses'];
  readonly attempts: GoldenCountingCaseInput['inputs']['attempts'];
  /** The repeat policy of the academic policy; `null` (the default) states none. */
  readonly repeatPolicy?: RepeatPolicy | null;
  /** The term calendar; defaults to {@link COUNTING_TERM_CALENDAR}. */
  readonly termCalendar?: GoldenCountingCaseInput['inputs']['termCalendar'];
}

/**
 * Builds the complete inputs of a counting case.
 *
 * @param variation - The catalog, attempts, repeat policy, and calendar the case is about.
 * @returns Policy, term calendar, catalog, and attempts.
 */
export function countingInputs(variation: CountingVariation): GoldenCountingCaseInput['inputs'] {
  return {
    academicPolicy: buildAcademicPolicy({ repeatPolicy: variation.repeatPolicy ?? null }),
    termCalendar: variation.termCalendar ?? COUNTING_TERM_CALENDAR,
    courses: variation.courses,
    attempts: variation.attempts,
  };
}

/**
 * Expects a COUNTED group.
 *
 * @param earnedCreditsHundredths - Earned credit in hundredths, or `null` when a counted attempt's
 *   credit is unknown.
 * @returns The expected resolution.
 */
export function counted(earnedCreditsHundredths: number | null): ExpectedCounting {
  return { state: CountingState.Counted, reasonCode: null, earnedCreditsHundredths };
}

/**
 * Expects an UNDETERMINED group, which earns `null`.
 *
 * @param reasonCode - Why the group is undetermined.
 * @returns The expected resolution.
 */
export function undetermined(
  reasonCode: typeof ReasonCode.RepeatPolicyUndefined | typeof ReasonCode.RepeatOrderUndetermined,
): ExpectedCounting {
  return { state: CountingState.Undetermined, reasonCode, earnedCreditsHundredths: null };
}

/** Expects a NONE group: no attempt can count, and earned credit is 0. */
export const NO_COUNTING_ATTEMPT: ExpectedCounting = {
  state: CountingState.None,
  reasonCode: null,
  earnedCreditsHundredths: 0,
};
