/**
 * @file Tests for the course data object.
 */
import { describe, expect, it } from 'vitest';

import { type CourseInput, CourseSchema, createCourse } from './course.model';

const FIXED: CourseInput = {
  id: '3c4d5e6f-0000-4000-8000-000000000001',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCourseId: 'DEMO-C-MATH101',
  label: 'MATH 101',
  creditsHundredths: 350,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: '4d5e6f70-0000-4000-8000-000000000001',
};

const VARIABLE: CourseInput = {
  ...FIXED,
  creditsHundredths: null,
  minCreditsHundredths: 100,
  maxCreditsHundredths: 400,
};

describe('createCourse', () => {
  it('accepts a fixed-credit course', () => {
    expect(createCourse(FIXED)).toEqual({
      id: '3c4d5e6f-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceCourseId: 'DEMO-C-MATH101',
      label: 'MATH 101',
      creditsHundredths: 350,
      minCreditsHundredths: null,
      maxCreditsHundredths: null,
      equivalencyGroupId: '4d5e6f70-0000-4000-8000-000000000001',
    });
  });

  it('accepts a variable-credit course with min below max', () => {
    const course = createCourse(VARIABLE);

    expect(course.creditsHundredths).toBeNull();
    expect(course.minCreditsHundredths).toBe(100);
    expect(course.maxCreditsHundredths).toBe(400);
  });

  it('accepts a variable-credit course with min equal to max', () => {
    expect(
      createCourse({ ...VARIABLE, minCreditsHundredths: 300, maxCreditsHundredths: 300 })
        .maxCreditsHundredths,
    ).toBe(300);
  });

  it('accepts a zero-credit course', () => {
    expect(createCourse({ ...FIXED, creditsHundredths: 0 }).creditsHundredths).toBe(0);
  });

  it('accepts a null equivalencyGroupId for a course with no equivalents', () => {
    expect(createCourse({ ...FIXED, equivalencyGroupId: null }).equivalencyGroupId).toBeNull();
  });

  it('rejects a course with both a fixed value and a range', () => {
    expect(() =>
      createCourse({ ...FIXED, minCreditsHundredths: 100, maxCreditsHundredths: 400 }),
    ).toThrow(/either creditsHundredths or both/);
  });

  it('rejects a fixed course with only a minimum bound', () => {
    expect(() => createCourse({ ...FIXED, minCreditsHundredths: 100 })).toThrow(
      /either creditsHundredths or both/,
    );
  });

  it('rejects a course with no credit form at all', () => {
    expect(() =>
      createCourse({ ...VARIABLE, minCreditsHundredths: null, maxCreditsHundredths: null }),
    ).toThrow(/either creditsHundredths or both/);
  });

  it('rejects a variable course with only a maximum bound', () => {
    expect(() => createCourse({ ...VARIABLE, minCreditsHundredths: null })).toThrow(
      /either creditsHundredths or both/,
    );
  });

  it('rejects a variable course whose min exceeds its max', () => {
    expect(() =>
      createCourse({ ...VARIABLE, minCreditsHundredths: 400, maxCreditsHundredths: 100 }),
    ).toThrow(/must not exceed/);
  });

  it('rejects fractional credits, because credits are scaled integers', () => {
    expect(() => createCourse({ ...FIXED, creditsHundredths: 3.5 })).toThrow();
  });

  it('rejects fractional variable-credit bounds', () => {
    expect(() => createCourse({ ...VARIABLE, maxCreditsHundredths: 400.5 })).toThrow();
  });

  it('rejects negative credits', () => {
    expect(() => createCourse({ ...FIXED, creditsHundredths: -100 })).toThrow();
  });

  it('rejects an empty sourceCourseId', () => {
    expect(() => createCourse({ ...FIXED, sourceCourseId: '' })).toThrow();
  });

  it('rejects an empty label', () => {
    expect(() => createCourse({ ...FIXED, label: '' })).toThrow();
  });

  it('rejects an id that is not a UUID', () => {
    expect(() => createCourse({ ...FIXED, id: 'MATH 101' })).toThrow();
  });

  it('rejects an equivalencyGroupId that is not a UUID', () => {
    expect(() => createCourse({ ...FIXED, equivalencyGroupId: 'MATH-EQ' })).toThrow();
  });
});

describe('CourseSchema', () => {
  it('rejects omitted range fields, because unknown must be an explicit null', () => {
    const result = CourseSchema.safeParse({
      id: '3c4d5e6f-0000-4000-8000-000000000001',
      tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
      sourceCourseId: 'DEMO-C-MATH101',
      label: 'MATH 101',
      creditsHundredths: 350,
      equivalencyGroupId: null,
    });

    expect(result.success).toBe(false);
  });

  it('reports the inverted range on minCreditsHundredths', () => {
    const result = CourseSchema.safeParse({
      ...VARIABLE,
      minCreditsHundredths: 400,
      maxCreditsHundredths: 100,
    });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['minCreditsHundredths']]);
  });
});
