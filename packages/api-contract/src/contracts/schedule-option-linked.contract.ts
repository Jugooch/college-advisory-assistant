/**
 * @file Rules for the linked-course results of a schedule option: which linked courses need an
 *   entry, and how the entries are ordered (ADR-0010 Amendment 4).
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
    readonly sections: readonly { readonly courseId: string; readonly countsCredits: boolean }[];
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
 * Lists the courses of shown sections that no bundle requested.
 *
 * @param option - The bundles.
 * @returns A map from each linked course to whether any of its shown sections counts credits.
 */
function linkedCoursesShown(option: LinkedCourseShape): ReadonlyMap<string, boolean> {
  const requested = new Set(option.bundles.map((bundle) => bundle.courseId));
  const shown = new Map<string, boolean>();
  for (const section of option.bundles.flatMap((bundle) => bundle.sections)) {
    if (!requested.has(section.courseId)) {
      shown.set(section.courseId, (shown.get(section.courseId) ?? false) || section.countsCredits);
    }
  }
  return shown;
}

/**
 * Returns whether the linked-course entries match the shown sections: no entry names a requested
 * course or a course without a shown section, and every non-requested course with a shown
 * section that counts credits has an entry.
 *
 * @param option - The bundles and the linked-course entries.
 * @returns `true` when the entries fit the bundles.
 */
export function linkedResultsMatchSections(option: LinkedCourseShape): boolean {
  const shown = linkedCoursesShown(option);
  const entries = new Set(option.linkedCourseResults.map((result) => result.courseId));
  return (
    [...entries].every((courseId) => shown.has(courseId)) &&
    [...shown].every(([courseId, countsCredits]) => !countsCredits || entries.has(courseId))
  );
}
