/**
 * @file Acceptance: a prerequisite requiring C, where the student earned D, is FAIL.
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckKind, CheckState, GradeScheme, ReasonCode } from '@caa/domain';
import { completedAttempt, letter } from '@caa/test-kit';

import { evaluateDefaultPrerequisite } from '../support/prerequisite-harness';

describe('AC01 a D against a C prerequisite fails', () => {
  it('returns FAIL MIN_GRADE_NOT_MET for the prerequisite', () => {
    const check = evaluateDefaultPrerequisite({
      attempts: [completedAttempt({ grade: letter('D') })],
    });

    expect(check).toMatchObject({
      kind: CheckKind.Prerequisite,
      state: CheckState.Fail,
      reasonCode: ReasonCode.MinGradeNotMet,
      sourceRef: 'demo-rule-0001',
    });
  });

  it('shows C as the required grade in the evidence', () => {
    const check = evaluateDefaultPrerequisite({
      attempts: [completedAttempt({ grade: letter('D') })],
    });

    expect(check.evidence?.decisiveLeaves).toMatchObject([
      {
        requiredGrade: { scheme: GradeScheme.Letter, value: 'C' },
        reasonCode: 'MIN_GRADE_NOT_MET',
      },
    ]);
  });
});
