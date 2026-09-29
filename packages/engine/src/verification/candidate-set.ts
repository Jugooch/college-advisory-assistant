/**
 * @file Input record of a candidate course set, its validation, and the credits each selection carries.
 * @module @caa/engine/verification/candidate-set
 * @requirement FR-05
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 */
import type { Course } from '@caa/domain';

/**
 * One course of a candidate set, as the caller planned it.
 *
 * Linked sections: a lab, recitation, or other linked activity that is its own catalog course
 * but whose credits the institution already includes in the lecture's credit total is passed
 * with `countsCredits: false`, so its credits aren't counted twice. A linked section that
 * awards its own credits is passed with `countsCredits: true`. The caller decides this from
 * the published linked-section rules; the engine never infers it from labels.
 */
export interface CourseSelection {
  readonly course: Course;
  /**
   * The chosen credit value in hundredths for a variable-credit course, or `null` when none is
   * chosen yet. For a fixed-credit course it is `null` or exactly the course's credits.
   */
  readonly selectedCreditsHundredths: number | null;
  /** Whether this selection adds its credits to the load; `false` for an included linked section. */
  readonly countsCredits: boolean;
}

/** What is wrong with a candidate set or its credit bounds. */
export type CandidateSetInputIssue =
  | 'duplicateCourse'
  | 'equivalentCourses'
  | 'selectedCredits'
  | 'courseCredits'
  | 'bounds'
  | 'totalCredits';

/** Thrown when a candidate set or its credit bounds are malformed, instead of guessing. */
export class CandidateSetInputError extends Error {
  /** The input problem, for callers that map it to a response. */
  readonly issue: CandidateSetInputIssue;

  /**
   * Creates the error.
   *
   * @param issue - What is wrong with the input.
   */
  constructor(issue: CandidateSetInputIssue) {
    super(`Candidate set input is invalid: ${issue}`);
    this.name = 'CandidateSetInputError';
    this.issue = issue;
  }
}

/**
 * Checks that a candidate set names each course once and holds no two equivalent courses.
 *
 * @param selections - The candidate set.
 * @throws {CandidateSetInputError} When a course repeats (`duplicateCourse`), two courses share
 *   an equivalency group (`equivalentCourses`), a selected credit value is invalid for its
 *   course (`selectedCredits`), or a variable-credit course lacks a bound (`courseCredits`).
 */
export function assertValidCandidateSet(selections: readonly CourseSelection[]): void {
  const courseIds = selections.map((selection) => selection.course.id);
  if (new Set(courseIds).size !== courseIds.length) {
    throw new CandidateSetInputError('duplicateCourse');
  }
  // SAFETY: two aliases of one course never earn separate credits (planning/08 §Candidate
  // formation). Excluding duplicate credit is a hard constraint the caller applies before
  // these checks (§Constraint formulation); the engine won't guess which alias awards credit.
  const groupIds = selections.flatMap((selection) =>
    selection.course.equivalencyGroupId === null ? [] : [selection.course.equivalencyGroupId],
  );
  if (new Set(groupIds).size !== groupIds.length) {
    throw new CandidateSetInputError('equivalentCourses');
  }
  selections.forEach(selectedCreditsOf);
}

/**
 * Returns the credits a selection awards if it is taken.
 *
 * @param selection - One course of the candidate set.
 * @returns The fixed or selected credits in hundredths, or `null` for a variable-credit course
 *   with no chosen value.
 * @throws {CandidateSetInputError} When the selected value isn't a safe integer within the
 *   course's range, or differs from a fixed course's credits (`selectedCredits`), or a
 *   variable-credit course lacks a bound (`courseCredits`).
 */
export function selectedCreditsOf(selection: CourseSelection): number | null {
  const { course, selectedCreditsHundredths: selected } = selection;
  const range = creditRangeOf(course);
  if (selected === null) {
    return course.creditsHundredths;
  }
  // SAFETY: a value outside the catalog range is credit the course can never award, so it is
  // a caller error, not a load to evaluate or clamp (planning/08 §Candidate formation: exact
  // credit values; AC18). A fixed course's range is its credits alone.
  if (!Number.isSafeInteger(selected) || selected < range.min || selected > range.max) {
    throw new CandidateSetInputError('selectedCredits');
  }
  return selected;
}

/**
 * Returns the most credits a selection can award, whether or not a value is chosen.
 *
 * @param selection - One course of the candidate set.
 * @returns The fixed or selected credits, or the course's maximum when none is chosen.
 * @throws {CandidateSetInputError} As `selectedCreditsOf`.
 */
export function maxCreditsOf(selection: CourseSelection): number {
  return selectedCreditsOf(selection) ?? creditRangeOf(selection.course).max;
}

/**
 * Returns the credit values a course can award.
 *
 * @param course - A catalog course.
 * @returns Its fixed credits as both ends, or its variable range.
 * @throws {CandidateSetInputError} When a variable-credit course lacks a bound (`courseCredits`).
 */
function creditRangeOf(course: Course): { readonly min: number; readonly max: number } {
  if (course.creditsHundredths !== null) {
    return { min: course.creditsHundredths, max: course.creditsHundredths };
  }
  const { minCreditsHundredths: min, maxCreditsHundredths: max } = course;
  // SAFETY: the course schema requires both bounds on a variable-credit course; one that
  // arrives without them has no range, so it is rejected rather than read as zero credits.
  if (min === null || max === null) {
    throw new CandidateSetInputError('courseCredits');
  }
  return { min, max };
}
