/**
 * @file Tests for the synthetic course builders.
 */
import { describe, expect, it } from 'vitest';

import { CourseSchema } from '@caa/domain';

import { buildCourse, buildVariableCreditCourse } from './course.builder';

describe('buildCourse', () => {
  it('defaults to a 3-credit course in tenant A with no equivalents', () => {
    expect(buildCourse()).toEqual({
      id: '50000000-0000-4000-8000-000000000001',
      tenantId: '10000000-0000-4000-8000-000000000001',
      sourceCourseId: 'DEMO-GEN-001',
      label: 'DEMO-GEN 001',
      creditsHundredths: 300,
      minCreditsHundredths: null,
      maxCreditsHundredths: null,
      equivalencyGroupId: null,
      creditsIncludedInCourseId: null,
    });
  });

  it('returns deep-equal courses for the same arguments', () => {
    expect(buildCourse({ creditsHundredths: 400 }, 9)).toEqual(
      buildCourse({ creditsHundredths: 400 }, 9),
    );
  });

  it('derives the id, source ID, and label from the seed', () => {
    const course = buildCourse({}, 12);

    expect(course.id).toBe('50000000-0000-4000-8000-00000000000c');
    expect(course.sourceCourseId).toBe('DEMO-GEN-012');
    expect(course.label).toBe('DEMO-GEN 012');
  });

  it('applies overrides', () => {
    const course = buildCourse({
      creditsHundredths: 150,
      equivalencyGroupId: '90000000-0000-4000-8000-000000000002',
    });

    expect(course.creditsHundredths).toBe(150);
    expect(course.equivalencyGroupId).toBe('90000000-0000-4000-8000-000000000002');
  });

  it('returns a course that passes the domain schema', () => {
    expect(CourseSchema.safeParse(buildCourse()).success).toBe(true);
  });

  it('rejects a course that mixes fixed and variable credit', () => {
    expect(() => buildCourse({ minCreditsHundredths: 100 })).toThrow();
  });
});

describe('buildVariableCreditCourse', () => {
  it('defaults to 1 to 3 credits with no fixed value', () => {
    const course = buildVariableCreditCourse();

    expect(course.creditsHundredths).toBeNull();
    expect(course.minCreditsHundredths).toBe(100);
    expect(course.maxCreditsHundredths).toBe(300);
  });

  it('returns deep-equal courses for the same arguments', () => {
    expect(buildVariableCreditCourse({}, 4)).toEqual(buildVariableCreditCourse({}, 4));
  });

  it('applies overrides', () => {
    expect(buildVariableCreditCourse({ maxCreditsHundredths: 600 }).maxCreditsHundredths).toBe(600);
  });

  it('returns a course that passes the domain schema', () => {
    expect(CourseSchema.safeParse(buildVariableCreditCourse()).success).toBe(true);
  });

  it('rejects an inverted credit range', () => {
    expect(() =>
      buildVariableCreditCourse({ minCreditsHundredths: 400, maxCreditsHundredths: 300 }),
    ).toThrow();
  });
});
