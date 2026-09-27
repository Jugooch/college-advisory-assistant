/**
 * @file Tests for the fixed synthetic course catalog.
 */
import { describe, expect, it } from 'vitest';

import { CourseSchema } from '@caa/domain';

import { SYNTHETIC_COURSES, SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID } from './synthetic-courses';

describe('SYNTHETIC_COURSES', () => {
  it('defines DEMO-MATH 101 with a fixed ID, 3 credits, and the math equivalency group', () => {
    expect(SYNTHETIC_COURSES.math101).toEqual({
      id: '50000000-0000-4000-8000-000000000101',
      tenantId: '10000000-0000-4000-8000-000000000001',
      sourceCourseId: 'DEMO-MATH-101',
      label: 'DEMO-MATH 101',
      creditsHundredths: 300,
      minCreditsHundredths: null,
      maxCreditsHundredths: null,
      equivalencyGroupId: '90000000-0000-4000-8000-000000000001',
    });
  });

  it('puts DEMO-MATH 111 in the same equivalency group as DEMO-MATH 101', () => {
    expect(SYNTHETIC_COURSES.math111.id).toBe('50000000-0000-4000-8000-000000000111');
    expect(SYNTHETIC_COURSES.math111.equivalencyGroupId).toBe(
      '90000000-0000-4000-8000-000000000001',
    );
    expect(SYNTHETIC_MATH_EQUIVALENCY_GROUP_ID).toBe('90000000-0000-4000-8000-000000000001');
  });

  it('lists the stable ID, label, and credits of every course', () => {
    const summary = Object.values(SYNTHETIC_COURSES).map((course) => [
      course.id,
      course.label,
      course.creditsHundredths,
      course.equivalencyGroupId,
    ]);

    expect(summary).toEqual([
      [
        '50000000-0000-4000-8000-000000000101',
        'DEMO-MATH 101',
        300,
        '90000000-0000-4000-8000-000000000001',
      ],
      [
        '50000000-0000-4000-8000-000000000111',
        'DEMO-MATH 111',
        300,
        '90000000-0000-4000-8000-000000000001',
      ],
      ['50000000-0000-4000-8000-000000000102', 'DEMO-MATH 102', 300, null],
      ['50000000-0000-4000-8000-000000000201', 'DEMO-PHYS 201', 400, null],
      ['50000000-0000-4000-8000-000000002010', 'DEMO-PHYS 201L', 100, null],
      ['50000000-0000-4000-8000-000000000390', 'DEMO-IND 390', null, null],
    ]);
  });

  it('defines DEMO-IND 390 as a 1 to 3 credit variable-credit course', () => {
    expect(SYNTHETIC_COURSES.ind390.minCreditsHundredths).toBe(100);
    expect(SYNTHETIC_COURSES.ind390.maxCreditsHundredths).toBe(300);
  });

  it('gives every course a valid domain course', () => {
    expect(
      Object.values(SYNTHETIC_COURSES).every((course) => CourseSchema.safeParse(course).success),
    ).toBe(true);
  });
});
