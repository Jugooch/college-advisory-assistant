/**
 * @file Tests for the check result data object.
 */
import { describe, expect, it } from 'vitest';

import { CheckKind } from '../enums/check-kind.enum';
import { CheckState } from '../enums/check-state.enum';
import { ReasonCode } from '../enums/reason-code.enum';
import { CheckResultSchema, createCheckResult } from './check-result.model';

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
      reasonCode: ReasonCode.MinGradeNotMet,
    });

    expect(check.reasonCode).toBe('MIN_GRADE_NOT_MET');
  });
});

describe('CheckResultSchema', () => {
  it('rejects a free-text reason code that is not in the registry', () => {
    const result = CheckResultSchema.safeParse({
      kind: CheckKind.Prerequisite,
      state: CheckState.Fail,
      reasonCode: 'SOMETHING_WENT_WRONG',
    });

    expect(result.success).toBe(false);
  });

  it('accepts every registered reason code on an UNKNOWN check', () => {
    const codes = Object.values(ReasonCode).map(
      (reasonCode) =>
        createCheckResult({ kind: CheckKind.Prerequisite, state: CheckState.Unknown, reasonCode })
          .reasonCode,
    );

    expect(codes).toHaveLength(16);
    expect(codes).toContain('VARIABLE_CREDIT_UNSELECTED');
  });
});
