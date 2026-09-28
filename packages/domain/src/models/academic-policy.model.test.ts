/**
 * @file Tests for the academic policy data object.
 */
import { describe, expect, it } from 'vitest';

import { LetterGrade } from '../enums/grade-scheme.enum';
import { RepeatPolicy } from '../enums/repeat-policy.enum';
import {
  type AcademicPolicyInput,
  AcademicPolicySchema,
  createAcademicPolicy,
} from './academic-policy.model';

const VALID: AcademicPolicyInput = {
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  rulesetVersion: 'demo-2026.1',
  allowsInProgressPrerequisites: true,
  passSatisfiesMinimumGrade: null,
  letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
  lowestPassingLetterGrade: null,
  repeatPolicy: null,
  termCreditBounds: null,
};

describe('createAcademicPolicy', () => {
  it('accepts a policy with a partial letter order and undecided pass and repeat rules', () => {
    expect(createAcademicPolicy(VALID)).toEqual({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      lowestPassingLetterGrade: null,
      repeatPolicy: null,
      termCreditBounds: null,
    });
  });

  it.each([
    [RepeatPolicy.MostRecent, 'MOST_RECENT'],
    [RepeatPolicy.HighestGrade, 'HIGHEST_GRADE'],
  ])('accepts the %s repeat policy', (repeatPolicy, expected) => {
    expect(createAcademicPolicy({ ...VALID, repeatPolicy }).repeatPolicy).toBe(expected);
  });

  it('rejects a repeat policy outside the registry', () => {
    expect(() =>
      createAcademicPolicy({
        ...VALID,
        repeatPolicy: 'FIRST_ATTEMPT' as AcademicPolicyInput['repeatPolicy'],
      }),
    ).toThrow();
  });

  it('accepts a complete letter order', () => {
    const order = Object.values(LetterGrade);

    expect(createAcademicPolicy({ ...VALID, letterGradeOrder: order }).letterGradeOrder).toEqual([
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'B-',
      'C+',
      'C',
      'C-',
      'D+',
      'D',
      'D-',
      'F',
    ]);
  });

  it('keeps the institution-supplied order exactly as given', () => {
    expect(
      createAcademicPolicy({ ...VALID, letterGradeOrder: ['F', 'A'] }).letterGradeOrder,
    ).toEqual(['F', 'A']);
  });

  it('accepts an explicit pass equivalence decision', () => {
    const policy = createAcademicPolicy({
      ...VALID,
      allowsInProgressPrerequisites: false,
      passSatisfiesMinimumGrade: false,
    });

    expect(policy.allowsInProgressPrerequisites).toBe(false);
    expect(policy.passSatisfiesMinimumGrade).toBe(false);
  });

  it('rejects a letter order that repeats a letter', () => {
    expect(() => createAcademicPolicy({ ...VALID, letterGradeOrder: ['A', 'B', 'A'] })).toThrow(
      /at most once/,
    );
  });

  it.each([
    [LetterGrade.C, 'C'],
    [LetterGrade.D, 'D'],
    [LetterGrade.DMinus, 'D-'],
  ])('accepts %s as the lowest passing letter when the order ranks it', (grade, expected) => {
    expect(
      createAcademicPolicy({
        ...VALID,
        letterGradeOrder: Object.values(LetterGrade),
        lowestPassingLetterGrade: grade,
      }).lowestPassingLetterGrade,
    ).toBe(expected);
  });

  it('rejects F as the lowest passing letter, because a failing grade never passes', () => {
    const result = AcademicPolicySchema.safeParse({
      ...VALID,
      lowestPassingLetterGrade: LetterGrade.F,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['lowestPassingLetterGrade']]);
    expect(result.error?.issues[0]?.message).toMatch(/must not be F/);
  });

  it('rejects a lowest passing letter the order does not rank, because it could not be compared', () => {
    const result = AcademicPolicySchema.safeParse({
      ...VALID,
      lowestPassingLetterGrade: LetterGrade.DMinus,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['lowestPassingLetterGrade']]);
    expect(result.error?.issues[0]?.message).toMatch(/must appear in letterGradeOrder/);
  });

  it('rejects P as the lowest passing letter, because P is never a letter grade', () => {
    expect(
      AcademicPolicySchema.safeParse({
        ...VALID,
        lowestPassingLetterGrade: 'P' as AcademicPolicyInput['lowestPassingLetterGrade'],
      }).success,
    ).toBe(false);
  });

  it('accepts institution-supplied credit bounds', () => {
    expect(
      createAcademicPolicy({
        ...VALID,
        termCreditBounds: { minCreditsHundredths: 1200, maxCreditsHundredths: 1800 },
      }).termCreditBounds,
    ).toEqual({ minCreditsHundredths: 1200, maxCreditsHundredths: 1800 });
  });

  it('accepts credit bounds whose minimum equals the maximum', () => {
    expect(
      createAcademicPolicy({
        ...VALID,
        termCreditBounds: { minCreditsHundredths: 1250, maxCreditsHundredths: 1250 },
      }).termCreditBounds,
    ).toEqual({ minCreditsHundredths: 1250, maxCreditsHundredths: 1250 });
  });

  it('rejects credit bounds whose minimum is above the maximum', () => {
    const result = AcademicPolicySchema.safeParse({
      ...VALID,
      termCreditBounds: { minCreditsHundredths: 1801, maxCreditsHundredths: 1800 },
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ['termCreditBounds', 'minCreditsHundredths'],
    ]);
    expect(result.error?.issues[0]?.message).toMatch(
      /minCreditsHundredths must not be greater than maxCreditsHundredths/,
    );
  });

  it.each([
    [{ minCreditsHundredths: -100, maxCreditsHundredths: 1800 }],
    [{ minCreditsHundredths: 1200, maxCreditsHundredths: 1800.5 }],
    [{ minCreditsHundredths: 1200 }],
  ])('rejects the credit bounds %j', (termCreditBounds) => {
    expect(() =>
      createAcademicPolicy({
        ...VALID,
        termCreditBounds: termCreditBounds as AcademicPolicyInput['termCreditBounds'],
      }),
    ).toThrow();
  });

  it('rejects an empty letter order', () => {
    expect(() => createAcademicPolicy({ ...VALID, letterGradeOrder: [] })).toThrow();
  });

  it('rejects an empty rulesetVersion', () => {
    expect(() => createAcademicPolicy({ ...VALID, rulesetVersion: '' })).toThrow();
  });
});

describe('AcademicPolicySchema', () => {
  it('rejects P in the letter order, because P is never a letter grade', () => {
    expect(AcademicPolicySchema.safeParse({ ...VALID, letterGradeOrder: ['A', 'P'] }).success).toBe(
      false,
    );
  });

  it('rejects an omitted passSatisfiesMinimumGrade, because unknown must be an explicit null', () => {
    const result = AcademicPolicySchema.safeParse({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: true,
      letterGradeOrder: ['A'],
      lowestPassingLetterGrade: null,
      repeatPolicy: null,
      termCreditBounds: null,
    });

    expect(result.success).toBe(false);
  });

  it('rejects an omitted repeatPolicy, because unknown must be an explicit null', () => {
    const result = AcademicPolicySchema.safeParse({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A'],
      lowestPassingLetterGrade: null,
      termCreditBounds: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['repeatPolicy']]);
  });

  it('rejects an omitted lowestPassingLetterGrade, because unknown must be an explicit null', () => {
    const result = AcademicPolicySchema.safeParse({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A'],
      repeatPolicy: null,
      termCreditBounds: null,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['lowestPassingLetterGrade']]);
  });

  it('rejects omitted credit bounds, because unknown must be an explicit null', () => {
    const { termCreditBounds: omitted, ...withoutBounds } = VALID;

    expect(omitted).toBeNull();
    expect(
      AcademicPolicySchema.safeParse(withoutBounds).error?.issues.map((issue) => issue.path),
    ).toEqual([['termCreditBounds']]);
  });

  it('rejects a string in place of a boolean switch', () => {
    expect(
      AcademicPolicySchema.safeParse({ ...VALID, allowsInProgressPrerequisites: 'yes' }).success,
    ).toBe(false);
  });
});
