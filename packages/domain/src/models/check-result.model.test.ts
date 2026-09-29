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

    expect(codes).toHaveLength(36);
    expect(codes).toContain('TRANSITION_TIME_UNDEFINED');
    expect(codes).toContain('VARIABLE_CREDIT_UNSELECTED');
    expect(codes).toContain('CREDIT_BOUNDS_UNDEFINED');
    expect(codes).toContain('AUDIT_PROGRAM_MISMATCH');
  });

  it('accepts PASSING_GRADE_UNDEFINED on an UNKNOWN check', () => {
    expect(
      createCheckResult({
        kind: CheckKind.Prerequisite,
        state: CheckState.Unknown,
        reasonCode: ReasonCode.PassingGradeUndefined,
      }).reasonCode,
    ).toBe('PASSING_GRADE_UNDEFINED');
  });

  it('accepts the attempt resolution reason codes', () => {
    const codes = [
      ReasonCode.RepeatPolicyUndefined,
      ReasonCode.RepeatOrderUndetermined,
      ReasonCode.CourseNotInCatalog,
      ReasonCode.GradeNotRanked,
    ].map(
      (reasonCode) =>
        createCheckResult({ kind: CheckKind.Prerequisite, state: CheckState.Unknown, reasonCode })
          .reasonCode,
    );

    expect(codes).toEqual([
      'REPEAT_POLICY_UNDEFINED',
      'REPEAT_ORDER_UNDETERMINED',
      'COURSE_NOT_IN_CATALOG',
      'GRADE_NOT_RANKED',
    ]);
  });
});

describe('CheckResultSchema reason codes for requirement applicability', () => {
  it('accepts REQUIREMENT_IN_PROGRESS on a CONDITIONAL applicability check', () => {
    expect(
      createCheckResult({
        kind: CheckKind.RequirementApplicability,
        state: CheckState.Conditional,
        reasonCode: ReasonCode.RequirementInProgress,
      }).reasonCode,
    ).toBe('REQUIREMENT_IN_PROGRESS');
  });
});

describe('CheckResultSchema reason codes for unsettled grades', () => {
  it('accepts GRADE_NOT_RECORDED on an UNKNOWN check', () => {
    expect(
      createCheckResult({
        kind: CheckKind.Prerequisite,
        state: CheckState.Unknown,
        reasonCode: ReasonCode.GradeNotRecorded,
      }).reasonCode,
    ).toBe('GRADE_NOT_RECORDED');
  });

  it('accepts INCOMPLETE_ATTEMPT on an UNKNOWN check', () => {
    expect(
      createCheckResult({
        kind: CheckKind.Prerequisite,
        state: CheckState.Unknown,
        reasonCode: ReasonCode.IncompleteAttempt,
      }).reasonCode,
    ).toBe('INCOMPLETE_ATTEMPT');
  });
});

describe('CheckResultSchema evidence', () => {
  const COURSE_LEAF = {
    type: 'COURSE',
    path: [1],
    courseId: '00000000-0000-4000-8000-000000000101',
    requiredGrade: { scheme: 'LETTER', value: 'C' },
    attemptIds: ['00000000-0000-4000-8000-000000000201'],
    reasonCode: ReasonCode.InProgressMinGrade,
  } as const;

  const UNSUPPORTED_LEAF = {
    type: 'UNSUPPORTED',
    path: [0],
    sourceText: 'Consent of the demo department',
    reasonCode: ReasonCode.UnsupportedRule,
  } as const;

  const conditional = {
    kind: CheckKind.Prerequisite,
    state: CheckState.Conditional,
    reasonCode: ReasonCode.InProgressMinGrade,
    sourceRef: 'rule_demo_calc1_to_calc2',
  } as const;

  it('stays optional, so a check without evidence is still valid', () => {
    expect(createCheckResult(conditional).evidence).toBeUndefined();
  });

  it('keeps the planning/08 prerequisite evidence: ruleset, required grade, and attempts', () => {
    const check = createCheckResult({
      ...conditional,
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [COURSE_LEAF] },
    });

    expect(check.evidence?.rulesetVersion).toBe('demo-2026.1');
    expect(check.evidence?.decisiveLeaves[0]).toEqual(COURSE_LEAF);
  });

  it('accepts evidence without leaves on a kind that has no rule expression', () => {
    const check = createCheckResult({
      kind: CheckKind.SeatEligibility,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.UnsupportedRule,
      evidence: { rulesetVersion: null, decisiveLeaves: [] },
    });

    expect(check.evidence).toEqual({ rulesetVersion: null, decisiveLeaves: [] });
  });

  it('rejects decisive leaves on a kind that has no rule expression', () => {
    const result = CheckResultSchema.safeParse({
      ...conditional,
      kind: CheckKind.ScheduleFeasibility,
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [COURSE_LEAF] },
    });

    expect(result.success).toBe(false);
  });

  it('accepts decisive leaves on a corequisite check', () => {
    const check = createCheckResult({
      ...conditional,
      kind: CheckKind.Corequisite,
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [COURSE_LEAF] },
    });

    expect(check.evidence?.decisiveLeaves).toHaveLength(1);
  });

  it('rejects a leaf reason code on a passing check', () => {
    const result = CheckResultSchema.safeParse({
      kind: CheckKind.Prerequisite,
      state: CheckState.Pass,
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [COURSE_LEAF] },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a leaf without a reason code on a non-passing check', () => {
    const result = CheckResultSchema.safeParse({
      ...conditional,
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [{ ...COURSE_LEAF, reasonCode: null }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a passing leaf without a reason code on a passing check', () => {
    const check = createCheckResult({
      kind: CheckKind.Prerequisite,
      state: CheckState.Pass,
      evidence: {
        rulesetVersion: 'demo-2026.1',
        decisiveLeaves: [{ ...COURSE_LEAF, reasonCode: null }],
      },
    });

    expect(check.evidence?.decisiveLeaves[0]?.reasonCode).toBeNull();
  });

  it('accepts an unsupported leaf on an UNKNOWN check', () => {
    const check = createCheckResult({
      kind: CheckKind.Prerequisite,
      state: CheckState.Unknown,
      reasonCode: ReasonCode.UnsupportedRule,
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [UNSUPPORTED_LEAF] },
    });

    expect(check.evidence?.decisiveLeaves[0]?.type).toBe('UNSUPPORTED');
  });

  it('rejects an unsupported leaf deciding a non-UNKNOWN check', () => {
    const result = CheckResultSchema.safeParse({
      kind: CheckKind.Prerequisite,
      state: CheckState.Fail,
      reasonCode: ReasonCode.UnsupportedRule,
      evidence: { rulesetVersion: 'demo-2026.1', decisiveLeaves: [UNSUPPORTED_LEAF] },
    });

    expect(result.success).toBe(false);
  });

  it('rejects malformed evidence', () => {
    const result = CheckResultSchema.safeParse({
      ...conditional,
      evidence: { rulesetVersion: 'demo-2026.1' },
    });

    expect(result.success).toBe(false);
  });
});
