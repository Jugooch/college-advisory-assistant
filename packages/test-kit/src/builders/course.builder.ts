/**
 * @file Builds synthetic catalog courses for tests, with fixed or variable credit.
 * @module @caa/test-kit/builders/course
 * @see packages/test-kit/src/fixtures/synthetic-courses.ts
 */
import { type Course, type CourseInput, createCourse } from '@caa/domain';

import { syntheticId } from '../fixtures/synthetic-id';
import { SYNTHETIC_TENANTS } from '../fixtures/synthetic-tenants';

/**
 * Builds a valid fixed-credit course (3.00 credits) in tenant A with no equivalents.
 *
 * The default label is `DEMO-GEN` plus the seed padded to three digits, for example
 * `DEMO-GEN 001`. The default `title` is `null`, meaning the catalog supplies none. To refer to a named course, use `SYNTHETIC_COURSES` instead.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes courses; drives the default `id`, `sourceCourseId`, and `label`.
 * @returns A validated course.
 */
export function buildCourse(overrides: Partial<CourseInput> = {}, seed = 1): Course {
  const number = String(seed).padStart(3, '0');
  return createCourse({
    id: syntheticId('course', seed),
    tenantId: SYNTHETIC_TENANTS.a.id,
    sourceCourseId: `DEMO-GEN-${number}`,
    label: `DEMO-GEN ${number}`,
    title: null,
    creditsHundredths: 300,
    minCreditsHundredths: null,
    maxCreditsHundredths: null,
    equivalencyGroupId: null,
    creditsIncludedInCourseId: null,
    ...overrides,
  });
}

/**
 * Builds a valid variable-credit course, 1.00 to 3.00 credits, otherwise like
 * {@link buildCourse}.
 *
 * @param overrides - Fields to replace in the default.
 * @param seed - Distinguishes courses; drives the default `id`, `sourceCourseId`, and `label`.
 * @returns A validated course with `creditsHundredths: null` and both bounds set.
 */
export function buildVariableCreditCourse(overrides: Partial<CourseInput> = {}, seed = 1): Course {
  return buildCourse(
    {
      creditsHundredths: null,
      minCreditsHundredths: 100,
      maxCreditsHundredths: 300,
      ...overrides,
    },
    seed,
  );
}
