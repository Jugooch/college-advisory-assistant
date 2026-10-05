/**
 * @file Decides which courses of a section bundle add their credits, so included credits count once.
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

/** One course of a bundle and whether it adds its credits to the load. */
export interface BundleCourseCredits {
  readonly course: Course;
  /**
   * `false` when another course of the bundle already includes this course's credits, `true`
   * when it counts its own, and `null` when the catalog hasn't said whether its credits are
   * included elsewhere and the bundle has a course that could include them.
   */
  readonly countsCredits: boolean | null;
}

/** The credit selections of a set of bundles, or the courses whose inclusion is unknown. */
export type BundleCourseSelections =
  | { readonly isKnown: true; readonly selections: readonly CourseSelection[] }
  | { readonly isKnown: false; readonly unknownCourseIds: readonly CourseId[] };

/**
 * Lists each distinct course of a bundle, in the order its first section appears, with
 * whether it adds its credits.
 *
 * @param sections - The bundle's sections, the requested course's section first.
 * @param courseById - Every course the sections can belong to.
 * @returns One entry per distinct course.
 * @throws {ScheduleInputError} When a section's course isn't supplied (`courseMissing`).
 */
export function creditsOfBundle(
  sections: readonly Section[],
  courseById: ReadonlyMap<CourseId, Course>,
): BundleCourseCredits[] {
  const courseIds = [...new Set(sections.map((section) => section.courseId))];
  const courses = courseIds.map((courseId) => {
    const course = courseById.get(courseId);
    if (course === undefined) {
      throw new ScheduleInputError('courseMissing');
    }
    return course;
  });
  return courses.map((course) => ({ course, countsCredits: countsCreditsIn(course, courseIds) }));
}

/**
 * Decides whether a course adds its credits within a bundle.
 *
 * @param course - The course.
 * @param bundleCourseIds - Every distinct course of the bundle.
 * @returns Whether it adds its credits, or `null` when that is unknown.
 */
function countsCreditsIn(course: Course, bundleCourseIds: readonly CourseId[]): boolean | null {
  const includedIn = course.creditsIncludedInCourseId;
  // SAFETY: an omitted value means the catalog hasn't said whether another course includes
  // these credits. It decides nothing when the bundle has no other course, because credits
  // included in a course that isn't taken are counted on their own; otherwise it is unknown,
  // never assumed either way (planning/08 §Constraint formulation; §Authority and result
  // semantics: missing data is UNKNOWN).
  if (includedIn === undefined) {
    return bundleCourseIds.length > 1 ? null : true;
  }
  // SAFETY: credits the institution includes in another course of the bundle are counted once,
  // in that course's total, never twice (planning/08 §Constraint formulation).
  return includedIn === null || !bundleCourseIds.includes(includedIn);
}

/**
 * Turns the credits of several bundles into the selections `checkCreditLoad` takes.
 *
 * @param bundles - One bundle per requested course.
 * @param selectedCredits - The chosen credit value per variable-credit course; a course with
 *   no entry has none chosen.
 * @returns The selections, in bundle then course order, or the courses whose inclusion is
 *   unknown, in the same order.
 */
export function toBundleCourseSelections(
  bundles: readonly { readonly credits: readonly BundleCourseCredits[] }[],
  selectedCredits: ReadonlyMap<CourseId, number>,
): BundleCourseSelections {
  const credits = bundles.flatMap((bundle) => bundle.credits);
  const unknownCourseIds = credits.flatMap((entry) =>
    entry.countsCredits === null ? [entry.course.id] : [],
  );
  // SAFETY: a load that may or may not include a course's credits can't be decided, so the
  // caller reports it as UNKNOWN, never as either total (planning/08 §Authority and result
  // semantics).
  if (unknownCourseIds.length > 0) {
    return { isKnown: false, unknownCourseIds };
  }
  const selections = credits.map((entry) => ({
    course: entry.course,
    selectedCreditsHundredths: selectedCredits.get(entry.course.id) ?? null,
    countsCredits: entry.countsCredits === true,
  }));
  return { isKnown: true, selections };
}
