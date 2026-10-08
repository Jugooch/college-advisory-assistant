/**
 * @file Lists the distinct, sorted section IDs of a schedule option. The save-draft request and
 * the advisor-case preview both use it, so a saved option is always found by the same ordering.
 * @module @caa/web/shared/utils/option-section-ids
 * @requirement FR-11
 * @requirement FR-12
 */
import type { SavePlanRequest, ScheduleOption } from '@caa/api-contract';

/**
 * Lists the section IDs of an option, in the order the API expects them: sorted and distinct.
 *
 * @param option - A schedule option from the API.
 * @returns Its section IDs. No section is added, dropped, or substituted.
 */
export function optionSectionIds(
  option: ScheduleOption,
): NonNullable<SavePlanRequest['selectedSectionIds']> {
  const ids = option.bundles.flatMap((bundle) =>
    bundle.sections.map((section) => section.sectionId),
  );
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en'));
}
