/**
 * @file Tests for ranking a letter grade by the institution's letter order.
 */
import { describe, expect, it } from 'vitest';

import { createAcademicPolicy } from '@caa/domain';

import { rankLetterGrade } from './rank-letter-grade';

// NOTE: @caa/test-kit has no builder for academic policies yet (#53), so this uses the domain
// factory directly.
const POLICY = createAcademicPolicy({
  tenantId: '00000000-0000-4000-8000-000000000001',
  rulesetVersion: 'demo-2026.1',
  allowsInProgressPrerequisites: true,
  passSatisfiesMinimumGrade: null,
  letterGradeOrder: ['A', 'B', 'C', 'D', 'F'],
  repeatPolicy: null,
});

describe('rankLetterGrade', () => {
  it('ranks the highest letter in the order highest', () => {
    expect(rankLetterGrade('A', POLICY)).toBe(5);
  });

  it('ranks the lowest letter in the order lowest', () => {
    expect(rankLetterGrade('F', POLICY)).toBe(1);
  });

  it('returns null for a letter missing from the order', () => {
    expect(rankLetterGrade('B+', POLICY)).toBeNull();
  });
});
