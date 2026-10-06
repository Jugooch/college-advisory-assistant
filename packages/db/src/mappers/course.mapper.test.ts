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
  title: 'Demo Calculus I',
  creditsHundredths: 300,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: null,
  creditsIncludedInCourseId: null,
  repeatableForCredit: false,
  repeatMaxAttempts: null,
  repeatMaxCreditsHundredths: null,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

const LECTURE_ID = '5e6f7081-92a3-4b4c-8d5e-6f708192a3b4';

describe('toCourse', () => {
  it('keeps only the domain fields of a fixed-credit course', () => {
    const course = toCourse(ROW);

    expect(course).toEqual({
      id: '3c4d5e6f-7081-4a92-8b3c-4d5e6f708192',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceCourseId: 'DEMO-MATH-101',
      label: 'DEMO-MATH 101',
      title: 'Demo Calculus I',
      creditsHundredths: 300,
      minCreditsHundredths: null,
      maxCreditsHundredths: null,
      equivalencyGroupId: null,
      creditsIncludedInCourseId: null,
      repeatableForCredit: null,
    });
  });

  it('maps a repeatable row with caps to its statement', () => {
    const row = {
      ...ROW,
      repeatableForCredit: true,
      repeatMaxAttempts: 4,
      repeatMaxCreditsHundredths: 400,
    };

    expect(toCourse(row).repeatableForCredit).toEqual({
      maxAttempts: 4,
      maxCreditsHundredths: 400,
    });
  });

  it('maps a repeatable row with no caps to null caps', () => {
    expect(toCourse({ ...ROW, repeatableForCredit: true }).repeatableForCredit).toEqual({
      maxAttempts: null,
      maxCreditsHundredths: null,
    });
  });

  it('fails loudly when the stored credit cap is below one attempt', () => {
    const row = {
      ...ROW,
      repeatableForCredit: true,
      repeatMaxCreditsHundredths: 200,
    };

    expect(() => toCourse(row)).toThrow(ZodError);
  });

  it('keeps a null title as null, meaning the catalog supplies none', () => {
    expect(toCourse({ ...ROW, title: null }).title).toBeNull();
  });

  it('rejects a stored empty title', () => {
    expect(() => toCourse({ ...ROW, title: '' })).toThrow(ZodError);
  });

  it('keeps the course whose credit total includes this one', () => {
    const course = toCourse({ ...ROW, creditsIncludedInCourseId: LECTURE_ID });

    expect(course.creditsIncludedInCourseId).toBe(LECTURE_ID);
  });

  it('rejects a stored course whose credits are included in itself', () => {
    expect(() => toCourse({ ...ROW, creditsIncludedInCourseId: ROW.id })).toThrow(ZodError);
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
