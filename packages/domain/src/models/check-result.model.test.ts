/**
 * @file Tests for the check result data object.
 */
import { describe, expect, it } from 'vitest';

import { CheckState } from '../enums/check-state.enum';
import { CheckKind, createCheckResult } from './check-result.model';

describe('createCheckResult', () => {
  it('accepts a passing check without a reason code', () => {
    const check = createCheckResult({ kind: CheckKind.Prerequisite, state: CheckState.Pass });

    expect(check.state).toBe(CheckState.Pass);
  });

  it('rejects an UNKNOWN check that has no reason code', () => {
    const create = (): unknown =>
      createCheckResult({ kind: CheckKind.SeatEligibility, state: CheckState.Unknown });

    expect(create).toThrow(/reasonCode/);
  });

  it('keeps the reason code on a failing check', () => {
    const check = createCheckResult({
      kind: CheckKind.Prerequisite,
      state: CheckState.Fail,
      reasonCode: 'MIN_GRADE_NOT_MET',
    });

    expect(check.reasonCode).toBe('MIN_GRADE_NOT_MET');
  });
});
