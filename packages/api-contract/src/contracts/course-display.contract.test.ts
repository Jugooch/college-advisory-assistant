/**
 * @file Tests for the course display fields: code, title, and credit rule.
 */
import { describe, expect, it } from 'vitest';

import {
  CourseDisplayListSchema,
  CourseDisplaySchema,
  CreditRuleSchema,
} from './course-display.contract';

const FIXED = { kind: 'FIXED', creditsHundredths: 400 };
const VARIABLE = { kind: 'VARIABLE', minCreditsHundredths: 100, maxCreditsHundredths: 300 };
const CALCULUS = {
  courseId: '00000000-0000-4000-8000-000000000101',
  code: 'MATH 101',
  title: 'Calculus I',
  credits: FIXED,
};
const RESEARCH = {
  courseId: '00000000-0000-4000-8000-000000000102',
  code: 'MATH 390',
  title: null,
  credits: VARIABLE,
};

describe('CreditRuleSchema', () => {
  it('accepts a fixed and a variable rule unchanged', () => {
    expect(CreditRuleSchema.parse(FIXED)).toEqual({ kind: 'FIXED', creditsHundredths: 400 });
    expect(CreditRuleSchema.parse(VARIABLE)).toEqual({
      kind: 'VARIABLE',
      minCreditsHundredths: 100,
      maxCreditsHundredths: 300,
    });
  });

  it('accepts a variable range whose bounds are equal', () => {
    const single = { kind: 'VARIABLE', minCreditsHundredths: 200, maxCreditsHundredths: 200 };

    expect(CreditRuleSchema.safeParse(single).success).toBe(true);
  });

  it.each([
    ['an inverted range', { ...VARIABLE, minCreditsHundredths: 301 }],
    ['a fractional hundredth', { ...FIXED, creditsHundredths: 350.5 }],
    ['negative credits', { ...FIXED, creditsHundredths: -100 }],
    ['unknown fixed credits', { ...FIXED, creditsHundredths: null }],
    ['a variable rule without a maximum', { kind: 'VARIABLE', minCreditsHundredths: 100 }],
    [
      'a fixed rule with only a range',
      { kind: 'FIXED', minCreditsHundredths: 100, maxCreditsHundredths: 300 },
    ],
    ['an unknown kind', { ...FIXED, kind: 'ANY' }],
  ])('rejects %s', (_case, rule) => {
    expect(CreditRuleSchema.safeParse(rule).success).toBe(false);
  });
});

describe('CourseDisplaySchema', () => {
  it('accepts a course with a title, and one whose title the catalog does not supply', () => {
    expect(CourseDisplaySchema.parse(CALCULUS)).toEqual(CALCULUS);
    expect(CourseDisplaySchema.parse(RESEARCH).title).toBeNull();
  });

  it.each([
    ['an empty code', { ...CALCULUS, code: '' }],
    ['an empty title', { ...CALCULUS, title: '' }],
    ['a missing title', { courseId: CALCULUS.courseId, code: 'MATH 101', credits: FIXED }],
    ['a non-UUID course ID', { ...CALCULUS, courseId: 'MATH-101' }],
    ['no credit rule', { ...CALCULUS, credits: null }],
  ])('rejects %s', (_case, course) => {
    expect(CourseDisplaySchema.safeParse(course).success).toBe(false);
  });
});

describe('CourseDisplayListSchema', () => {
  it('accepts distinct courses and an empty list', () => {
    expect(CourseDisplayListSchema.parse([CALCULUS, RESEARCH])).toHaveLength(2);
    expect(CourseDisplayListSchema.parse([])).toEqual([]);
  });

  it('rejects two entries for one course', () => {
    const renamed = { ...CALCULUS, title: 'Calculus I (honors)' };

    expect(CourseDisplayListSchema.safeParse([CALCULUS, renamed]).success).toBe(false);
  });
});
