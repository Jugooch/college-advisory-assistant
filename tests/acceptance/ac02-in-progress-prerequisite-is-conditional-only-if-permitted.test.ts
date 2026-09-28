/**
 * @file Acceptance: an in-progress prerequisite is CONDITIONAL only if institutional progression
 *   policy permits it.
 * @requirement FR-06
 * @requirement FR-09
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, GradeScheme, ReasonCode } from '@caa/domain';
import { inProgressAttempt } from '@caa/test-kit';

import { evaluateDefaultPrerequisite } from '../support/prerequisite-harness';

describe('AC02 in-progress prerequisites depend on progression policy', () => {
  it('is CONDITIONAL on earning C when policy permits progression', () => {
    const check = evaluateDefaultPrerequisite({
      policy: { allowsInProgressPrerequisites: true },
      attempts: [inProgressAttempt()],
    });

    expect(check).toMatchObject({
      state: CheckState.Conditional,
      reasonCode: ReasonCode.InProgressMinGrade,
    });
    expect(check.evidence?.decisiveLeaves).toMatchObject([
      { requiredGrade: { scheme: GradeScheme.Letter, value: 'C' } },
    ]);
  });

  it('is FAIL PROGRESSION_NOT_PERMITTED, not CONDITIONAL, when policy forbids it', () => {
    const check = evaluateDefaultPrerequisite({
      policy: { allowsInProgressPrerequisites: false },
      attempts: [inProgressAttempt()],
    });

    expect(check).toMatchObject({
      state: CheckState.Fail,
      reasonCode: ReasonCode.ProgressionNotPermitted,
    });
  });
});
