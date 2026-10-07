/**
 * @file Proves the attempt-counting golden runner reports a wrong state, reason, or earned credit
 *   with the case ID and field, accepts an adjudicated alternative, and reports a prohibited
 *   claim, so a counting case can't pass on the state alone.
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/standards/07-testing.md
 */
import { describe, expect, it } from 'vitest';

import { CountingState, ReasonCode, RepeatPolicy } from '@caa/domain';
import {
  buildCourse,
  completedAttempt,
  counted,
  countingCase,
  countingInputs,
  NO_COUNTING_ATTEMPT,
  undetermined,
} from '@caa/test-kit';

import { findCountingMismatches } from '../support/golden-counting-runner';

const PLAIN = buildCourse();
const INPUTS = countingInputs({
  courses: [PLAIN],
  repeatPolicy: RepeatPolicy.MostRecent,
  attempts: [
    completedAttempt({ courseId: PLAIN.id, termCode: '2025FA' }, 1),
    completedAttempt({ courseId: PLAIN.id, termCode: '2026SP' }, 2),
  ],
});

/**
 * Builds a case over two completed attempts of a course that isn't repeatable for credit, under
 * MOST_RECENT, which the engine counts as 3.00.
 *
 * @param overrides - What the test changes.
 * @returns The case.
 */
function runnerCase(
  overrides: Partial<Parameters<typeof countingCase>[0]>,
): ReturnType<typeof countingCase> {
  return countingCase({
    id: 'GC-RCR-900',
    title: 'Runner test case',
    requirementIds: ['FR-06'],
    inputs: INPUTS,
    expected: counted(300),
    prohibitedClaims: [{ earnedCreditsHundredths: 600, claim: 'must not count both attempts' }],
    rationale: 'MOST_RECENT counts one attempt.',
    citations: ['docs/adr/0012 §2'],
    ...overrides,
  });
}

describe('golden counting runner', () => {
  it('reports no mismatch when the engine meets the expectation', () => {
    expect(findCountingMismatches(runnerCase({}))).toEqual([]);
  });

  it('reports the case ID and field of a wrong earned credit', () => {
    expect(findCountingMismatches(runnerCase({ expected: counted(500) }))).toEqual([
      'GC-RCR-900 counting.earnedCreditsHundredths: expected 500, got 300',
    ]);
  });

  it('reports a wrong state and reason code', () => {
    const mismatches = findCountingMismatches(
      runnerCase({
        expected: undetermined(ReasonCode.RepeatPolicyUndefined),
        prohibitedClaims: [{ state: CountingState.None, claim: 'x' }],
      }),
    );

    expect(mismatches).toEqual([
      'GC-RCR-900 counting.state: expected "UNDETERMINED", got "COUNTED"',
      'GC-RCR-900 counting.reasonCode: expected "REPEAT_POLICY_UNDEFINED", got null',
      'GC-RCR-900 counting.earnedCreditsHundredths: expected null, got 300',
    ]);
  });

  it('accepts an adjudicated alternative', () => {
    const golden = runnerCase({
      expected: NO_COUNTING_ATTEMPT,
      allowedAlternatives: [counted(300)],
    });

    expect(findCountingMismatches(golden)).toEqual([]);
  });

  it('reports a prohibited claim the engine makes', () => {
    const golden = runnerCase({
      expected: counted(500),
      allowedAlternatives: [],
      prohibitedClaims: [{ earnedCreditsHundredths: 300, claim: 'must not earn 3.00' }],
    });

    expect(findCountingMismatches(golden)).toContain(
      'GC-RCR-900 counting: prohibited claim made: must not earn 3.00',
    );
  });
});
