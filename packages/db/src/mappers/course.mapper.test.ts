/**
 * @file Tests for the course row mapper.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type { CourseRow } from '../tables/course.table';
import { toCourse } from './course.mapper';

const ROW: CourseRow = {
  id: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCourseId: 'DEMO-MATH-101',
  label: 'DEMO-MATH 101',
  creditsHundredths: 300,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: null,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('toCourse', () => {
  it('keeps only the domain fields of a fixed-credit course', () => {
    const course = toCourse(ROW);

    expect(course).toEqual({
      id: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceCourseId: 'DEMO-MATH-101',
      label: 'DEMO-MATH 101',
      creditsHundredths: 300,
      minCreditsHundredths: null,
      maxCreditsHundredths: null,
      equivalencyGroupId: null,
    });
  });

  it('keeps a variable credit range and its equivalency group', () => {
    const course = toCourse({
      ...ROW,
      creditsHundredths: null,
      minCreditsHundredths: 100,
      maxCreditsHundredths: 400,
      equivalencyGroupId: '4d5e6f70-8192-4a3b-9c4d-5e6f708192a3',
    });

    expect(course.minCreditsHundredths).toBe(100);
    expect(course.maxCreditsHundredths).toBe(400);
    expect(course.equivalencyGroupId).toBe('4d5e6f70-8192-4a3b-9c4d-5e6f708192a3');
  });

  it('rejects a stored row with both fixed and variable credits', () => {
    expect(() =>
      toCourse({ ...ROW, minCreditsHundredths: 100, maxCreditsHundredths: 400 }),
    ).toThrow(ZodError);
  });
});
