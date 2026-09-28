/**
 * @file Tests for the check result data object: allocation and credit-load checks.
 */
import { describe, expect, it } from 'vitest';

import { CheckKind } from '../enums/check-kind.enum';
import { CheckState } from '../enums/check-state.enum';
import { ReasonCode } from '../enums/reason-code.enum';
import type { CheckEvidenceInput } from './check-evidence.model';
import { CheckResultSchema, createCheckResult } from './check-result.model';

describe('CheckResultSchema allocation and credit-load checks', () => {
  const CALC_ID = '00000000-0000-4000-8000-000000000101';
  const PHYSICS_ID = '00000000-0000-4000-8000-000000000102';
  const LOAD = {
    totalCreditsHundredths: 1350,
    minCreditsHundredths: 1200,
    maxCreditsHundredths: 1800,
  } as const;
  const evidence = (extra: Partial<CheckEvidenceInput>): CheckEvidenceInput => ({
    rulesetVersion: 'demo-2026.1',
    decisiveLeaves: [],
    ...extra,
  });
  const creditCheck = (
    state: CheckState,
    reasonCode: ReasonCode | undefined,
    load: CheckEvidenceInput['creditLoad'],
  ): boolean =>
    CheckResultSchema.safeParse({
      kind: CheckKind.CreditLoad,
      state,
      ...(reasonCode === undefined ? {} : { reasonCode }),
      evidence: evidence({ creditLoad: load }),
    }).success;

  it('has the REQUIREMENT_ALLOCATION and CREDIT_LOAD check kinds', () => {
    expect(CheckKind.RequirementAllocation).toBe('REQUIREMENT_ALLOCATION');
    expect(CheckKind.CreditLoad).toBe('CREDIT_LOAD');
  });

  it('names the competing courses of an allocation conflict in input order', () => {
    const check = createCheckResult({
      kind: CheckKind.RequirementAllocation,
      state: CheckState.Fail,
      reasonCode: ReasonCode.AllocationConflict,
      evidence: evidence({ courseIds: [PHYSICS_ID, CALC_ID] }),
    });

    expect(check.evidence?.courseIds).toEqual([PHYSICS_ID, CALC_ID]);
  });

  it('accepts course IDs on any kind, such as an applicability check', () => {
    const check = createCheckResult({
      kind: CheckKind.RequirementApplicability,
      state: CheckState.Pass,
      evidence: evidence({ courseIds: [CALC_ID] }),
    });

    expect(check.evidence?.courseIds).toEqual([CALC_ID]);
  });

  it('accepts a passing credit-load check whose total is within the bounds', () => {
    expect(creditCheck(CheckState.Pass, undefined, LOAD)).toBe(true);
    expect(creditCheck(CheckState.Pass, undefined, { ...LOAD, totalCreditsHundredths: 1200 })).toBe(
      true,
    );
    expect(creditCheck(CheckState.Pass, undefined, { ...LOAD, totalCreditsHundredths: 1800 })).toBe(
      true,
    );
  });

  it('rejects a passing credit-load check whose total is outside the bounds', () => {
    expect(creditCheck(CheckState.Pass, undefined, { ...LOAD, totalCreditsHundredths: 1801 })).toBe(
      false,
    );
    expect(creditCheck(CheckState.Pass, undefined, { ...LOAD, totalCreditsHundredths: 1199 })).toBe(
      false,
    );
  });

  it('requires an over-limit total above the maximum', () => {
    const over = { ...LOAD, totalCreditsHundredths: 2100 };

    expect(creditCheck(CheckState.Fail, ReasonCode.CreditLimitExceeded, over)).toBe(true);
    expect(creditCheck(CheckState.Fail, ReasonCode.CreditLimitExceeded, LOAD)).toBe(false);
  });

  it('requires an under-minimum total below the minimum', () => {
    const under = { ...LOAD, totalCreditsHundredths: 900 };

    expect(creditCheck(CheckState.Fail, ReasonCode.CreditBelowMinimum, under)).toBe(true);
    expect(creditCheck(CheckState.Fail, ReasonCode.CreditBelowMinimum, LOAD)).toBe(false);
  });

  it('accepts an UNKNOWN credit-load check with a null load and the course missing a value', () => {
    const check = createCheckResult({
      kind: CheckKind.CreditLoad,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.VariableCreditUnselected,
      evidence: evidence({ courseIds: [CALC_ID], creditLoad: null }),
    });

    expect(check.evidence?.creditLoad).toBeNull();
    expect(check.evidence?.courseIds).toEqual([CALC_ID]);
  });

  it('rejects credit-load evidence, even null, on any other kind', () => {
    const kinds = Object.values(CheckKind).filter((kind) => kind !== CheckKind.CreditLoad);
    const accepted = kinds.flatMap((kind) =>
      [LOAD, null].filter(
        (creditLoad) =>
          CheckResultSchema.safeParse({
            kind,
            state: CheckState.Pass,
            evidence: evidence({ creditLoad }),
          }).success,
      ),
    );

    expect(kinds).toHaveLength(8);
    expect(accepted).toEqual([]);
  });

  it('keeps existing evidence without the new fields valid and unchanged', () => {
    const check = createCheckResult({
      kind: CheckKind.RequirementApplicability,
      state: CheckState.Pass,
      sourceRef: 'demo-audit:audit_demo_r1',
      evidence: { rulesetVersion: null, decisiveLeaves: [] },
    });

    expect(check.evidence).toEqual({ rulesetVersion: null, decisiveLeaves: [] });
  });
});
