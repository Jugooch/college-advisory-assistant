/**
 * @file Tests for the academic policy row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { LetterGrade, RepeatPolicy } from '@caa/domain';

import type { AcademicPolicyRow } from '../tables/academic-policy.table';
import { toAcademicPolicy } from './academic-policy.mapper';

const ROW: AcademicPolicyRow = {
  id: '8192a3b4-c5d6-4e7f-8081-92a3b4c5d6e7',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  rulesetVersion: 'demo-2026.1',
  allowsInProgressPrerequisites: false,
  passSatisfiesMinimumGrade: null,
  letterGradeOrder: [LetterGrade.A, LetterGrade.B, LetterGrade.C, LetterGrade.D, LetterGrade.F],
  lowestPassingLetterGrade: null,
  repeatPolicy: null,
  termMinCreditsHundredths: null,
  termMaxCreditsHundredths: null,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toAcademicPolicy', () => {
  it('keeps every unsupplied setting as null, including the credit bounds', () => {
    const policy = toAcademicPolicy(ROW);

    expect(policy).toEqual({
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: false,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      lowestPassingLetterGrade: null,
      repeatPolicy: null,
      termCreditBounds: null,
    });
  });

  it('rebuilds the credit bounds and supplied settings', () => {
    const policy = toAcademicPolicy({
      ...ROW,
      passSatisfiesMinimumGrade: true,
      lowestPassingLetterGrade: LetterGrade.D,
      repeatPolicy: RepeatPolicy.MostRecent,
      termMinCreditsHundredths: 1200,
      termMaxCreditsHundredths: 1800,
    });

    expect(policy.termCreditBounds).toEqual({
      minCreditsHundredths: 1200,
      maxCreditsHundredths: 1800,
    });
    expect(policy.passSatisfiesMinimumGrade).toBe(true);
    expect(policy.lowestPassingLetterGrade).toBe('D');
    expect(policy.repeatPolicy).toBe('MOST_RECENT');
  });

  it('rejects a stored row with only one credit bound', () => {
    expect(() => toAcademicPolicy({ ...ROW, termMinCreditsHundredths: 1200 })).toThrow(ZodError);
  });

  it('rejects stored credit bounds with the minimum above the maximum', () => {
    expect(() =>
      toAcademicPolicy({ ...ROW, termMinCreditsHundredths: 1900, termMaxCreditsHundredths: 1800 }),
    ).toThrow(ZodError);
  });

  it('rejects a stored grade order with a letter the domain does not know', () => {
    const letterGradeOrder = ['A', 'E'] as AcademicPolicyRow['letterGradeOrder'];

    expect(() => toAcademicPolicy({ ...ROW, letterGradeOrder })).toThrow(ZodError);
  });
});
