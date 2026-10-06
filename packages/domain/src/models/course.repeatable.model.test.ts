/**
 * @file Tests for a course's repeatable-for-credit statement (AC04).
 */
import { describe, expect, it } from 'vitest';

import { type CourseInput, CourseSchema, createCourse } from './course.model';

/** A course from a producer that doesn't set the field yet (staged rollout, #267). */
const ENSEMBLE: CourseInput = {
  id: '3c4d5e6f-0000-4000-8000-000000000150',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCourseId: 'DEMO-MUS-150',
  label: 'DEMO-MUS 150',
  title: null,
  creditsHundredths: 100,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: null,
  creditsIncludedInCourseId: null,
};

const CAP_MESSAGE = "repeatableForCredit.maxCreditsHundredths must cover one attempt's credits";

describe('createCourse repeatableForCredit', () => {
  it('accepts a course repeatable for credit with both caps', () => {
    const course = createCourse({
      ...ENSEMBLE,
      repeatableForCredit: { maxAttempts: 4, maxCreditsHundredths: 400 },
    });

    expect(course.repeatableForCredit).toEqual({ maxAttempts: 4, maxCreditsHundredths: 400 });
  });

  it('accepts a course repeatable for credit with no stated cap', () => {
    const course = createCourse({
      ...ENSEMBLE,
      repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: null },
    });

    expect(course.repeatableForCredit).toEqual({ maxAttempts: null, maxCreditsHundredths: null });
  });

  it('accepts null, meaning only one attempt counts (AC04)', () => {
    expect(createCourse({ ...ENSEMBLE, repeatableForCredit: null }).repeatableForCredit).toBeNull();
  });

  it('accepts an omitted value during the staged rollout, and keeps it omitted', () => {
    expect('repeatableForCredit' in createCourse(ENSEMBLE)).toBe(false);
  });

  it.each([
    { maxAttempts: 1, maxCreditsHundredths: null },
    { maxAttempts: 2.5, maxCreditsHundredths: null },
    { maxAttempts: null, maxCreditsHundredths: 0 },
    { maxAttempts: null, maxCreditsHundredths: 150.5 },
  ])('rejects the caps %j', (repeatableForCredit) => {
    expect(() => createCourse({ ...ENSEMBLE, repeatableForCredit })).toThrow();
  });

  it('rejects a credit cap below one attempt of a fixed-credit course', () => {
    const result = CourseSchema.safeParse({
      ...ENSEMBLE,
      creditsHundredths: 300,
      repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: 200 },
    });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([CAP_MESSAGE]);
  });

  it('checks a variable-credit course against its minimum credits', () => {
    const variable = {
      ...ENSEMBLE,
      creditsHundredths: null,
      minCreditsHundredths: 100,
      maxCreditsHundredths: 300,
    };

    expect(
      createCourse({
        ...variable,
        repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: 100 },
      }).repeatableForCredit?.maxCreditsHundredths,
    ).toBe(100);
    expect(() =>
      createCourse({
        ...variable,
        repeatableForCredit: { maxAttempts: null, maxCreditsHundredths: 50 },
      }),
    ).toThrow(CAP_MESSAGE);
  });
});
