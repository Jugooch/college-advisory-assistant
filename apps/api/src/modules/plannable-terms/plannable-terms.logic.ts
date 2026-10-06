/**
 * @file Picks the terms a student can plan for from each term's latest snapshot head. Pure
 * logic (standard 05 §Logic): the caller reads the clock and passes it in.
 * @module @caa/api/modules/plannable-terms/plannable-terms.logic
 * @requirement FR-08
 * @requirement NFR-01
 * @see docs/adr/0010-deterministic-bounded-schedule-solver.md
 */
import type { PlannableTerm } from '@caa/api-contract';
import type { TermLatestSectionSnapshot } from '@caa/db';
import type { TermId } from '@caa/domain';

import { type FreshnessPolicy, isSourceFresh } from '../source-freshness/source-freshness.logic';

/** Why a term with a published snapshot is not offered. */
export type ExclusionReason = 'STALE' | 'AMBIGUOUS';

/** A term left out of the list, with why. */
export interface ExcludedTerm {
  readonly termId: TermId;
  readonly reason: ExclusionReason;
}

/** The kept terms in input order, and the left-out ones. */
export interface PlannableTermSelection {
  readonly terms: readonly PlannableTerm[];
  readonly excluded: readonly ExcludedTerm[];
}

/**
 * Keeps a term only when its latest snapshot is unique and fresh under the same policy the
 * schedule-options gate uses.
 *
 * @param entries - Each term with its latest snapshot head, in the order to keep.
 * @param policy - The current time and the maximum source age.
 * @returns The plannable terms, minimized to what the contract exposes, and the exclusions.
 */
export function selectPlannableTerms(
  entries: readonly TermLatestSectionSnapshot[],
  policy: FreshnessPolicy,
): PlannableTermSelection {
  const terms: PlannableTerm[] = [];
  const excluded: ExcludedTerm[] = [];
  for (const { term, latest } of entries) {
    // SAFETY: a tied or stale head would offer a plan the schedule-options gate refuses, so
    // the term is left out, never listed with a warning (ADR-0010 Amendment 6).
    if (latest.status === 'AMBIGUOUS') {
      excluded.push({ termId: term.id, reason: 'AMBIGUOUS' });
    } else if (!isSourceFresh(latest.sourceEffectiveAt, policy)) {
      excluded.push({ termId: term.id, reason: 'STALE' });
    } else {
      // SECURITY: data minimization; tenantId and sequence stay on the server.
      terms.push({
        id: term.id,
        termCode: term.termCode,
        startsOn: term.startsOn,
        endsOn: term.endsOn,
      });
    }
  }
  return { terms, excluded };
}
