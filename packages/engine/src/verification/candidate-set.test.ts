/**
 * @file Tests for candidate-set validation and the credits each selection carries.
 */
import { describe, expect, it } from 'vitest';

import type { Course } from '@caa/domain';
import { buildVariableCreditCourse, SYNTHETIC_COURSES } from '@caa/test-kit';

import {
  assertValidCandidateSet,
  CandidateSetInputError,
  type CourseSelection,
  maxCreditsOf,
  selectedCreditsOf,
} from './candidate-set';

const { math101, math111, math102, ind390 } = SYNTHETIC_COURSES;

/**
 * Builds a credit-bearing selection.
 *
 * @param course - The course.
 * @param selectedCreditsHundredths - The chosen credit value, or `null`.
 * @returns The selection.
 */
function select(course: Course, selectedCreditsHundredths: number | null = null): CourseSelection {
  return { course, selectedCreditsHundredths, countsCredits: true };
}

describe('selectedCreditsOf', () => {
  it('returns a fixed course credits with or without a matching selection', () => {
    expect(selectedCreditsOf(select(math102))).toBe(300);
    expect(selectedCreditsOf(select(math102, 300))).toBe(300);
  });

  it('returns null for a variable-credit course with no chosen value', () => {
    expect(selectedCreditsOf(select(ind390))).toBeNull();
  });

  it('returns the chosen value of a variable-credit course', () => {
    expect(selectedCreditsOf(select(ind390, 150))).toBe(150);
  });

  it.each([
    ['a fixed course with a different value', select(math102, 400)],
    ['a value below the range', select(ind390, 99)],
    ['a value above the range', select(ind390, 301)],
    ['a fractional value', select(ind390, 150.5)],
    [
      'a value on a course whose range starts above zero',
      select(buildVariableCreditCourse({ minCreditsHundredths: 200 }), 100),
    ],
  ])('rejects %s', (_label, selection) => {
    expect(() => selectedCreditsOf(selection)).toThrow(
      new CandidateSetInputError('selectedCredits'),
    );
  });
});

describe('selectedCreditsOf with a course that bypassed the schema', () => {
  it.each([
    ['minimum', { ...ind390, minCreditsHundredths: null }],
    ['maximum', { ...ind390, maxCreditsHundredths: null }],
  ])('rejects a variable-credit course without a %s', (_label, course) => {
    expect(() => selectedCreditsOf(select(course))).toThrow(
      new CandidateSetInputError('courseCredits'),
    );
  });
});

describe('maxCreditsOf', () => {
  it('is the course maximum for an unchosen variable-credit value', () => {
    expect(maxCreditsOf(select(ind390))).toBe(300);
  });

  it('is the chosen or fixed value otherwise', () => {
    expect(maxCreditsOf(select(ind390, 100))).toBe(100);
    expect(maxCreditsOf(select(math102))).toBe(300);
  });
});

describe('assertValidCandidateSet', () => {
  it('accepts distinct, non-equivalent courses', () => {
    expect(() => {
      assertValidCandidateSet([select(math101), select(math102), select(ind390, 200)]);
    }).not.toThrow();
  });

  it('rejects two courses of one equivalency group, since aliases never earn separate credit', () => {
    expect(() => {
      assertValidCandidateSet([select(math101), select(math111)]);
    }).toThrow(new CandidateSetInputError('equivalentCourses'));
  });

  it('rejects an invalid selected value anywhere in the set', () => {
    expect(() => {
      assertValidCandidateSet([select(math102), select(ind390, 0)]);
    }).toThrow(new CandidateSetInputError('selectedCredits'));
  });

  it('names the issue on the error', () => {
    expect(new CandidateSetInputError('bounds')).toMatchObject({
      name: 'CandidateSetInputError',
      issue: 'bounds',
      message: 'Candidate set input is invalid: bounds',
    });
  });
});
