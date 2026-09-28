/**
 * @file Places a term code in a tenant's term order, from its term calendar, without comparing codes as strings.
 * @module @caa/engine/verification/term-position
 * @requirement FR-06
 * @requirement NFR-01
 * @see docs/planning/08-academic-verification-and-planning.md
 * @see docs/planning/09-data-model-and-integration-contracts.md
 */
import type { InstitutionId, TermCalendar } from '@caa/domain';

/** The tenant's term calendar, ordered by `sequence`. */
export interface TermCalendarOrder {
  readonly termCalendar: TermCalendar;
}

/** The tenant's term codes, oldest first, without a calendar. */
// TODO(#122): remove once the golden and acceptance callers pass a TermCalendar.
export interface TermCodeListOrder {
  readonly termCodesOldestFirst: readonly string[];
}

/** Where a term's position comes from: the calendar, or (transitional, tests only) a code list. */
export type TermOrder = TermCalendarOrder | TermCodeListOrder;

/**
 * Finds a term's position in the tenant's term order; a later term has a larger position.
 *
 * With a calendar the position is the term's `sequence`. The term must appear exactly once and
 * belong to `tenantId`. With the transitional code list it is the code's index.
 *
 * @param order - The tenant's term calendar, or the transitional code list.
 * @param tenantId - The tenant whose calendar applies, from the academic policy.
 * @param termCode - The term to place, as a `CourseAttempt.termCode`.
 * @returns The position, or `null` when the term can't be placed.
 */
export function termPositionOf(
  order: TermOrder,
  tenantId: InstitutionId,
  termCode: string,
): number | null {
  if (!('termCalendar' in order)) {
    const index = order.termCodesOldestFirst.indexOf(termCode);
    return index === -1 ? null : index;
  }
  // SAFETY: term codes and sequences are tenant-specific, and a code listed twice would have two
  // positions. A term that isn't in the tenant's calendar exactly once can't be placed, so the
  // caller's result stays undetermined instead of guessing an order from the code's text
  // (planning/09 §Canonical entities: term IDs are tenant-specific; planning/08 §Eligibility
  // semantics: repeated attempts use approved source semantics).
  const matches = order.termCalendar.filter(
    (term) => term.termCode === termCode && term.tenantId === tenantId,
  );
  const [term, ...others] = matches;
  return term === undefined || others.length > 0 ? null : term.sequence;
}
