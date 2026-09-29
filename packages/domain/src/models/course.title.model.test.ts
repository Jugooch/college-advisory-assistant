/**
 * @file Tests for the course catalog title.
 */
import { describe, expect, it } from 'vitest';

import { type CourseInput, createCourse } from './course.model';

/** A course from a producer that doesn't set the title yet (staged rollout, #241). */
const WITHOUT_TITLE: CourseInput = {
  id: '3c4d5e6f-0000-4000-8000-000000000101',
  tenantId: '0b8f6a36-3f7e-4a53-9c1e-8f1b2c3d4e5f',
  sourceCourseId: 'DEMO-MATH-101',
  label: 'DEMO-MATH 101',
  creditsHundredths: 300,
  minCreditsHundredths: null,
  maxCreditsHundredths: null,
  equivalencyGroupId: null,
  creditsIncludedInCourseId: null,
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

  it('accepts an omitted title during the staged rollout, and keeps it omitted', () => {
    expect('title' in createCourse(WITHOUT_TITLE)).toBe(false);
  });

  it('rejects an empty title, because unknown is an explicit null', () => {
    expect(() => createCourse({ ...WITHOUT_TITLE, title: '' })).toThrow();
  });
});
