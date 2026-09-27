/**
 * @file Tests for the synthetic academic policy builder.
 */
import { describe, expect, it } from 'vitest';

import { AcademicPolicySchema, RepeatPolicy } from '@caa/domain';

import { buildAcademicPolicy } from './academic-policy.builder';

describe('buildAcademicPolicy', () => {
  it('defaults to the conservative policy with the full synthetic grade order', () => {
    expect(buildAcademicPolicy()).toEqual({
      tenantId: '10000000-0000-4000-8000-000000000001',
      rulesetVersion: 'demo-2026.1',
      allowsInProgressPrerequisites: false,
      passSatisfiesMinimumGrade: null,
      letterGradeOrder: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'],
      repeatPolicy: null,
      lowestPassingLetterGrade: null,
    });
  });

  it('returns deep-equal policies for the same arguments', () => {
    expect(buildAcademicPolicy({ passSatisfiesMinimumGrade: true })).toEqual(
      buildAcademicPolicy({ passSatisfiesMinimumGrade: true }),
    );
  });

  it('applies overrides', () => {
    const policy = buildAcademicPolicy({
      allowsInProgressPrerequisites: true,
      passSatisfiesMinimumGrade: false,
      letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
      repeatPolicy: RepeatPolicy.HighestGrade,
    });

    expect(policy.allowsInProgressPrerequisites).toBe(true);
    expect(policy.passSatisfiesMinimumGrade).toBe(false);
    expect(policy.letterGradeOrder).toEqual(['A', 'B', 'C', 'D', 'F']);
    expect(policy.repeatPolicy).toBe('HIGHEST_GRADE');
  });

  it('returns a policy that passes the domain schema', () => {
    expect(AcademicPolicySchema.safeParse(buildAcademicPolicy()).success).toBe(true);
  });

  it('rejects a grade order that repeats a letter', () => {
    expect(() => buildAcademicPolicy({ letterGradeOrder: ['A', 'B', 'A'] })).toThrow();
  });
});
