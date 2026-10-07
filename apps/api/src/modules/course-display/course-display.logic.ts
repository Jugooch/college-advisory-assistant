/**
 * @file Picks the catalog display entries (code, title, credit rule) for the courses a response
 * names. Pure logic (standard 05 §Logic): plain catalog data, never generated text.
 * @module @caa/api/modules/course-display/course-display.logic
 * @requirement FR-10
 * @requirement NFR-02
 * @see docs/standards/05-api-design.md
 */
import type { CourseDisplay, CreditRule } from '@caa/api-contract';
import { type Course, type CourseId, CreditRuleKind } from '@caa/domain';

/**
 * States a course's credit rule exactly as the catalog does.
 *
 * @param course - A catalog course.
 * @returns The fixed credits or the variable range, or `null` when a variable course lacks a
 *   bound.
 */
function creditRuleOf(course: Course): CreditRule | null {
  if (course.creditsHundredths !== null) {
    return { kind: CreditRuleKind.Fixed, creditsHundredths: course.creditsHundredths };
  }
  const { minCreditsHundredths, maxCreditsHundredths } = course;
  // SAFETY: a variable course without both bounds has no range to offer, so it gets no entry
  // rather than an invented one; the client falls back to the course ID.
  if (minCreditsHundredths === null || maxCreditsHundredths === null) {
    return null;
  }
  return { kind: CreditRuleKind.Variable, minCreditsHundredths, maxCreditsHundredths };
}

/**
 * Picks the display entries of the named courses, one per course, in first-named order. A course
 * that isn't in the catalog gets no entry, and neither does a variable-credit course missing a
 * credit bound: no range is invented.
 *
 * @param courseIds - The courses the response names; repeats are allowed.
 * @param catalog - The session tenant's catalog.
 * @returns The entries. `title` is the catalog title as stored; `null` stays `null`.
 */
export function selectCourseDisplays(
  courseIds: readonly CourseId[],
  catalog: readonly Course[],
): readonly CourseDisplay[] {
  const byId = new Map(catalog.map((course) => [course.id, course]));
  // SECURITY: data minimization. Only named courses are looked up, so no other catalog entry
  // is ever sent.
  return [...new Set(courseIds)].flatMap((courseId) => {
    const course = byId.get(courseId);
    const credits = course === undefined ? null : creditRuleOf(course);
    if (course === undefined || credits === null) {
      return [];
    }
    return [{ courseId, code: course.label, title: course.title, credits }];
  });
}
