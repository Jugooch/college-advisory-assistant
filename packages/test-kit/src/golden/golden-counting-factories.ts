/**
 * @file Authoring helpers for the attempt-counting golden cases: shared sources, term calendar,
 *   and review stamp, the case and inputs factories, and the expectation shorthands.
 * @module @caa/test-kit/golden/golden-counting-factories
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 */
import { CountingState, type ReasonCode, type RepeatPolicy } from '@caa/domain';

import { buildAcademicPolicy } from '../builders/academic-policy.builder';
import { buildTermCalendar } from '../builders/term.builder';
import {
  defineGoldenCountingCase,
  type ExpectedCounting,
  type GoldenCountingCase,
  type GoldenCountingCaseInput,
} from './golden-counting-case.schema';
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
