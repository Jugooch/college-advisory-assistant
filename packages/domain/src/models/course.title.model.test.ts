/**
 * @file Tests for the course catalog title.
 */
import { describe, expect, it } from 'vitest';

import { type CourseInput, createCourse } from './course.model';

/** A course input with the title omitted; each test sets it explicitly. */
const WITHOUT_TITLE: Omit<CourseInput, 'title'> = {
  id: '3c4d5e6f-0000-4000-8000-000000000101',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCourseId: 'DEMO-MATH-101',
  label: 'DEMO-MATH 101',
  creditsHundredths: 300,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: null,
  creditsIncludedInCourseId: null,
  repeatableForCredit: null,
};

describe('createCourse title', () => {
  it('accepts a catalog title', () => {
    expect(createCourse({ ...WITHOUT_TITLE, title: 'Demo Calculus I' }).title).toBe(
      'Demo Calculus I',
    );
  });

  it('accepts null, meaning the catalog supplies no title', () => {
    expect(createCourse({ ...WITHOUT_TITLE, title: null }).title).toBeNull();
  });

  it('rejects an omitted title, because the key is required', () => {
    expect(() => createCourse(WITHOUT_TITLE as CourseInput)).toThrow();
  });

  it('rejects an empty title, because unknown is an explicit null', () => {
    expect(() => createCourse({ ...WITHOUT_TITLE, title: '' })).toThrow();
  });
});
