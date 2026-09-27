/**
 * @file Tests for ranking a letter grade by the institution's letter order.
 */
import { describe, expect, it } from 'vitest';

import { buildAcademicPolicy } from '@caa/test-kit';

import { rankLetterGrade } from './rank-letter-grade';

const POLICY = buildAcademicPolicy({ letterGradeOrder: ['A', 'B', 'C', 'D', 'F'] });

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
