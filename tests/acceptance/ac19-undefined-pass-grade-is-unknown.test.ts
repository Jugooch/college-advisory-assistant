/**
 * @file Acceptance: when policy doesn't define whether a pass grade meets a minimum letter grade,
 *   the prerequisite is UNKNOWN, never presumed passing.
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ReasonCode } from '@caa/domain';
import { compareToMinimumGrade } from '@caa/engine';
import {
  buildAcademicPolicy,
  buildPrerequisiteRule,
  completedAttempt,
  course,
  letter,
  pass,
  SYNTHETIC_COURSES,
} from '@caa/test-kit';

import { evaluateDefaultPrerequisite } from '../support/prerequisite-harness';

describe('AC19 an undefined pass grade is not presumed passing', () => {
  it('compares P with a C minimum as UNKNOWN PASS_EQUIVALENCE_UNDEFINED', () => {
    const result = compareToMinimumGrade(
      pass(),
      letter('C'),
      buildAcademicPolicy({ passSatisfiesMinimumGrade: null }),
    );

    expect(result).toEqual({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.PassEquivalenceUndefined,
    });
  });

  it('makes the prerequisite UNKNOWN, not PASS', () => {
    const check = evaluateDefaultPrerequisite({ attempts: [completedAttempt({ grade: pass() })] });

    expect(check).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.PassEquivalenceUndefined,
    });
  });

  it('keeps a D UNKNOWN under "any passing completion" when no passing letter is defined', () => {
    const check = evaluateDefaultPrerequisite({
      rule: buildPrerequisiteRule({ expression: course(SYNTHETIC_COURSES.math101.id) }),
      attempts: [completedAttempt({ grade: letter('D') })],
    });

    expect(check).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.PassingGradeUndefined,
    });
  });
});
