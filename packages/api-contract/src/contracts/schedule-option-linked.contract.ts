/**
 * @file Structural rules for the linked-course results of a schedule option: which courses an
 *   entry may name, and how the entries are ordered (ADR-0010 Amendment 4).
 * @module @caa/api-contract/contracts/schedule-option-linked
 * @requirement FR-07
 * @requirement FR-09
 * @requirement FR-18
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */

/** The option fields the linked-course rules read. */
export interface LinkedCourseShape {
  readonly bundles: readonly {
    readonly courseId: string;
    readonly sections: readonly { readonly courseId: string }[];
  }[];
  readonly linkedCourseResults: readonly { readonly courseId: string }[];
}

/**
 * Returns whether the entries are in strictly ascending course ID order, which also means no
 * course repeats. IDs compare by UTF-16 code units, the `<` operator.
 *
 * @param courseIds - Entry course IDs, in the order shown.
 * @returns `true` when each ID is greater than the one before.
 */
export function isStrictlyAscending(courseIds: readonly string[]): boolean {
  return courseIds.every(
    (courseId, index) => index === 0 || (courseIds[index - 1] ?? '') < courseId,
  );
}

/**
 * Returns whether every linked-course entry names a course with a shown section that no bundle
 * requested. Which linked courses need an entry is the engine's rule, not restated here.
 *
 * @param option - The bundles and the linked-course entries.
 * @returns `true` when each entry is about a shown, non-requested course.
 */
export function linkedEntriesAreStructural(option: LinkedCourseShape): boolean {
  const requested = new Set(option.bundles.map((bundle) => bundle.courseId));
  const shown = new Set(
    option.bundles.flatMap((bundle) => bundle.sections.map((section) => section.courseId)),
  );
  return option.linkedCourseResults.every(
    ({ courseId }) => shown.has(courseId) && !requested.has(courseId),
  );
}
