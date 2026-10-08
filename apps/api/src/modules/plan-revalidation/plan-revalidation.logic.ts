/**
 * @file Pure rule for revalidating a plan draft: whether the earlier selection carries over.
 * @module @caa/api/modules/plan-revalidation/plan-revalidation.logic
 * @requirement FR-02
 * @requirement FR-11
 * @see docs/adr/0013-plan-drafts-staleness-and-advisor-cases.md
 */
import type { ScheduleOptionsResponse } from '@caa/api-contract';
import type { SectionId } from '@caa/domain';

import { resolveSelection } from '../plan-revisions/plan-revisions.logic';

/**
 * Carries a revision's selection over to a revalidation: kept only if the identical section set
 * is among the new options, otherwise null. Never substitutes a different section.
 *
 * @param result - The revalidation's replayed result.
 * @param previous - The selection stored on the revision being revalidated.
 * @returns The sorted selection when still an option, else null.
 */
export function carryOverSelection(
  result: ScheduleOptionsResponse,
  previous: readonly SectionId[] | null,
): readonly SectionId[] | null {
  // SAFETY: a withdrawn or changed section set leaves no selection, so the student chooses again
  // (ADR-0013 §4).
  const resolved = resolveSelection(result, previous);
  return resolved === 'INVALID' ? null : resolved;
}
