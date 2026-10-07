/**
 * @file Runs attempt-counting golden cases through `@caa/engine`'s `resolveAttempts` only, and
 *   lists every way the group's counting resolution departs from the case's expectation, each
 *   prefixed with the case ID and the field. It reads only the resolution's state, reason code,
 *   and earned credit, so a change to how the engine records the counted attempts doesn't break it.
 * @module @caa/tests/support/golden-counting-runner
 * @see docs/adr/0012-explicit-no-prerequisite-rules-and-repeat-for-credit-counting.md
 * @see docs/standards/07-testing.md
 */
import { CountingState } from '@caa/domain';
import { resolveAttempts } from '@caa/engine';
import { countingMakesClaim, type ExpectedCounting, type GoldenCountingCase } from '@caa/test-kit';

import { differ } from './golden-runner';

/**
 * Reduces the engine's resolution of the case's one group to the fields a case states.
 *
 * @param golden - The case.
 * @returns State, reason code (`null` unless UNDETERMINED), and earned credit.
 * @throws {Error} When the engine doesn't return exactly one group, or throws.
 */
export function runCountingCase(golden: GoldenCountingCase): ExpectedCounting {
  const { attempts, courses, academicPolicy, termCalendar } = golden.inputs;
  const groups = resolveAttempts(attempts, courses, { academicPolicy, termCalendar });
  const [group] = groups;
  if (groups.length !== 1 || group === undefined) {
    throw new Error(`expected one attempt group, got ${String(groups.length)}`);
  }
  const { counting } = group;
  return {
    state: counting.state,
    reasonCode: counting.state === CountingState.Undetermined ? counting.reasonCode : null,
    earnedCreditsHundredths: counting.earnedCreditsHundredths,
  };
}

/**
 * Compares a resolution with one expected resolution.
 *
 * @param expected - The expected resolution.
 * @param actual - The returned resolution.
 * @returns One message per field that differs.
 */
function compareCounting(expected: ExpectedCounting, actual: ExpectedCounting): string[] {
  return [
    differ('counting.state', expected.state, actual.state),
    differ('counting.reasonCode', expected.reasonCode, actual.reasonCode),
    differ(
      'counting.earnedCreditsHundredths',
      expected.earnedCreditsHundredths,
      actual.earnedCreditsHundredths,
    ),
  ].filter((message) => message !== null);
}

/**
 * Runs a counting case and lists how the result departs from it. A result that matches the
 * expectation or any allowed alternative, and makes no prohibited claim, has no mismatches.
 *
 * @param golden - The case.
 * @returns One message per mismatch, each starting with the case ID; empty when the case holds.
 */
export function findCountingMismatches(golden: GoldenCountingCase): string[] {
  let actual: ExpectedCounting;
  try {
    actual = runCountingCase(golden);
  } catch (error) {
    return [`${golden.id} engine threw: ${error instanceof Error ? error.message : String(error)}`];
  }
  const primary = compareCounting(golden.expected, actual);
  const isAlternative = golden.allowedAlternatives.some(
    (alternative) => compareCounting(alternative, actual).length === 0,
  );
  const outcome = primary.length === 0 || isAlternative ? [] : primary;
  const prohibited = golden.prohibitedClaims
    .filter((claim) => countingMakesClaim(actual, claim))
    .map((claim) => `counting: prohibited claim made: ${claim.claim}`);
  return [...outcome, ...prohibited].map((message) => `${golden.id} ${message}`);
}
