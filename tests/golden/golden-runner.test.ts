/**
 * @file Proves the golden runner reports each mismatch with its case ID and field, and honors
 *   allowed alternatives and prohibited claims, so a silent pass can't hide a disagreement.
 * @requirement NFR-01
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ReasonCode } from '@caa/domain';
import {
  completedAttempt,
  letter,
  mustNot,
  prerequisiteCase,
  prerequisiteCheck,
  prerequisiteInputs,
} from '@caa/test-kit';

import { findGoldenMismatches } from '../support/golden-runner';

/** A D against a C minimum, which the engine reports as FAIL `MIN_GRADE_NOT_MET`. */
const D_AGAINST_C = prerequisiteInputs({ attempts: [completedAttempt({ grade: letter('D') })] });

describe('findGoldenMismatches', () => {
  it('names the case and the field when the reason code differs', () => {
    const golden = prerequisiteCase({
      id: 'GC-SELF-001',
      family: 'MINIMUM_GRADE',
      title: 'Deliberately wrong reason code',
      requirementIds: ['T04'],
      inputs: D_AGAINST_C,
      expected: [prerequisiteCheck(CheckState.Fail, ReasonCode.NoQualifyingAttempt)],
      prohibitedClaims: [mustNot(CheckState.Pass, 'must not pass')],
      rationale: 'Runner self-test.',
      citations: ['planning/13'],
    });

    expect(findGoldenMismatches(golden)).toEqual([
      'GC-SELF-001 checks[0].reasonCode: expected "NO_QUALIFYING_ATTEMPT", got "MIN_GRADE_NOT_MET"',
    ]);
  });

  it('accepts a result that matches an allowed alternative', () => {
    const golden = prerequisiteCase({
      id: 'GC-SELF-002',
      family: 'MINIMUM_GRADE',
      title: 'Alternative matches',
      requirementIds: ['T04'],
      inputs: D_AGAINST_C,
      expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.GradeNotRanked)],
      allowedAlternatives: [[prerequisiteCheck(CheckState.Fail, ReasonCode.MinGradeNotMet)]],
      prohibitedClaims: [mustNot(CheckState.Pass, 'must not pass')],
      rationale: 'Runner self-test.',
      citations: ['planning/13'],
    });

    expect(findGoldenMismatches(golden)).toEqual([]);
  });

  it('reports a prohibited claim even when an alternative matches', () => {
    const golden = prerequisiteCase({
      id: 'GC-SELF-003',
      family: 'MINIMUM_GRADE',
      title: 'Prohibited state returned',
      requirementIds: ['T04'],
      inputs: D_AGAINST_C,
      expected: [prerequisiteCheck(CheckState.Unknown, ReasonCode.GradeNotRanked)],
      prohibitedClaims: [mustNot(CheckState.Fail, 'must not fail')],
      rationale: 'Runner self-test.',
      citations: ['planning/13'],
    });

    expect(findGoldenMismatches(golden)).toEqual([
      'GC-SELF-003 checks[0].state: expected "UNKNOWN", got "FAIL"',
      'GC-SELF-003 checks[0].reasonCode: expected "GRADE_NOT_RANKED", got "MIN_GRADE_NOT_MET"',
      'GC-SELF-003 checks[0].state: prohibited FAIL: must not fail',
    ]);
  });
});
