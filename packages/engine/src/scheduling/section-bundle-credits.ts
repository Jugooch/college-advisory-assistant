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

/** The credit selections of a plan, or the courses whose credit inclusion is unknown. */
export type BundleCourseSelections =
  | { readonly isKnown: true; readonly selections: readonly CourseSelection[] }
  | { readonly isKnown: false; readonly unknownCourseIds: readonly CourseId[] };

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
 * Reads a course's credit inclusion, admitting an omitted value.
 *
 * NOTE: stages #229. The declared return type keeps `undefined`, so the omitted-value check in
 * `countsCreditsInPlan` stays valid whether the domain field is optional or required; an
 * annotated local would be narrowed by its initializer instead.
 * TODO(#229): remove with the omitted-value branch once the field is required.
 *
 * @param course - A course of the plan.
 * @returns The including course, `null`, or `undefined` when the value is omitted.
 */
function creditInclusionOf(course: Course): CourseId | null | undefined {
  return course.creditsIncludedInCourseId;
}

/**
 * Decides whether a course adds its credits to a plan's load.
 *
 * @param course - A course of the plan.
 * @param planCourseIds - Every distinct course of the plan, across all its bundles.
 * @returns `false` when another course of the plan includes its credits, `true` when it counts
 *   its own, or `null` when the catalog hasn't said and another course of the plan could
 *   include them.
 */
export function countsCreditsInPlan(
  course: Course,
  planCourseIds: ReadonlySet<CourseId>,
): boolean | null {
  const includedIn = creditInclusionOf(course);
  // SAFETY: an omitted value means the catalog hasn't said whether another course includes
  // these credits. It decides nothing when the plan has no other course, because credits are
  // only ever included in a course that is taken; otherwise it is unknown, never assumed
  // either way (planning/08 §Constraint formulation; §Authority and result semantics).
  if (includedIn === undefined) {
    return planCourseIds.size > 1 ? null : true;
  }
  // SAFETY: credits the institution includes in a course anywhere in the plan are counted once,
  // in that course's total, and a course whose including course isn't planned counts its own
  // (planning/08 §Constraint formulation: no double-counting of included labs).
  return includedIn === null || !planCourseIds.has(includedIn);
}

/**
 * Turns a plan's bundles into the selections `checkCreditLoad` takes, deciding credit
 * inclusion over the whole plan.
 *
 * @param bundles - One bundle per requested course.
 * @param selectedCredits - The chosen credit value per variable-credit course; a course with
 *   no entry has none chosen.
 * @returns The selections, in bundle then course order, or the courses whose inclusion is
 *   unknown, in the same order.
 */
export function toBundleCourseSelections(
  bundles: readonly { readonly courses: readonly Course[] }[],
  selectedCredits: ReadonlyMap<CourseId, number>,
): BundleCourseSelections {
  const courses = bundles.flatMap((bundle) => bundle.courses);
  const planCourseIds = new Set(courses.map((course) => course.id));
  const counted = courses.map((course) => ({
    course,
    countsCredits: countsCreditsInPlan(course, planCourseIds),
  }));
  const unknownCourseIds = counted.flatMap((entry) =>
    entry.countsCredits === null ? [entry.course.id] : [],
  );
  // SAFETY: a load that may or may not include a course's credits can't be decided, so the
  // caller reports it as UNKNOWN, never as either total (planning/08 §Authority and result
  // semantics).
  if (unknownCourseIds.length > 0) {
    return { isKnown: false, unknownCourseIds };
  }
  const selections = counted.map((entry) => ({
    course: entry.course,
    selectedCreditsHundredths: selectedCredits.get(entry.course.id) ?? null,
    countsCredits: entry.countsCredits === true,
  }));
  return { isKnown: true, selections };
}
