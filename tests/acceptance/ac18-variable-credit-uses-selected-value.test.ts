/**
 * @file Acceptance: a variable-credit independent study counts its selected credit value, and the
 *   cap is evaluated on that value.
 * @requirement FR-06
 * @see docs/planning/13-test-and-evaluation-strategy.md
 */
import { describe, expect, it } from 'vitest';

import { CheckState, ReasonCode } from '@caa/domain';
import { CandidateSetInputError, checkCreditLoad } from '@caa/engine';
import { buildCourse, planned, SYNTHETIC_COURSES } from '@caa/test-kit';

const { math101, math102, phys201, ind390 } = SYNTHETIC_COURSES;
/** 3.00 + 3.00 + 4.00 + 3.00 = 13.00 fixed credits. */
const FIXED = [planned(math101), planned(math102), planned(phys201), planned(buildCourse({}, 11))];
const BOUNDS = {
  minCreditsHundredths: 1200,
  maxCreditsHundredths: 1500,
  sourceRef: 'demo-load-policy-2026FA',
};

describe('AC18 variable-credit independent study', () => {
  it('counts a selected 1.50 credits exactly', () => {
    const check = checkCreditLoad([...FIXED, planned(ind390, 150)], BOUNDS);

    expect(check).toMatchObject({
      state: CheckState.Pass,
      evidence: {
        creditLoad: {
          totalCreditsHundredths: 1450,
          minCreditsHundredths: 1200,
          maxCreditsHundredths: 1500,
        },
      },
    });
  });

  it('fails the cap when the selected 3.00 credits push the total to 16.00', () => {
    const check = checkCreditLoad([...FIXED, planned(ind390, 300)], BOUNDS);

    expect(check).toMatchObject({
      state: CheckState.Fail,
      reasonCode: ReasonCode.CreditLimitExceeded,
      evidence: { creditLoad: { totalCreditsHundredths: 1600 } },
    });
  });

  it('is UNKNOWN VARIABLE_CREDIT_UNSELECTED naming the course when no value is chosen', () => {
    const check = checkCreditLoad([...FIXED, planned(ind390)], BOUNDS);

    expect(check).toMatchObject({
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
      evidence: { courseIds: [ind390.id], creditLoad: null },
    });
  });

  it('rejects a selected value outside the course range instead of guessing', () => {
    expect(() => checkCreditLoad([...FIXED, planned(ind390, 350)], BOUNDS)).toThrow(
      CandidateSetInputError,
    );
  });
});
