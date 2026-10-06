/**
 * @file Decides which courses of a plan's bundles add their credits, so included credits count once.
 * @module @caa/engine/scheduling/section-bundle-credits
 * @requirement FR-06
 * @requirement FR-07
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { Course, CourseId, Section } from '@caa/domain';

import type { CourseSelection } from '../verification/candidate-set';
import { ScheduleInputError } from './schedule-input-error';

/**
 * Lists each distinct course of a bundle, in the order its first section appears.
 *
 * @param sections - The bundle's sections, the requested course's section first.
 * @param courseById - Every course the sections can belong to.
 * @returns One entry per distinct course.
 * @throws {ScheduleInputError} When a section's course isn't supplied (`courseMissing`).
 */
export function coursesOfBundle(
  sections: readonly Section[],
  courseById: ReadonlyMap<CourseId, Course>,
): Course[] {
  return [...new Set(sections.map((section) => section.courseId))].map((courseId) => {
    const course = courseById.get(courseId);
    if (course === undefined) {
      throw new ScheduleInputError('courseMissing');
    }
    return course;
  });
}

/**
 * Decides whether a course adds its own credits to a plan's load.
 *
 * @param course - A course of the plan.
 * @param planCourseIds - Every distinct course of the plan, across all its bundles.
 * @returns `false` when another course of the plan includes its credits; otherwise `true`.
 */
export function countsOwnCredits(course: Course, planCourseIds: ReadonlySet<CourseId>): boolean {
  const includedIn = course.creditsIncludedInCourseId;
  // SAFETY: credits the institution includes in a course anywhere in the plan are counted once,
  // in that course's total, and a course whose including course isn't planned counts its own
  // (planning/08 §Constraint formulation: no double-counting of included labs).
  return includedIn === null || !planCourseIds.has(includedIn);
}

/**
 * Decides whether a course adds its credits to a plan's load.
 *
 * NOTE: the API's course checks call this; the schedule solver uses `countsOwnCredits` directly.
 * The declared return type still admits `null`, which is never returned, because the API's
 * course checks keep a `null` guard that would fail lint against a narrower type.
 *
 * @param course - A course of the plan.
 * @param planCourseIds - Every distinct course of the plan, across all its bundles.
 * @returns `false` when another course of the plan includes its credits; otherwise `true`.
 */
export function countsCreditsInPlan(
  course: Course,
  planCourseIds: ReadonlySet<CourseId>,
): boolean | null {
  return countsOwnCredits(course, planCourseIds);
}

/**
 * Turns a plan's bundles into the selections `checkCreditLoad` takes, deciding credit
 * inclusion over the whole plan.
 *
 * @param bundles - One bundle per requested course.
 * @param selectedCredits - The chosen credit value per variable-credit course; a course with
 *   no entry has none chosen.
 * @returns The selections, in bundle then course order.
 */
export function toBundleCourseSelections(
  bundles: readonly { readonly courses: readonly Course[] }[],
  selectedCredits: ReadonlyMap<CourseId, number>,
): readonly CourseSelection[] {
  const courses = bundles.flatMap((bundle) => bundle.courses);
  const planCourseIds = new Set(courses.map((course) => course.id));
  return courses.map((course) => ({
    course,
    selectedCreditsHundredths: selectedCredits.get(course.id) ?? null,
    countsCredits: countsOwnCredits(course, planCourseIds),
  }));
}
